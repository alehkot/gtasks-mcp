# Google Tasks MCP Server

![gtasks mcp logo](./logo.jpg)
[![smithery badge](https://smithery.ai/badge/@zcaceres/gtasks)](https://smithery.ai/server/@zcaceres/gtasks)

This MCP server integrates with Google Tasks to allow listing, reading, searching, creating, updating, and deleting tasks.

## Components

### Tools

- **search**
  - Search for tasks in Google Tasks
  - Input: `query` (string): Search query
  - Returns matching tasks with details

- **list**
  - List all tasks in Google Tasks
  - Optional input: `cursor` (string): Cursor for pagination
  - Returns a list of all tasks

- **create**
  - Create a new task in Google Tasks
  - Input:
    - `taskListId` (string, optional): Task list ID
    - `title` (string, required): Task title
    - `notes` (string, optional): Task notes
    - `due` (string, optional): Due date
  - Returns confirmation of task creation

- **update**
  - Update an existing task in Google Tasks
  - Input:
    - `taskListId` (string, optional): Task list ID
    - `id` (string, required): Task ID
    - `uri` (string, required): Task URI
    - `title` (string, optional): New task title
    - `notes` (string, optional): New task notes
    - `status` (string, optional): New task status ("needsAction" or "completed")
    - `due` (string, optional): New due date
  - Returns confirmation of task update

- **delete**
  - Delete a task in Google Tasks
  - Input:
    - `taskListId` (string, required): Task list ID
    - `id` (string, required): Task ID
  - Returns confirmation of task deletion

- **clear**
  - Clear completed tasks from a Google Tasks task list
  - Input: `taskListId` (string, required): Task list ID
  - Returns confirmation of cleared tasks

### Resources

The server provides access to Google Tasks resources:

- **Tasks** (`gtasks:///<task_id>`)
  - Represents individual tasks in Google Tasks
  - Supports reading task details including title, status, due date, notes, and other metadata
  - Can be listed, read, created, updated, and deleted using the provided tools

## Getting started

1. [Create a new Google Cloud project](https://console.cloud.google.com/projectcreate)
2. [Enable the Google Tasks API](https://console.cloud.google.com/workspace-api/products)
3. In [Google Auth Platform](https://console.cloud.google.com/apis/credentials/consent), configure OAuth for testing:
   - Set **User type** to **External** (required for personal/non-Workspace Google accounts)
   - Add your own email address under **Test users**
4. Add scope `https://www.googleapis.com/auth/tasks`
5. [Create an OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) with application type **Desktop app**
6. Download the JSON file of your OAuth client keys
7. Rename the key file to `gcp-oauth.keys.json` and place it in the root of this repo (i.e. `gcp-oauth.keys.json`)

Make sure to build the server with either `npm run build` or `npm run watch`.

### Installing via Smithery

To install Google Tasks Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@zcaceres/gtasks):

```bash
npx -y @smithery/cli install @zcaceres/gtasks --client claude
```

### Installing locally for Claude Code

Clone the repo, run `npm install && npm run build`, then:

```bash
claude mcp add --scope user gtasks node "$(pwd)/dist/index.js"
```

### Installing locally for Codex agent (user-scoped)

Clone the repo, run `npm install && npm run build`, then run:

```bash
codex mcp add gtasks -- node "$(pwd)/dist/index.js"
```

This adds the server to your user config (`~/.codex/config.toml`), not project-scoped `.codex/config.toml`.

### Authentication

To authenticate and save credentials:

1. Run the server with the `auth` argument: `npm run start auth`
2. This will open an authentication flow in your system browser
3. Complete the authentication process
4. Credentials will be saved in the root of this repo (i.e. `.gdrive-server-credentials.json`)

### Usage with Desktop App

To integrate this server with the desktop app, add the following to your app's server configuration:

```json
{
  "mcpServers": {
    "gtasks": {
      "command": "/opt/homebrew/bin/node",
      "args": [
        "{ABSOLUTE PATH TO FILE HERE}/dist/index.js"
      ]
    }
  }
}
```
