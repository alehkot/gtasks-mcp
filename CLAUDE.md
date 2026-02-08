# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP (Model Context Protocol) server for Google Tasks API integration. Allows AI assistants to manage tasks and task lists — search, list, create, update, delete, move, and clear. Published as `@modelcontextprotocol/server-gtasks`.

## Commands

- `npm run build` — Compile TypeScript and chmod dist output
- `npm run dev` — Watch mode (`tsc --watch`)
- `npm run start` — Run the server (`node dist/index.js`)
- `npm run start auth` — First-time OAuth authentication via browser
- `npm run lint:md` — Lint markdown files with markdownlint-cli2
- `npm run fix:md` — Auto-fix markdown lint issues

No test framework is configured.

## Workflows

- After editing any `.md` file, run `npm run fix:md` then `npm run lint:md` to ensure it passes.

## Architecture

Source files in `src/`:

- **index.ts** — Entry point. Dispatches to auth flow or server startup.
- **server.ts** — MCP server setup, tool/resource registration, stdio transport.
- **auth.ts** — OAuth2 authentication flow. Reads credentials from `.gtasks-server-credentials.json` and OAuth keys from `gcp-oauth.keys.json`.
- **helpers.ts** — Shared utilities (e.g. `MAX_TASK_RESULTS`).
- **services/TaskService.ts** — Task CRUD, search, move, and clear operations.
- **services/TaskListService.ts** — Task list CRUD operations.
- **resources/TaskResourceHandler.ts** — MCP resource protocol (`read()` and `list()` for `gtasks:///` URIs).

The server exposes 12 MCP tools (7 task + 5 task list) and task resources over stdio transport. Google Tasks API calls go through `googleapis` with OAuth2 credentials.

## Key Technical Details

- ES Modules (`"type": "module"` in package.json)
- TypeScript strict mode, target ES2022, module Node16
- Default task list ID is `@default` when not specified
- Credentials files (`.gtasks-server-credentials.json`, `gcp-oauth.keys.json`) are gitignored — never commit these
