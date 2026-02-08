# Google Tasks MCP Server

An [MCP](https://modelcontextprotocol.io/) server for the Google Tasks API. Manage tasks and task lists from any MCP-compatible client — search, create, update, delete, move, and more.

## Features

### Task tools

| Tool | Description |
|------|-------------|
| `search` | Full-text search across tasks with filtering by status, dates, and task list (paginated, 20 per page) |
| `list` | List tasks with filtering (paginated, 20 per page) |
| `create` | Create a task (optionally as a subtask or at a specific position) |
| `update` | Update title, notes, status, or due date |
| `delete` | Delete a task |
| `clear` | Clear all completed tasks from a task list |
| `move_task` | Move a task to a different position, parent, or task list |

`list` and `search` return at most 20 tasks per call. When more results are available, the response includes a `Next cursor` value; pass it back as `cursor` to fetch the next page.
For programmatic MCP consumers, the pagination token is available at `structuredContent.pagination.nextCursor` (or `null` when there is no next page).

### Task list tools

| Tool | Description |
|------|-------------|
| `list_task_lists` | List all task lists |
| `get_task_list` | Get a task list by ID |
| `create_task_list` | Create a new task list |
| `update_task_list` | Rename a task list |
| `delete_task_list` | Delete a task list |

### Resources

Individual tasks are exposed as MCP resources via `gtasks:///<task_id>`, supporting both listing and reading.

## Setup

### 1. Google Cloud credentials

1. [Create a Google Cloud project](https://console.cloud.google.com/projectcreate)
2. [Enable the Google Tasks API](https://console.cloud.google.com/workspace-api/products)
3. In [Google Auth Platform](https://console.cloud.google.com/apis/credentials/consent), configure OAuth:
   - Set **User type** to **External**
   - Add your email under **Test users**
4. Add scope `https://www.googleapis.com/auth/tasks`
5. [Create an OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) (type: **Desktop app**)
6. Download the JSON key file, rename it to `gcp-oauth.keys.json`, and place it in the project root

### 2. Build

```bash
npm install && npm run build
```

### 3. Authenticate

```bash
npm run start auth
```

This opens a browser-based OAuth flow. Credentials are saved to `.gtasks-server-credentials.json`.

### 4. Connect to an MCP client

**Claude Code**

```bash
claude mcp add --scope user gtasks node "$(pwd)/dist/index.js"
```

**Codex**

```bash
codex mcp add gtasks -- node "$(pwd)/dist/index.js"
```

**Claude Desktop / other MCP clients**

Add to your client's server configuration:

```json
{
  "mcpServers": {
    "gtasks": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"]
    }
  }
}
```

## Acknowledgements

Forked from [zcaceres/gtasks-mcp](https://github.com/zcaceres/gtasks-mcp) and largely rewritten — expanded API coverage, modular architecture, and task list management.
