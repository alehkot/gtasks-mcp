# AGENTS.md

Guidance for coding agents working in this repository.

## Project summary

- Repository: `@modelcontextprotocol/server-gtasks`
- Purpose: MCP server for Google Tasks API (tasks + task lists + task resources)
- Runtime: Node.js + TypeScript (ESM), stdio MCP transport
- Entry point: `src/index.ts` (compiled to `dist/index.js`)

## Current commands

- `npm install` — install dependencies
- `npm run build` — compile TypeScript and make `dist/*.js` executable
- `npm run dev` — TypeScript watch mode
- `npm run start` — start MCP server (`node dist/index.js`)
- `npm run start auth` — run interactive OAuth flow and persist credentials
- `npm run lint:md` — lint markdown
- `npm run fix:md` — auto-fix markdown lint issues

There is no unit/integration test framework configured right now.

## Authentication and secrets

- OAuth keys are expected at `gcp-oauth.keys.json` in project root.
- User tokens are written to `.gtasks-server-credentials.json`.
- Both files are ignored by git and must never be committed.
- If credentials are missing, server startup exits with an error and asks for `auth` flow first.

## MCP surface

### Tools

- Task tools: `search`, `list`, `create`, `update`, `delete`, `clear`, `move_task`
- Task list tools: `list_task_lists`, `get_task_list`, `create_task_list`, `update_task_list`, `delete_task_list`

### Resources

- Resource template: `gtasks:///{taskId}`
- Resource handler supports task `read` by ID and `list` across all task lists.

## Code layout

- `src/index.ts` — CLI dispatch (`auth` vs normal server startup)
- `src/server.ts` — MCP server setup, tool/resource registration, stdio transport
- `src/auth.ts` — OAuth flow, token persistence, authenticated Google client creation
- `src/helpers.ts` — shared response helpers, list filter typing, formatting utilities
- `src/services/TaskService.ts` — task operations (list/search/create/update/delete/clear/move)
- `src/services/TaskListService.ts` — task list CRUD operations
- `src/resources/TaskResourceHandler.ts` — resource `read`/`list` support

## Working conventions

- Keep request/response logic for Google Tasks API in `services/` and `resources/`.
- Keep tool and schema registration centralized in `src/server.ts`.
- Use `textResponse()` from `src/helpers.ts` for tool text outputs.
- Respect `MAX_TASK_RESULTS` constant for list operations unless intentionally changing behavior.

## Validation expectations

- For code changes: run `npm run build`.
- For markdown changes: run `npm run fix:md` then `npm run lint:md`.
- Since there are no automated tests, include manual verification notes in PR/commit summaries when behavior changes.
