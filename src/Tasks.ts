import { tasks_v1 } from "googleapis";

/** Maximum number of results to request per Google Tasks API call. */
const MAX_TASK_RESULTS = 100;

/**
 * Handles MCP resource protocol operations for Google Tasks.
 * Provides read and list capabilities for exposing tasks as MCP resources.
 */
export class TaskResources {
  /**
   * Finds a task by ID across all task lists.
   * Searches every task list in parallel since the Google Tasks API
   * requires a task list ID to fetch a task.
   *
   * @throws {Error} If the task is not found in any task list.
   */
  static async read(taskId: string, tasks: tasks_v1.Tasks) {
    const taskListsResponse = await tasks.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];

    const results = await Promise.allSettled(
      taskLists
        .filter((tl) => tl.id)
        .map((taskList) =>
          tasks.tasks.get({ tasklist: taskList.id!, task: taskId }),
        ),
    );

    const found = results.find(
      (r) => r.status === "fulfilled",
    );

    if (!found || found.status !== "fulfilled") {
      throw new Error("Task not found");
    }

    return found.value.data;
  }

  /**
   * Lists tasks from all task lists with pagination support.
   * @returns A tuple of [tasks, nextPageToken] for cursor-based pagination.
   */
  static async list(
    tasks: tasks_v1.Tasks,
    cursor?: string,
  ): Promise<[tasks_v1.Schema$Task[], string | null]> {
    const pageSize = 10;
    const params: { maxResults: number; pageToken?: string } = {
      maxResults: pageSize,
    };

    if (cursor) {
      params.pageToken = cursor;
    }

    const taskListsResponse = await tasks.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];

    const responses = await Promise.allSettled(
      taskLists
        .filter((tl) => tl.id)
        .map((taskList) =>
          tasks.tasks.list({ tasklist: taskList.id!, ...params }),
        ),
    );

    let allTasks: tasks_v1.Schema$Task[] = [];
    let nextPageToken: string | null = null;

    for (const result of responses) {
      if (result.status === "fulfilled") {
        const taskItems = result.value.data.items || [];
        allTasks = allTasks.concat(taskItems);
        if (result.value.data.nextPageToken) {
          nextPageToken = result.value.data.nextPageToken;
        }
      }
    }

    return [allTasks, nextPageToken];
  }
}

/** Optional filters passed through to the Google Tasks `tasks.list` API. */
export interface TaskListFilterArgs {
  taskListId?: string;
  showCompleted?: boolean;
  showHidden?: boolean;
  showDeleted?: boolean;
  showAssigned?: boolean;
  completedMin?: string;
  completedMax?: string;
  dueMin?: string;
  dueMax?: string;
  updatedMin?: string;
}

/**
 * MCP tool handlers for Google Tasks task list management.
 * Wraps the `tasklists.*` endpoints of the Google Tasks API.
 */
export class TaskListActions {
  /** Lists all task lists for the authenticated user. */
  static async list(tasks: tasks_v1.Tasks) {
    const response = await tasks.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });
    const taskLists = response.data.items || [];
    const formatted = taskLists
      .map((tl) => `${tl.title} - ID: ${tl.id} - Updated: ${tl.updated}`)
      .join("\n");
    return {
      content: [{ type: "text" as const, text: `Found ${taskLists.length} task lists:\n${formatted}` }],
    };
  }

  /** Retrieves a single task list by its ID. */
  static async get(taskListId: string, tasks: tasks_v1.Tasks) {
    const response = await tasks.tasklists.get({ tasklist: taskListId });
    const tl = response.data;
    return {
      content: [{ type: "text" as const, text: `Title: ${tl.title}\nID: ${tl.id}\nUpdated: ${tl.updated}\nKind: ${tl.kind}\nETag: ${tl.etag}` }],
    };
  }

  /** Creates a new task list with the given title. */
  static async create(title: string, tasks: tasks_v1.Tasks) {
    const response = await tasks.tasklists.insert({ requestBody: { title } });
    return {
      content: [{ type: "text" as const, text: `Task list created: ${response.data.title} (ID: ${response.data.id})` }],
    };
  }

  /** Updates an existing task list's title. */
  static async update(taskListId: string, title: string | undefined, tasks: tasks_v1.Tasks) {
    const response = await tasks.tasklists.update({
      tasklist: taskListId,
      requestBody: { title },
    });
    return {
      content: [{ type: "text" as const, text: `Task list updated: ${response.data.title}` }],
    };
  }

  /** Permanently deletes a task list and all its tasks. */
  static async delete(taskListId: string, tasks: tasks_v1.Tasks) {
    await tasks.tasklists.delete({ tasklist: taskListId });
    return {
      content: [{ type: "text" as const, text: `Task list ${taskListId} deleted` }],
    };
  }
}

/**
 * MCP tool handlers for Google Tasks task operations.
 * Wraps the `tasks.*` endpoints of the Google Tasks API.
 */
export class TaskActions {
  /** Formats a single task into a human-readable string with all fields. */
  private static formatTask(task: tasks_v1.Schema$Task) {
    return `${task.title}\n (Due: ${task.due || "Not set"}) - Notes: ${task.notes} - ID: ${task.id} - Status: ${task.status} - URI: ${task.selfLink} - Hidden: ${task.hidden} - Parent: ${task.parent} - Deleted?: ${task.deleted} - Completed Date: ${task.completed} - Position: ${task.position} - Updated Date: ${task.updated} - ETag: ${task.etag} - Links: ${task.links} - Kind: ${task.kind}}`;
  }

  /** Formats an array of tasks into a newline-separated string. */
  private static formatTaskList(taskList: tasks_v1.Schema$Task[]) {
    return taskList.map((task) => this.formatTask(task)).join("\n");
  }

