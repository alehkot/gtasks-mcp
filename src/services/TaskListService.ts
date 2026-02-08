import { tasks_v1 } from "googleapis";
import { MAX_TASK_RESULTS, textResponse } from "../helpers.js";

/**
 * MCP tool handlers for Google Tasks task list management.
 * Wraps the `tasklists.*` endpoints of the Google Tasks API.
 */
export class TaskListService {
  constructor(private readonly client: tasks_v1.Tasks) {}

  /** Lists all task lists for the authenticated user. */
  async list() {
    const response = await this.client.tasklists.list({
      maxResults: MAX_TASK_RESULTS,
    });
    const taskLists = response.data.items || [];
    const formatted = taskLists
      .map((tl) => `${tl.title} - ID: ${tl.id} - Updated: ${tl.updated}`)
      .join("\n");
    return textResponse(`Found ${taskLists.length} task lists:\n${formatted}`);
  }

  /** Retrieves a single task list by its ID. */
  async get(taskListId: string) {
    const response = await this.client.tasklists.get({ tasklist: taskListId });
    const tl = response.data;
    return textResponse(`Title: ${tl.title}\nID: ${tl.id}\nUpdated: ${tl.updated}\nKind: ${tl.kind}\nETag: ${tl.etag}`);
  }

  /** Creates a new task list with the given title. */
  async create(title: string) {
    const response = await this.client.tasklists.insert({ requestBody: { title } });
    return textResponse(`Task list created: ${response.data.title} (ID: ${response.data.id})`);
  }

  /** Updates an existing task list's title. */
  async update(taskListId: string, title: string | undefined) {
    const response = await this.client.tasklists.update({
      tasklist: taskListId,
      requestBody: { title },
    });
    return textResponse(`Task list updated: ${response.data.title}`);
  }

  /** Permanently deletes a task list and all its tasks. */
  async delete(taskListId: string) {
    await this.client.tasklists.delete({ tasklist: taskListId });
    return textResponse(`Task list ${taskListId} deleted`);
  }
}
