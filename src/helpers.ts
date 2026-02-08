import { tasks_v1 } from "googleapis";

/** Maximum number of results to request per Google Tasks API call. */
export const MAX_TASK_RESULTS = 100;

/** Number of tasks returned per paginated response. */
export const TASK_PAGE_SIZE = 20;

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

/** Wraps a plain string into the MCP text-content response shape. */
export function textResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export interface PaginationMetadata {
  pageSize: number;
  total: number;
  offset: number;
  returned: number;
  nextCursor: string | null;
}

/** Wraps text plus pagination metadata as a plain text MCP response. */
export function paginatedTextResponse(text: string, pagination: PaginationMetadata) {
  return {
    content: [{ type: "text" as const, text: `${text}\n\n${JSON.stringify({ pagination })}` }],
  };
}

/** Formats a single task into a human-readable string with all fields. */
export function formatTask(task: tasks_v1.Schema$Task) {
  return `${task.title}\n (Due: ${task.due || "Not set"}) - Notes: ${task.notes} - ID: ${task.id} - Status: ${task.status} - URI: ${task.selfLink} - Hidden: ${task.hidden} - Parent: ${task.parent} - Deleted?: ${task.deleted} - Completed Date: ${task.completed} - Position: ${task.position} - Updated Date: ${task.updated} - ETag: ${task.etag} - Links: ${task.links} - Kind: ${task.kind}}`;
}

/** Formats an array of tasks into a newline-separated string. */
export function formatTaskList(tasks: tasks_v1.Schema$Task[]) {
  return tasks.map((task) => formatTask(task)).join("\n");
}

/** Builds Google Tasks API list parameters from filter args. */
export function buildListParams(filters: TaskListFilterArgs): Record<string, any> {
  const params: Record<string, any> = {
    maxResults: MAX_TASK_RESULTS,
  };
  if (filters.showCompleted !== undefined) params.showCompleted = filters.showCompleted;
  if (filters.showHidden !== undefined) params.showHidden = filters.showHidden;
  if (filters.showDeleted !== undefined) params.showDeleted = filters.showDeleted;
  if (filters.showAssigned !== undefined) params.showAssigned = filters.showAssigned;
  if (filters.completedMin) params.completedMin = filters.completedMin;
  if (filters.completedMax) params.completedMax = filters.completedMax;
  if (filters.dueMin) params.dueMin = filters.dueMin;
  if (filters.dueMax) params.dueMax = filters.dueMax;
  if (filters.updatedMin) params.updatedMin = filters.updatedMin;
  return params;
}
