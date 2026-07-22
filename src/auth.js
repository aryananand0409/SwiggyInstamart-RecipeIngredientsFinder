// OAuth 2.1 + PKCE client provider for Swiggy MCP.
//
// Swiggy MCP has no API key. Every call is authorized via OAuth 2.1 with PKCE.
// The MCP SDK's StreamableHTTPClientTransport handles the PKCE + dynamic
// client registration dance automatically as long as we hand it an object
// that implements OAuthClientProvider (persisting client info, tokens, and
// the PKCE code verifier). This file is that object.
//
// Tokens live 5 days and there is no refresh token in Swiggy MCP v1.0, so we
// persist them to disk and just re-run the browser login when they expire.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "..", ".auth");
const TOKENS_FILE = path.join(AUTH_DIR, "tokens.json");
const CLIENT_INFO_FILE = path.join(AUTH_DIR, "client-info.json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export class SwiggyOAuthProvider {
  constructor(redirectUrl, onRedirect) {
    this._redirectUrl = redirectUrl;
    this._onRedirect = onRedirect;
    this._codeVerifier = undefined;
  }

  get redirectUrl() {
    return this._redirectUrl;
  }

  get clientMetadata() {
    return {
      client_name: "Recipe -> Instamart Cart (personal project)",
      redirect_uris: [this._redirectUrl],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  clientInformation() {
    return readJson(CLIENT_INFO_FILE);
  }

  saveClientInformation(clientInformation) {
    writeJson(CLIENT_INFO_FILE, clientInformation);
  }

  tokens() {
    return readJson(TOKENS_FILE);
  }

  saveTokens(tokens) {
    writeJson(TOKENS_FILE, { ...tokens, _savedAt: Date.now() });
  }

  redirectToAuthorization(authorizationUrl) {
    this._onRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier) {
    this._codeVerifier = codeVerifier;
    writeJson(path.join(AUTH_DIR, "code-verifier.json"), { codeVerifier });
  }

  codeVerifier() {
    if (this._codeVerifier) return this._codeVerifier;
    const stored = readJson(path.join(AUTH_DIR, "code-verifier.json"));
    if (!stored) throw new Error("No PKCE code verifier available");
    return stored.codeVerifier;
  }
}

export function clearStoredAuth() {
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
