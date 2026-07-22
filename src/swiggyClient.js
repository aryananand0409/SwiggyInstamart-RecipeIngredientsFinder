import { createServer } from "node:http";
import { URL } from "node:url";
import open from "open";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { SwiggyOAuthProvider } from "./auth.js";

const CALLBACK_PORT = 8787;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

// Instamart is the grocery server. Food and Dineout live at /food and
// /dineout on the same host if this ever needs to grow.
const SERVERS = {
  instamart: "https://mcp.swiggy.com/im",
};

function waitForOAuthCallback() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === "/favicon.ico") {
        res.writeHead(404);
        res.end();
        return;
      }
      const parsed = new URL(req.url || "", "http://localhost");
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error");

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Logged in.</h1><p>You can close this tab and go back to the terminal.</p></body></html>");
        resolve(code);
        setTimeout(() => server.close(), 1000);
      } else {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<html><body><h1>Login failed</h1><p>${error ?? "unknown error"}</p></body></html>`);
        reject(new Error(`Swiggy authorization failed: ${error ?? "no code returned"}`));
      }
    });
    server.listen(CALLBACK_PORT);
  });
}

async function connectWithAuth(client, url, oauthProvider) {
  // A fresh transport per attempt: StreamableHTTPClientTransport.start()
  // (called internally by client.connect()) throws if called twice on the
  // same instance, so the retry after finishAuth() can't reuse the one from
  // the failed attempt. Auth state (PKCE verifier, tokens) lives on
  // oauthProvider/disk, not the transport, so recreating it loses nothing —
  // mirrors the MCP SDK's own OAuth client example.
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    authProvider: oauthProvider,
  });
  try {
    await client.connect(transport);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      console.log("\nOpening your browser to log in to Swiggy (phone + OTP)...");
      console.log("If it doesn't open automatically, visit the URL printed above.\n");
      const callbackPromise = waitForOAuthCallback();
      const authCode = await callbackPromise;
      await transport.finishAuth(authCode);
      // Reconnect now that we have tokens.
      await connectWithAuth(client, url, oauthProvider);
      return;
    }
    throw err;
  }
}

/**
 * Connects to a Swiggy MCP server, handling first-time OAuth login and
 * reusing saved tokens on subsequent runs.
 * @param {"instamart"} serverName
 * @returns {Promise<Client>}
 */
export async function connectSwiggy(serverName = "instamart") {
  const url = SERVERS[serverName];
  if (!url) throw new Error(`Unknown Swiggy server: ${serverName}`);

  const oauthProvider = new SwiggyOAuthProvider(CALLBACK_URL, (authUrl) => {
    console.log(`\nOpen this URL to log in to Swiggy:\n  ${authUrl.toString()}\n`);
    open(authUrl.toString()).catch(() => {
      // Headless environment or no default browser handler — the printed
      // URL above is enough for the user to open manually.
    });
  });

  const client = new Client({ name: "recipe-cart-agent", version: "1.0.0" }, { capabilities: {} });
  await connectWithAuth(client, url, oauthProvider);
  return client;
}

/** Thin wrapper so call sites read like `callTool(client, "search_products", {...})`. */
export async function callTool(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const message = result.content?.map((c) => c.text).join(" ") ?? "Unknown tool error";
    throw new Error(`${name} failed: ${message}`);
  }
  // Machine-readable payload lives in structuredContent ({ success, data }).
  // `content` is a human-readable summary meant for chat/UI display and
  // isn't guaranteed to be JSON (e.g. get_addresses returns prose there).
  if (result.structuredContent) return result.structuredContent;
  const text = result.content?.find((c) => c.type === "text")?.text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
