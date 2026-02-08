import { tasks_v1 } from "googleapis";
import {
  type TaskListFilterArgs,
  MAX_TASK_RESULTS,
  buildListParams,
  formatTaskList,
  textResponse,
} from "../helpers.js";

/**
 * MCP tool handlers for Google Tasks task operations.
 * Wraps the `tasks.*` endpoints of the Google Tasks API.
 */
export class TaskService {
  constructor(private readonly client: tasks_v1.Tasks) {}

  /**
   * Fetches tasks from one or all task lists with optional filters.
   * When {@link TaskListFilterArgs.taskListId} is provided, queries only that list;
   * otherwise queries all task lists in parallel.
   */
  private async fetchTasks(filters: TaskListFilterArgs) {
    const listParams = buildListParams(filters);

    if (filters.taskListId) {
      const response = await this.client.tasks.list({ tasklist: filters.taskListId, ...listParams });
      return response.data.items || [];
    }

    const taskListsResponse = await this.client.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];

    const results = await Promise.allSettled(
      taskLists
        .filter((tl) => tl.id)
        .map((taskList) =>
          this.client.tasks.list({
            tasklist: taskList.id!,
            ...listParams,
          }),
        ),
    );

    let allTasks: tasks_v1.Schema$Task[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        const items = result.value.data.items || [];
        allTasks = allTasks.concat(items);
      } else {
        console.error("Error fetching tasks:", result.reason);
      }
    }
    return allTasks;
  }

  /** Lists all tasks, optionally filtered, and returns a formatted summary. */
  async list(filters: TaskListFilterArgs) {
    const allTasks = await this.fetchTasks(filters);
    return textResponse(`Found ${allTasks.length} tasks:\n${formatTaskList(allTasks)}`);
  }

  /**
   * Searches for tasks whose title or notes contain the query string.
   * Performs a case-insensitive client-side filter over the results from {@link fetchTasks}.
   */
  async search(query: string, filters: TaskListFilterArgs) {
    const allTasks = await this.fetchTasks(filters);
    const filteredItems = allTasks.filter(
      (task) =>
        task.title?.toLowerCase().includes(query.toLowerCase()) ||
        task.notes?.toLowerCase().includes(query.toLowerCase()),
    );
    return textResponse(`Found ${filteredItems.length} tasks:\n${formatTaskList(filteredItems)}`);
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
