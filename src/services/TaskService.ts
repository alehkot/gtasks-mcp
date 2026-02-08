import { tasks_v1 } from "googleapis";
import {
  type TaskListFilterArgs,
  TASK_PAGE_SIZE,
  MAX_TASK_RESULTS,
  buildListParams,
  formatTaskList,
  paginatedTextResponse,
  textResponse,
} from "../helpers.js";

/**
 * MCP tool handlers for Google Tasks task operations.
 * Wraps the `tasks.*` endpoints of the Google Tasks API.
 */
export class TaskService {
  constructor(private readonly client: tasks_v1.Tasks) {}

  /** Fetches all task lists across API pages. */
  private async fetchAllTaskLists(): Promise<tasks_v1.Schema$TaskList[]> {
    const taskLists: tasks_v1.Schema$TaskList[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.client.tasklists.list({
        maxResults: MAX_TASK_RESULTS,
        pageToken,
      });

      taskLists.push(...(response.data.items || []));
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return taskLists;
  }

  /** Fetches all tasks from a single task list across API pages. */
  private async fetchAllTasksFromTaskList(
    taskListId: string,
    listParams: ReturnType<typeof buildListParams>,
  ): Promise<tasks_v1.Schema$Task[]> {
    const tasks: tasks_v1.Schema$Task[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.client.tasks.list({
        tasklist: taskListId,
        ...listParams,
        pageToken,
      });

      tasks.push(...(response.data.items || []));
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return tasks;
  }

  /**
   * Fetches tasks from one or all task lists with optional filters.
   * When {@link TaskListFilterArgs.taskListId} is provided, queries only that list;
   * otherwise queries all task lists in parallel.
   */
  private async fetchTasks(filters: TaskListFilterArgs) {
    const listParams = buildListParams(filters);

    if (filters.taskListId) {
      return this.fetchAllTasksFromTaskList(filters.taskListId, listParams);
    }

    const taskLists = await this.fetchAllTaskLists();

    const results = await Promise.allSettled(
      taskLists
        .filter((tl) => tl.id)
        .map((taskList) => this.fetchAllTasksFromTaskList(taskList.id!, listParams)),
    );

    let allTasks: tasks_v1.Schema$Task[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        allTasks = allTasks.concat(result.value);
      } else {
        console.error("Error fetching tasks:", result.reason);
      }
    }
    return allTasks;
  }

  /** Parses a cursor (offset) for list/search pagination. */
  private parseCursor(cursor?: string): number {
    if (!cursor) return 0;

    const offset = Number.parseInt(cursor, 10);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error("Invalid cursor. Use the cursor returned by the previous call.");
    }

    return offset;
  }

  /** Returns one page of tasks and the next cursor (if more results remain). */
  private paginateTasks(tasks: tasks_v1.Schema$Task[], cursor?: string) {
    const offset = this.parseCursor(cursor);
    if (tasks.length > 0 && offset >= tasks.length) {
      throw new Error("Invalid cursor. Use the cursor returned by the previous call.");
    }

    const page = tasks.slice(offset, offset + TASK_PAGE_SIZE);
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < tasks.length ? String(nextOffset) : null;

    return {
      page,
      nextCursor,
      offset,
      total: tasks.length,
    };
  }

  /** Lists tasks with cursor pagination (20 tasks per page). */
  async list(filters: TaskListFilterArgs, cursor?: string) {
    const allTasks = await this.fetchTasks(filters);
    const { page, nextCursor, offset, total } = this.paginateTasks(allTasks, cursor);

    const header =
      total === 0
        ? "Found 0 tasks."
        : `Found ${total} tasks. Showing ${offset + 1}-${offset + page.length} of ${total}.`;

    const body = page.length > 0 ? formatTaskList(page) : "No tasks on this page.";
    const cursorLine = nextCursor ? `\nNext cursor: ${nextCursor}` : "";

    return paginatedTextResponse(`${header}\n${body}${cursorLine}`, {
      pageSize: TASK_PAGE_SIZE,
      total,
      offset,
      returned: page.length,
      nextCursor,
    });
  }