  /**
   * Fetches tasks from one or all task lists with optional filters.
   * When {@link TaskListFilterArgs.taskListId} is provided, queries only that list;
   * otherwise queries all task lists in parallel.
   */
  static async _list(filters: TaskListFilterArgs, tasks: tasks_v1.Tasks) {
    const listParams: Record<string, any> = {
      maxResults: MAX_TASK_RESULTS,
    };
    if (filters.showCompleted !== undefined) listParams.showCompleted = filters.showCompleted;
    if (filters.showHidden !== undefined) listParams.showHidden = filters.showHidden;
    if (filters.showDeleted !== undefined) listParams.showDeleted = filters.showDeleted;
    if (filters.showAssigned !== undefined) listParams.showAssigned = filters.showAssigned;
    if (filters.completedMin) listParams.completedMin = filters.completedMin;
    if (filters.completedMax) listParams.completedMax = filters.completedMax;
    if (filters.dueMin) listParams.dueMin = filters.dueMin;
    if (filters.dueMax) listParams.dueMax = filters.dueMax;
    if (filters.updatedMin) listParams.updatedMin = filters.updatedMin;

    if (filters.taskListId) {
      const response = await tasks.tasks.list({ tasklist: filters.taskListId, ...listParams });
      return response.data.items || [];
    }

    const taskListsResponse = await tasks.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];

    const results = await Promise.allSettled(
      taskLists
        .filter((tl) => tl.id)
        .map((taskList) =>
          tasks.tasks.list({
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

  /**
   * Creates a new task in the specified task list.
   * Supports optional `parent` and `previous` for positioning as a subtask
   * or after a specific sibling. Defaults to the `@default` task list.
   */
  static async create(
    args: { taskListId?: string; title: string; notes?: string; status?: string; due?: string; parent?: string; previous?: string },
    tasks: tasks_v1.Tasks,
  ) {
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

    const taskResponse = await tasks.tasks.insert(insertParams);

    return {
      content: [{ type: "text" as const, text: `Task created: ${taskResponse.data.title}` }],
    };
  }

  /**
   * Updates an existing task's fields (title, notes, status, due date).
   * Only provided fields are overwritten; omitted fields are left unchanged.
   */
  static async update(
    args: { taskListId?: string; id: string; title?: string; notes?: string; status?: string; due?: string },
    tasks: tasks_v1.Tasks,
  ) {
    const taskListId = args.taskListId || "@default";

    const task: Record<string, string | undefined> = { id: args.id };
    if (args.title !== undefined) task.title = args.title;
    if (args.notes !== undefined) task.notes = args.notes;
    if (args.status !== undefined) task.status = args.status;
    if (args.due !== undefined) task.due = args.due;

    const taskResponse = await tasks.tasks.update({
      tasklist: taskListId,
      task: args.id,
      requestBody: task,
    });

    return {
      content: [{ type: "text" as const, text: `Task updated: ${taskResponse.data.title}` }],
    };
  }

  /** Lists all tasks, optionally filtered, and returns a formatted summary. */
  static async list(filters: TaskListFilterArgs, tasks: tasks_v1.Tasks) {
    const allTasks = await this._list(filters, tasks);
    const taskList = this.formatTaskList(allTasks);

    return {
      content: [{ type: "text" as const, text: `Found ${allTasks.length} tasks:\n${taskList}` }],
    };
  }

  /** Permanently deletes a task by ID from the specified task list. */
  static async delete(taskListId: string | undefined, taskId: string, tasks: tasks_v1.Tasks) {
    await tasks.tasks.delete({
      tasklist: taskListId || "@default",
      task: taskId,
    });

    return {
      content: [{ type: "text" as const, text: `Task ${taskId} deleted` }],
    };
  }

  /**
   * Searches for tasks whose title or notes contain the query string.
   * Performs a case-insensitive client-side filter over the results from {@link _list}.
   */
  static async search(query: string, filters: TaskListFilterArgs, tasks: tasks_v1.Tasks) {
    const allTasks = await this._list(filters, tasks);
    const filteredItems = allTasks.filter(
      (task) =>
        task.title?.toLowerCase().includes(query.toLowerCase()) ||
        task.notes?.toLowerCase().includes(query.toLowerCase()),
    );

    const taskList = this.formatTaskList(filteredItems);

    return {
      content: [{ type: "text" as const, text: `Found ${filteredItems.length} tasks:\n${taskList}` }],
    };
  }

  /** Removes all completed tasks from the specified task list. */
  static async clear(taskListId: string | undefined, tasks: tasks_v1.Tasks) {
    await tasks.tasks.clear({
      tasklist: taskListId || "@default",
    });

    return {
      content: [{ type: "text" as const, text: `Tasks from tasklist ${taskListId || "@default"} cleared` }],
    };
  }

  /**
   * Moves a task to a new position, parent, or destination task list.
   * Use `parent` to nest under another task, `previous` to reorder among siblings,
   * and `destinationTasklist` to move across task lists.
   */
  static async move(
    args: { taskListId: string; taskId: string; parent?: string; previous?: string; destinationTasklist?: string },
    tasks: tasks_v1.Tasks,
  ) {
    const moveParams: Record<string, any> = {
      tasklist: args.taskListId,
      task: args.taskId,
    };
    if (args.parent) moveParams.parent = args.parent;
    if (args.previous) moveParams.previous = args.previous;
    if (args.destinationTasklist) moveParams.destinationTasklist = args.destinationTasklist;

    const response = await tasks.tasks.move(moveParams);

    return {
      content: [{ type: "text" as const, text: `Task moved: ${response.data.title} (ID: ${response.data.id})` }],
    };
  }
}
