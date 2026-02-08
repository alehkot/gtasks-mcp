#!/usr/bin/env node

/**
 * MCP server for Google Tasks API integration.
 * Exposes tasks as MCP resources and provides tools for full CRUD
 * on both tasks and task lists, plus move and search operations.
 */

import { authenticate } from "@google-cloud/local-auth";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import { google } from "googleapis";
import path from "path";
import { z } from "zod";
import { TaskActions, TaskListActions, TaskResources } from "./Tasks.js";

const googleTasks = google.tasks("v1");

const server = new McpServer({
  name: "example-servers/gtasks",
  version: "0.1.0",
});

server.registerResource(
  "task",
  new ResourceTemplate("gtasks:///{taskId}", {
    list: async () => {
      const [allTasks] = await TaskResources.list(googleTasks);
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
    const task = await TaskResources.read(taskId, googleTasks);

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

server.registerTool(
  "search",
  {
    description: "Search for a task in Google Tasks",
    inputSchema: {
      query: z.string().describe("Search query"),
      ...taskFilterSchema,
    },
  },
  async ({ query, ...filters }) => TaskActions.search(query, filters, googleTasks),
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
  async ({ cursor, ...filters }) => TaskActions.list(filters, googleTasks),
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
  async (args) => TaskActions.create(args, googleTasks),
);

server.registerTool(
  "clear",
  {
    description: "Clear completed tasks from a Google Tasks task list",
    inputSchema: {
      taskListId: z.string().describe("Task list ID"),
    },
  },
  async ({ taskListId }) => TaskActions.clear(taskListId, googleTasks),
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
  async ({ taskListId, id }) => TaskActions.delete(taskListId, id, googleTasks),
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
  async (args) => TaskActions.update(args, googleTasks),
);

server.registerTool(
  "list_task_lists",
  {
    description: "List all task lists in Google Tasks",
  },
  async () => TaskListActions.list(googleTasks),
);

server.registerTool(
  "get_task_list",
  {
    description: "Get a specific task list by ID",
    inputSchema: {
      taskListId: z.string().describe("Task list ID"),
    },
  },
  async ({ taskListId }) => TaskListActions.get(taskListId, googleTasks),
);

server.registerTool(
  "create_task_list",
  {
    description: "Create a new task list in Google Tasks",
    inputSchema: {
      title: z.string().describe("Task list title"),
    },
  },
  async ({ title }) => TaskListActions.create(title, googleTasks),
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
  async ({ taskListId, title }) => TaskListActions.update(taskListId, title, googleTasks),
);

server.registerTool(
  "delete_task_list",
  {
    description: "Delete a task list in Google Tasks",
    inputSchema: {
      taskListId: z.string().describe("Task list ID"),
    },
  },
  async ({ taskListId }) => TaskListActions.delete(taskListId, googleTasks),
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
  async (args) => TaskActions.move(args, googleTasks),
);

// --- Auth & Startup ---

const baseDir = path.dirname(new URL(import.meta.url).pathname);
const credentialsPath = path.join(baseDir, "../.gtasks-server-credentials.json");
const oauthKeysPath = path.join(baseDir, "../gcp-oauth.keys.json");

/** Reads OAuth client ID and secret from the GCP keys file. */
function loadOAuthKeys(): { clientId: string; clientSecret: string } {
  const keysContent = JSON.parse(fs.readFileSync(oauthKeysPath, "utf-8"));
  const key = keysContent.installed || keysContent.web;
  if (!key) {
    throw new Error("Invalid OAuth keys file: missing 'installed' or 'web' key");
  }
  return { clientId: key.client_id, clientSecret: key.client_secret };
}

/** Runs the interactive OAuth browser flow and persists the resulting tokens. */
async function authenticateAndSaveCredentials() {
  console.log("Launching auth flow…");
  const auth = await authenticate({
    keyfilePath: oauthKeysPath,
    scopes: ["https://www.googleapis.com/auth/tasks"],
  });
  fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
  console.log("Credentials saved. You can now run the server.");
}

/** Loads saved OAuth credentials, configures auto-refresh, and starts the MCP server over stdio. */
async function loadCredentialsAndRunServer() {
  if (!fs.existsSync(credentialsPath)) {
    console.error(
      "Credentials not found. Please run with 'auth' argument first.",
    );
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
  const { clientId, clientSecret } = loadOAuthKeys();

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials(credentials);

  auth.on("tokens", (newTokens) => {
    const merged = { ...credentials, ...newTokens };
    fs.writeFileSync(credentialsPath, JSON.stringify(merged));
  });

  google.options({ auth });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  loadCredentialsAndRunServer().catch(console.error);
}
