# CLAUDE.md

This file provides guidance to Claude Code when working with this project.

## What This Project Does

CLI tool: paste a recipe `.txt` file, Claude extracts the shopping list, searches Swiggy Instamart for each ingredient, proposes a cart, and stages items after user confirmation. **It deliberately stops before checkout** — real-money placement is left to the user in the Swiggy app.

## Project Structure

```
src/
  index.js          # Entry point and main flow (read recipe → extract → search → confirm → stage)
  ingredients.js    # Claude API call to extract a shopping list from recipe text
  swiggyClient.js   # MCP client: connects to Swiggy, handles OAuth retry, wraps callTool()
  auth.js           # OAuth 2.1 + PKCE provider (SwiggyOAuthProvider), token/client-info persistence
recipes/
  example-brownies.txt   # Example recipe to test with
web/
  server/           # Express API wrapping src/*.js (4 endpoints, no duplicated logic) — see below
  client/           # Vite + React mobile-first demo GUI — see below
.auth/              # Gitignored — cached OAuth tokens, client info, PKCE verifier (auto-created), shared by CLI and web/server
```

## Running the Project

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start -- recipes/example-brownies.txt
```

On first run, Swiggy login is triggered via browser OAuth (phone + OTP). Tokens are cached in `.auth/` for ~5 days.

## Architecture

**Flow**: `index.js` orchestrates everything:
1. `extractIngredients()` (`ingredients.js`) — calls Claude API with tool use to parse the recipe into `{search_query, quantity_note}[]`
2. `connectSwiggy("instamart")` (`swiggyClient.js`) — connects to `https://mcp.swiggy.com/im` via MCP, handling OAuth automatically
3. `callTool(client, "search_products", ...)` — searches Instamart per ingredient, picks `products[0].variants[0]`
4. User confirms the proposed cart, then `callTool(client, "update_cart", ...)` stages items
5. `callTool(client, "get_cart")` prints the live cart and exits

**Claude integration** (`ingredients.js`): Uses `claude-sonnet-4-6` with forced tool use (`tool_choice: { type: "tool", name: "record_shopping_list" }`). The tool schema defines `search_query` and `quantity_note` per item.

**Swiggy MCP auth** (`auth.js`): `SwiggyOAuthProvider` implements the MCP SDK's `OAuthClientProvider` interface. Persists tokens to `.auth/tokens.json` and client info to `.auth/client-info.json`. No refresh token in Swiggy MCP v1 — re-prompts browser login when tokens expire.

**OAuth callback** (`swiggyClient.js`): `waitForOAuthCallback()` spins up a temporary HTTP server on `localhost:8787/callback` to receive the authorization code, then closes itself.

## Key Constraints

- **No checkout**: `checkout` tool is intentionally not called. The script stops after staging the cart.
- **First-match heuristic**: `search_products` returns many results; the script always picks `products[0].variants[0]`. It does not rank by relevance or price — user should review before confirming.
- **Quantities default to 1x each**: `update_cart` always sets `quantity: 1` regardless of the recipe's quantity note. The quantity note is display-only.
- **Swiggy Builders Club**: OAuth works on `localhost` without production approval. If client registration fails, email `builders@swiggy.in` to whitelist `http://localhost:8787/callback`.
- **ES modules**: `"type": "module"` in `package.json` — use `import/export`, not `require`.

## Dependencies

| Package | Purpose |
|---|---|
| `@anthropic-ai/sdk` | Ingredient extraction via Claude API |
| `@modelcontextprotocol/sdk` | MCP client for Swiggy tool calls |
| `open` | Opens browser for OAuth login |

## Web GUI (demo)

`web/` is a mobile-first demo GUI wrapping the same flow as `src/index.js`, built for showing the Swiggy Builders Club team — a local, single-user demo artifact, not a deployment. Full design/implementation history: `docs/superpowers/specs/2026-07-23-mobile-gui-design.md` and `docs/superpowers/plans/2026-07-24-mobile-gui.md`. Run instructions: [`web/README.md`](web/README.md).

**`web/server/index.js`** — thin Express wrapper, four endpoints, each a straight call into the existing `src/*.js` modules (no reimplemented logic):
- `POST /api/extract` → `extractIngredients()`
- `POST /api/connect` → `connectSwiggy()` + `get_addresses`
- `POST /api/search` → loops `search_products` per ingredient
- `POST /api/confirm` → `update_cart` + `get_cart`

Single module-level `mcpClient` — one connection for the whole server process, matching the CLI's single-session model. No auth/session isolation (fine for local single-user use, not multi-user-safe as-is).

**`web/client/src/`** — Vite + React, one component per wizard step, matching `App.jsx`'s 5-step state machine (`recipe → ingredients → loading → cart → done`):
`RecipeInput.jsx`, `IngredientsReview.jsx`, `Loading.jsx`, `ProposedCart.jsx`, `Done.jsx`, plus `api.js` (fetch wrappers) and `styles.css` (mobile-first, `#fc8019` Swiggy-orange accent, 400px content cap).

## Extending the Project

- **Add checkout**: In `src/index.js`, after `get_cart`, call `callTool(client, "checkout", { paymentMethod: "COD" })` — but guard it with a hard confirmation prompt. Same applies to `web/server/index.js`'s `/api/confirm` if extending the web flow.
- **Other Swiggy verticals**: `SERVERS` in `swiggyClient.js` maps server names to MCP URLs. Add `/food` or `/dineout` entries there.

## Swiggy Builders Club

When writing code against Swiggy MCP (Food, Instamart, Dineout),
consult the authoritative docs at:

- Index:     https://mcp.swiggy.com/builders/llms.txt
- Full text: https://mcp.swiggy.com/builders/llms-full.txt
- Per-page:  append `.md` to any https://mcp.swiggy.com/builders/docs/... URL

Before recommending a tool name, parameter, error code, rate limit, or
auth flow, verify against these docs. The tool catalog lives under
`/docs/reference/{food,instamart,dineout}`.

## Available Skills

Invoke skills via the `Skill` tool before acting.

| Skill | When to use |
|---|---|
| `superpowers:brainstorming` | Before any new feature or behavior change |
| `superpowers:writing-plans` | When given a spec or multi-step task, before touching code |
| `superpowers:systematic-debugging` | Before proposing any fix for a bug |
| `superpowers:test-driven-development` | Before writing implementation code |
| `superpowers:verification-before-completion` | Before claiming work is done |
| `claude-api` | When modifying `ingredients.js` or anything using `@anthropic-ai/sdk` |
| `code-review` | To review current diff for bugs and improvements |
