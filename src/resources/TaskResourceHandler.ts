import { tasks_v1 } from "googleapis";
import { MAX_TASK_RESULTS } from "../helpers.js";

/**
 * Handles MCP resource protocol operations for Google Tasks.
 * Provides read and list capabilities for exposing tasks as MCP resources.
 */
export class TaskResourceHandler {
  constructor(private readonly client: tasks_v1.Tasks) {}

  /**
   * Finds a task by ID across all task lists.
   * Searches every task list in parallel since the Google Tasks API
   * requires a task list ID to fetch a task.
   *
   * @throws {Error} If the task is not found in any task list.
   */
  async read(taskId: string) {
    const taskListsResponse = await this.client.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];

    const results = await Promise.allSettled(
      taskLists
        .filter((tl) => tl.id)
        .map((taskList) =>
          this.client.tasks.get({ tasklist: taskList.id!, task: taskId }),
        ),
    );

    const found = results.find((r) => r.status === "fulfilled");

    if (!found || found.status !== "fulfilled") {
      throw new Error("Task not found");
    }

    return found.value.data;
  }

  /**
   * Lists tasks from all task lists with pagination support.
   * @returns A tuple of [tasks, nextPageToken] for cursor-based pagination.
   */
  async list(cursor?: string): Promise<[tasks_v1.Schema$Task[], string | null]> {
    const pageSize = 10;
    const params: { maxResults: number; pageToken?: string } = {
      maxResults: pageSize,
    };

    if (cursor) {
      params.pageToken = cursor;
    }

    const taskListsResponse = await this.client.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });

    const taskLists = taskListsResponse.data.items || [];

    const responses = await Promise.allSettled(
      taskLists
        .filter((tl) => tl.id)
        .map((taskList) =>
          this.client.tasks.list({ tasklist: taskList.id!, ...params }),
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
