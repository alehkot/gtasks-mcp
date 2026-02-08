# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP (Model Context Protocol) server for Google Tasks API integration. Allows AI assistants to list, search, create, update, and delete Google Tasks. Published as `@modelcontextprotocol/server-gtasks`.

## Commands

- `npm run build` — Compile TypeScript and chmod dist output
- `npm run dev` — Watch mode (`tsc --watch`)
- `npm run start` — Run the server (`node dist/index.js`)
- `npm run start auth` — First-time OAuth authentication via browser

No test framework or linter is configured.

## Architecture

Two source files in `src/`:

- **index.ts** — MCP server setup, OAuth2 authentication flow, request handler registration (resources + tools), stdio transport. Reads credentials from `.gtasks-server-credentials.json` and OAuth keys from `gcp-oauth.keys.json`.
- **Tasks.ts** — Business logic in two classes:
  - `TaskResources` — `read()` and `list()` for MCP resource protocol (URIs like `gtasks:///taskId`)
  - `TaskActions` — `search()`, `list()`, `create()`, `update()`, `delete()`, `clear()` for MCP tool protocol

The server exposes 6 MCP tools and task resources over stdio transport. Google Tasks API calls go through `googleapis` with OAuth2 credentials. `MAX_TASK_RESULTS` is 100.

## Key Technical Details

- ES Modules (`"type": "module"` in package.json)
- TypeScript strict mode, target ES2022, module Node16
- Default task list ID is `@default` when not specified
- Credentials files (`.gtasks-server-credentials.json`, `gcp-oauth.keys.json`) are gitignored — never commit these
