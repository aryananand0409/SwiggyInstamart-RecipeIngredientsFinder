# Mobile GUI for Recipe → Instamart Cart (Demo MVP)

## Purpose

The existing CLI (`src/index.js`) works end-to-end: paste a recipe, extract ingredients via Claude, search Swiggy Instamart, stage a cart. This spec covers a **web GUI** wrapping that same flow, built to demo live (screen-share or recording) to the Swiggy Builders Club team.

This is explicitly a **demo artifact**, not a production app:
- Single local user (you), run via `npm run dev`, no deployment.
- No multi-user auth, no session persistence beyond one browser tab.
- Reuses all existing backend logic unchanged — no duplicated business logic.

## Non-goals

- No production deployment or hosting.
- No multi-user support / auth beyond the existing single-account Swiggy OAuth.
- No automated test suite for the GUI (matches this project's existing convention of no test framework; verified by manual run instead).
- No change to `src/index.js` or the CLI flow — it keeps working as-is.

## Architecture

```
swiggy-recipe-cart/
  src/                    # existing CLI — untouched
  web/
    server/               # Express API, imports ../../src/*.js directly
      package.json
      index.js
    client/                # Vite + React, mobile-first UI
      package.json
      src/
        App.jsx
        ...
```

- `web/server` is a thin HTTP wrapper around the existing modules (`extractIngredients`, `connectSwiggy`, `callTool`). No business logic is reimplemented — it calls the same functions the CLI calls.
- `web/client` is a Vite + React single-page app, mobile-first (single column, ~360-420px content width, sticky bottom action button), matching the approved mockup direction (Step Wizard, phone-frame styled, Swiggy-orange `#fc8019` accent).
- Single global in-memory session on the server: one MCP client instance, one in-progress cart. This is a solo local demo, so there's no need for per-user session management.

## Backend API

All endpoints mirror `index.js`'s existing flow 1:1 — same functions, exposed over HTTP instead of console/readline:

| Endpoint | Body | Returns | Wraps |
|---|---|---|---|
| `POST /api/extract` | `{ recipeText }` | `{ ingredients }` | `extractIngredients()` |
| `POST /api/connect` | — | `{ address }` | `connectSwiggy("instamart")` + `get_addresses`, picks `addressTag === "Home"` fallback first |
| `POST /api/search` | `{ ingredients, addressId }` | `{ proposedCart, skipped }` | loops `search_products` per ingredient, same field mapping as `index.js` (`variations`, `displayName`, `price.offerPrice`) |
| `POST /api/confirm` | `{ items, addressId }` | `{ cart }` | `update_cart` (with `selectedAddressId`, `spinId`, `skuId`) then `get_cart` |

`/api/connect` may take a while on a fresh login (browser OAuth round-trip); it blocks and resolves once connected, same as the CLI's blocking behavior today. Cached tokens (~5 day validity) make this near-instant in the common case.

## Frontend Flow

Five steps, dot-progress indicator, matching the approved mockup:

1. **Paste recipe** — textarea pre-filled with the bundled example recipe text; "Extract Ingredients" button.
2. **Review ingredients** — list of `{search_query, quantity_note}`; "Search Instamart" button triggers `/api/connect` then `/api/search` in sequence.
3. **Loading** — spinner shown while step 2's calls are in flight (no live per-item streaming — single loading state, per the "Step Wizard" direction chosen over the "Live Feed" alternative).
4. **Review proposed cart** — list of matched products + prices + estimated total, skipped items called out; "Add to Instamart Cart" button triggers `/api/confirm`.
5. **Done** — shows the live cart from `get_cart`, with the same "stops before checkout, open the Swiggy app to finish" messaging the CLI prints today.

## Error Handling

Matches the CLI's existing simplicity: on any API failure, show an inline error message and a "Start Over" action that resets to step 1. No retry queues, no offline handling — this is a tool you drive yourself, live.

## Testing

No automated tests added. Verified manually by running `npm run dev` (both `web/server` and `web/client`) and walking through all 5 steps in a browser resized to mobile width. This matches the project's existing lack of a test framework, and adding one solely for a demo GUI would be scope creep for what's explicitly a throwaway demo artifact.

## Out of scope / explicitly deferred

- Real phone access over local wifi (would need the OAuth callback's hardcoded `localhost:8787` reworked) — deferred, laptop-only demo is sufficient per user decision.
- Live per-ingredient search streaming ("Live Activity Feed" mockup direction) — user chose the calmer Step Wizard direction instead.
