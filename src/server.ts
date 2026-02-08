import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAuthenticatedClient } from "./auth.js";
import { TaskResourceHandler } from "./resources/TaskResourceHandler.js";
import { TaskListService } from "./services/TaskListService.js";
import { TaskService } from "./services/TaskService.js";

/**
 * Shared Zod schema for task filtering parameters.
 * Spread into any tool that lists or searches tasks.
 */
const taskFilterSchema = {
  taskListId: z.string().describe("Task list ID. If omitted, tasks from all lists are returned.").optional(),
  showCompleted: z.boolean().describe("Whether to include completed tasks. Default: true.").optional(),
  showHidden: z.boolean().describe("Whether to include hidden tasks. Default: true.").optional(),
  showDeleted: z.boolean().describe("Whether to include deleted tasks. Default: false.").optional(),
  showAssigned: z.boolean().describe("Whether to include assigned tasks. Default: true.").optional(),
  completedMin: z.string().describe("Lower bound for task completion date (RFC 3339 timestamp).").optional(),
  completedMax: z.string().describe("Upper bound for task completion date (RFC 3339 timestamp).").optional(),
  dueMin: z.string().describe("Lower bound for task due date (RFC 3339 timestamp).").optional(),
  dueMax: z.string().describe("Upper bound for task due date (RFC 3339 timestamp).").optional(),
  updatedMin: z.string().describe("Lower bound for task last modification time (RFC 3339 timestamp).").optional(),
};

/** Creates the MCP server, registers all tools and resources, and starts the stdio transport. */
export async function startServer() {
  const client = createAuthenticatedClient();
  const taskService = new TaskService(client);
  const taskListService = new TaskListService(client);
  const resourceHandler = new TaskResourceHandler(client);

  const server = new McpServer({
    name: "example-servers/gtasks",
    version: "0.1.0",
  });

  server.registerResource(
    "task",
    new ResourceTemplate("gtasks:///{taskId}", {
      list: async () => {
        const [allTasks] = await resourceHandler.list();
        return {
          resources: allTasks.map((task) => ({
            uri: `gtasks:///${task.id}`,
            mimeType: "text/plain",
            name: task.title || "Untitled",
          })),
        };
      },
    }),
    { mimeType: "text/plain" },
    async (uri, variables) => {
      const taskId = variables.taskId as string;
      const task = await resourceHandler.read(taskId);

      const taskDetails = [
        `Title: ${task.title || "No title"}`,
        `Status: ${task.status || "Unknown"}`,
        `Due: ${task.due || "Not set"}`,
        `Notes: ${task.notes || "No notes"}`,
        `Hidden: ${task.hidden || "Unknown"}`,
        `Parent: ${task.parent || "Unknown"}`,
        `Deleted?: ${task.deleted || "Unknown"}`,
        `Completed Date: ${task.completed || "Unknown"}`,
        `Position: ${task.position || "Unknown"}`,
        `ETag: ${task.etag || "Unknown"}`,
        `Links: ${task.links || "Unknown"}`,
        `Kind: ${task.kind || "Unknown"}`,
        `Updated: ${task.updated || "Unknown"}`,
      ].join("\n");

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: taskDetails,
          },
        ],
      };
    },
  );

  server.registerTool(
    "search",
    {
      description: "Search for a task in Google Tasks",
      inputSchema: {
        query: z.string().describe("Search query"),
        ...taskFilterSchema,
      },
    },
    async ({ query, ...filters }) => taskService.search(query, filters),
  );

  server.registerTool(
    "list",
    {
      description: "List all tasks in Google Tasks",
      inputSchema: {
        cursor: z.string().describe("Cursor for pagination").optional(),
        ...taskFilterSchema,
      },
    },
    async ({ cursor, ...filters }) => taskService.list(filters),
  );

  server.registerTool(
    "create",
    {
      description: "Create a new task in Google Tasks",
      inputSchema: {
        taskListId: z.string().describe("Task list ID").optional(),
        title: z.string().describe("Task title"),
        notes: z.string().describe("Task notes").optional(),
        due: z.string().describe("Due date").optional(),
        parent: z.string().describe("Parent task ID. If set, the new task becomes a subtask.").optional(),
        previous: z.string().describe("Previous sibling task ID. New task is placed after this one.").optional(),
      },
    },
    async (args) => taskService.create(args),
  );

  server.registerTool(
    "clear",
    {
      description: "Clear completed tasks from a Google Tasks task list",
      inputSchema: {
        taskListId: z.string().describe("Task list ID"),
      },
    },
    async ({ taskListId }) => taskService.clear(taskListId),
  );

  server.registerTool(
    "delete",
    {
      description: "Delete a task in Google Tasks",
      inputSchema: {
        taskListId: z.string().describe("Task list ID"),
        id: z.string().describe("Task id"),
      },
    },
    async ({ taskListId, id }) => taskService.delete(taskListId, id),
  );

  server.registerTool(
    "update",
    {
      description: "Update an existing task in Google Tasks",
      inputSchema: {
        taskListId: z.string().describe("Task list ID").optional(),
        id: z.string().describe("Task ID"),
        title: z.string().describe("Task title").optional(),
        notes: z.string().describe("Task notes").optional(),
        status: z.enum(["needsAction", "completed"]).describe("Task status (needsAction or completed)").optional(),
        due: z.string().describe("Due date").optional(),
      },
    },
    async (args) => taskService.update(args),
  );

  server.registerTool(
    "list_task_lists",
    {
      description: "List all task lists in Google Tasks",
    },
    async () => taskListService.list(),
  );

  server.registerTool(
    "get_task_list",
    {
      description: "Get a specific task list by ID",
      inputSchema: {
        taskListId: z.string().describe("Task list ID"),
      },
    },
    async ({ taskListId }) => taskListService.get(taskListId),
  );

  server.registerTool(
    "create_task_list",
    {
      description: "Create a new task list in Google Tasks",
      inputSchema: {
        title: z.string().describe("Task list title"),
      },
    },
    async ({ title }) => taskListService.create(title),
  );

  server.registerTool(
    "update_task_list",
    {
      description: "Update an existing task list in Google Tasks",
      inputSchema: {
        taskListId: z.string().describe("Task list ID"),
        title: z.string().describe("New title for the task list").optional(),
      },
    },
    async ({ taskListId, title }) => taskListService.update(taskListId, title),
  );

  server.registerTool(
    "delete_task_list",
    {
      description: "Delete a task list in Google Tasks",
      inputSchema: {
        taskListId: z.string().describe("Task list ID"),
      },
    },
    async ({ taskListId }) => taskListService.delete(taskListId),
  );

  server.registerTool(
    "move_task",
    {
      description: "Move a task to a different position or parent within a task list, or to a different task list",
      inputSchema: {
        taskListId: z.string().describe("Source task list ID"),
        taskId: z.string().describe("Task ID to move"),
        parent: z.string().describe("New parent task ID. Omit to move to top level.").optional(),
        previous: z.string().describe("Previous sibling task ID. Task is placed after this one.").optional(),
        destinationTasklist: z.string().describe("Destination task list ID. Omit to stay in the same list.").optional(),
      },
    },
    async (args) => taskService.move(args),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
