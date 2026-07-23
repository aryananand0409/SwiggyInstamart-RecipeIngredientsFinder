# Web GUI (demo)

Mobile-first wizard UI wrapping the existing CLI flow, built for demoing to the Swiggy Builders Club team. This is a local, single-user demo artifact — not a deployed production app.

## Run it

Two terminals, both from the project root:

    cd web/server && npm install && npm run dev   # http://localhost:3001
    cd web/client && npm install && npm run dev    # http://localhost:5173

Requires the same `ANTHROPIC_API_KEY` env var as the CLI (`../README.md`).

Open the client URL in a browser resized to ~400px wide (or use your browser's device toolbar) — the layout is mobile-first and designed to be shown at phone width during a screen-share.

First Swiggy connection reuses the exact same OAuth flow as the CLI: a browser tab opens for login if there's no cached token in `.auth/` (shared with the CLI, ~5 day validity).
