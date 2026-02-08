import { authenticate } from "@google-cloud/local-auth";
import fs from "fs";
import { google, tasks_v1 } from "googleapis";
import path from "path";

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
export async function authenticateAndSaveCredentials() {
  console.log("Launching auth flow…");
  const auth = await authenticate({
    keyfilePath: oauthKeysPath,
    scopes: ["https://www.googleapis.com/auth/tasks"],
  });
  fs.writeFileSync(credentialsPath, JSON.stringify(auth.credentials));
  console.log("Credentials saved. You can now run the server.");
}

/**
 * Loads saved OAuth credentials, configures auto-refresh, and returns
 * an authenticated Google Tasks API client.
 */
export function createAuthenticatedClient(): tasks_v1.Tasks {
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

  return google.tasks("v1");
}