  /**
   * Searches for tasks whose title or notes contain the query string.
   * Performs a case-insensitive client-side filter over the results from {@link fetchTasks}.
   */
  async search(query: string, filters: TaskListFilterArgs, cursor?: string) {
    const allTasks = await this.fetchTasks(filters);
    const filteredItems = allTasks.filter(
      (task) =>
        task.title?.toLowerCase().includes(query.toLowerCase()) ||
        task.notes?.toLowerCase().includes(query.toLowerCase()),
    );
    const { page, nextCursor, offset, total } = this.paginateTasks(filteredItems, cursor);

    const header =
      total === 0
        ? `Found 0 tasks matching "${query}".`
        : `Found ${total} tasks matching "${query}". Showing ${offset + 1}-${offset + page.length} of ${total}.`;

    const body = page.length > 0 ? formatTaskList(page) : "No tasks on this page.";
    const cursorLine = nextCursor ? `\nNext cursor: ${nextCursor}` : "";

    return paginatedTextResponse(`${header}\n${body}${cursorLine}`, {
      pageSize: TASK_PAGE_SIZE,
      total,
      offset,
      returned: page.length,
      nextCursor,
    });
  }

  /**
   * Creates a new task in the specified task list.
   * Supports optional `parent` and `previous` for positioning as a subtask
   * or after a specific sibling. Defaults to the `@default` task list.
   */
  async create(args: {
    taskListId?: string;
    title: string;
    notes?: string;
    status?: string;
    due?: string;
    parent?: string;
    previous?: string;
  }) {
    const taskListId = args.taskListId || "@default";
    const task: Record<string, string> = { title: args.title };
    if (args.notes) task.notes = args.notes;
    if (args.due) task.due = args.due;
    if (args.status) task.status = args.status;

    const insertParams: Record<string, any> = {
      tasklist: taskListId,
      requestBody: task,
    };
    if (args.parent) insertParams.parent = args.parent;
    if (args.previous) insertParams.previous = args.previous;

    const taskResponse = await this.client.tasks.insert(insertParams);
    return textResponse(`Task created: ${taskResponse.data.title}`);
  }

  /**
   * Updates an existing task's fields (title, notes, status, due date).
   * Only provided fields are overwritten; omitted fields are left unchanged.
   */
  async update(args: {
    taskListId?: string;
    id: string;
    title?: string;
    notes?: string;
    status?: string;
    due?: string;
  }) {
    const taskListId = args.taskListId || "@default";

    const task: Record<string, string | undefined> = { id: args.id };
    if (args.title !== undefined) task.title = args.title;
    if (args.notes !== undefined) task.notes = args.notes;
    if (args.status !== undefined) task.status = args.status;
    if (args.due !== undefined) task.due = args.due;

    const taskResponse = await this.client.tasks.patch({
      tasklist: taskListId,
      task: args.id,
      requestBody: task,
    });
    return textResponse(`Task updated: ${taskResponse.data.title}`);
  }

  /** Permanently deletes a task by ID from the specified task list. */
  async delete(taskListId: string | undefined, taskId: string) {
    await this.client.tasks.delete({
      tasklist: taskListId || "@default",
      task: taskId,
    });
    return textResponse(`Task ${taskId} deleted`);
  }

  /** Removes all completed tasks from the specified task list. */
  async clear(taskListId: string | undefined) {
    await this.client.tasks.clear({
      tasklist: taskListId || "@default",
    });
    return textResponse(`Tasks from tasklist ${taskListId || "@default"} cleared`);
  }

  /**
   * Moves a task to a new position, parent, or destination task list.
   * Use `parent` to nest under another task, `previous` to reorder among siblings,
   * and `destinationTasklist` to move across task lists.
   */
  async move(args: {
    taskListId: string;
    taskId: string;
    parent?: string;
    previous?: string;
    destinationTasklist?: string;
  }) {
    const moveParams: Record<string, any> = {
      tasklist: args.taskListId,
      task: args.taskId,
    };
    if (args.parent) moveParams.parent = args.parent;
    if (args.previous) moveParams.previous = args.previous;
    if (args.destinationTasklist) moveParams.destinationTasklist = args.destinationTasklist;

    const response = await this.client.tasks.move(moveParams);
    return textResponse(`Task moved: ${response.data.title} (ID: ${response.data.id})`);
  }
}
