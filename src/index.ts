#!/usr/bin/env node

/**
 * MCP server for Google Tasks API integration.
 * Exposes tasks as MCP resources and provides tools for full CRUD
 * on both tasks and task lists, plus move and search operations.
 */

import { authenticateAndSaveCredentials } from "./auth.js";
import { startServer } from "./server.js";

if (process.argv[2] === "auth") {
  authenticateAndSaveCredentials().catch(console.error);
} else {
  startServer().catch(console.error);
}
