# Mobile GUI (Demo MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web GUI (Vite + React frontend, thin Express backend) that wraps the existing recipe → Instamart-cart CLI flow, for a live demo to the Swiggy Builders Club team.

**Architecture:** `web/server` is a thin HTTP wrapper exposing 4 endpoints that call the *existing, unmodified* `src/ingredients.js` and `src/swiggyClient.js` functions. `web/client` is a 5-step wizard (dot progress, sticky bottom CTA) matching the approved phone-frame mockup. Single global in-memory session on the server (one MCP client) — this is a solo local demo, not multi-user.

**Tech Stack:** Express (server), Vite + React (client), no new dependencies added to the root CLI's `package.json`.

## Global Constraints

- Root `package.json` and everything in `src/` stay untouched — reused via relative imports (`../../src/ingredients.js`, `../../src/swiggyClient.js`), never copied or reimplemented.
- No automated test framework is added — per the approved spec (`docs/superpowers/specs/2026-07-23-mobile-gui-design.md`), every task is verified manually (curl for backend, browser click-through for frontend). This is a deliberate, approved scope decision, not a shortcut.
- Mobile-first layout: content column capped at 400px, matches the approved phone-frame mockup (dot progress bar, sticky bottom action button, `#fc8019` Swiggy-orange accent).
- Backend field mapping for Swiggy responses must match what was empirically confirmed while building the CLI: address list is `addresses.addresses ?? addresses.data ?? addresses`, matched by `addressTag === "Home"`; product variants are under `variations` (not `variants`), name is `displayName` (not `name`), price is `price.offerPrice ?? price.mrp` (not a flat number); `update_cart` requires top-level `selectedAddressId` plus both `spinId` and `skuId` per item.
- Work happens on the already-created `feature/mobile-gui` branch. Commit after every task.

---

### Task 1: `web/server` scaffold + `POST /api/extract`

**Files:**
- Create: `web/server/package.json`
- Create: `web/server/index.js`

**Interfaces:**
- Consumes: `extractIngredients(recipeText: string): Promise<{search_query, quantity_note}[]>` from `src/ingredients.js` (existing, unchanged).
- Produces: `POST /api/extract` — body `{recipeText: string}` → `200 {ingredients: [...]}` or `400/500 {error: string}`. Later tasks add more routes to this same Express `app`.

- [ ] **Step 1: Create `web/server/package.json`**

```json
{
  "name": "swiggy-recipe-cart-web-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "scripts": {
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd web/server && npm install`
Expected: `node_modules/express` created, no errors.

- [ ] **Step 3: Create `web/server/index.js`**

```js
import express from "express";
import { extractIngredients } from "../../src/ingredients.js";

const app = express();
app.use(express.json());

app.post("/api/extract", async (req, res) => {
  try {
    const { recipeText } = req.body;
    if (!recipeText || typeof recipeText !== "string") {
      return res.status(400).json({ error: "recipeText (string) is required" });
    }
    const ingredients = await extractIngredients(recipeText);
    res.json({ ingredients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Web server listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 4: Verify manually**

In `web/server`, with `ANTHROPIC_API_KEY` exported in that shell:

```bash
node index.js &
sleep 1
curl -s -X POST http://localhost:3001/api/extract \
  -H "Content-Type: application/json" \
  -d '{"recipeText":"Ingredients:\n- 2 onions\n- 1 tsp salt\n\nMethod:\n1. Chop onions."}'
kill %1
```

Expected: JSON like `{"ingredients":[{"search_query":"onions","quantity_note":"2"}]}` (salt is typically excluded as a pantry staple, per `ingredients.js`'s extraction prompt — that's correct, not a bug).

- [ ] **Step 5: Commit**

```bash
git add web/server
git commit -m "Add web server scaffold with /api/extract endpoint"
```

---

### Task 2: `POST /api/connect`

**Files:**
- Modify: `web/server/index.js`

**Interfaces:**
- Consumes: `connectSwiggy(serverName: "instamart"): Promise<Client>` and `callTool(client, name, args): Promise<any>` from `src/swiggyClient.js` (existing, unchanged).
- Produces: module-level `mcpClient` variable that Tasks 3–4 read (the frontend re-supplies `addressId` on every later call, so the address itself doesn't need server-side memory); `POST /api/connect` → `200 {address: {id, addressTag}}` or `400/500 {error}`.

- [ ] **Step 1: Add the connect endpoint**

Add near the top of `web/server/index.js`, after the existing `extractIngredients` import:

```js
import { connectSwiggy, callTool } from "../../src/swiggyClient.js";
```

Add after `app.use(express.json());`:

```js
let mcpClient = null;
```

Add after the `/api/extract` route:

```js
app.post("/api/connect", async (req, res) => {
  try {
    mcpClient = await connectSwiggy("instamart");
    const addresses = await callTool(mcpClient, "get_addresses");
    const addressList = addresses.addresses ?? addresses.data ?? addresses;
    if (!addressList?.length) {
      return res.status(400).json({ error: "No saved Instamart addresses found. Add one in the Swiggy app first." });
    }
    const address = addressList.find((a) => a.addressTag === "Home") ?? addressList[0];
    res.json({ address: { id: address.id, addressTag: address.addressTag ?? "saved address" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Verify manually**

```bash
cd web/server && node index.js &
sleep 1
curl -s -X POST http://localhost:3001/api/connect
kill %1
```

Expected: `{"address":{"id":"5463083","addressTag":"Home"}}` (using cached tokens from `.auth/`, no browser prompt if tokens are still valid; if expired, a browser tab opens for login same as the CLI — that's expected, not a bug).

- [ ] **Step 3: Commit**

```bash
git add web/server/index.js
git commit -m "Add /api/connect endpoint"
```

---

### Task 3: `POST /api/search`

**Files:**
- Modify: `web/server/index.js`

**Interfaces:**
- Consumes: module-level `mcpClient` (set by Task 2's `/api/connect`).
- Produces: `POST /api/search` — body `{ingredients: [{search_query, quantity_note}], addressId: string}` → `200 {proposedCart: [{ingredient, quantityNote, productName, spinId, skuId, price}], skipped: [{search_query, quantity_note}]}`.

- [ ] **Step 1: Add the search endpoint**

Add after the `/api/connect` route in `web/server/index.js`:

```js
app.post("/api/search", async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(400).json({ error: "Not connected to Swiggy yet — call /api/connect first." });
    }
    const { ingredients, addressId } = req.body;
    if (!Array.isArray(ingredients) || !addressId) {
      return res.status(400).json({ error: "ingredients (array) and addressId (string) are required" });
    }
    const proposedCart = [];
    const skipped = [];
    for (const ingredient of ingredients) {
      let results;
      try {
        results = await callTool(mcpClient, "search_products", {
          addressId,
          query: ingredient.search_query,
        });
      } catch {
        skipped.push(ingredient);
        continue;
      }
      const products = results.data?.products ?? results.products ?? [];
      const firstProduct = products[0];
      const variant = firstProduct?.variations?.[0];
      if (!variant) {
        skipped.push(ingredient);
        continue;
      }
      const price = variant.price?.offerPrice ?? variant.price?.mrp;
      proposedCart.push({
        ingredient: ingredient.search_query,
        quantityNote: ingredient.quantity_note,
        productName: firstProduct.displayName,
        spinId: variant.spinId,
        skuId: variant.skuId,
        price,
      });
    }
    res.json({ proposedCart, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Verify manually**

```bash
cd web/server && node index.js &
sleep 1
ADDR=$(curl -s -X POST http://localhost:3001/api/connect | node -e "process.stdin.once('data', d => console.log(JSON.parse(d).address.id))")
curl -s -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d "{\"ingredients\":[{\"search_query\":\"chickpeas\",\"quantity_note\":\"2 cups\"}],\"addressId\":\"$ADDR\"}"
kill %1
```

Expected: `{"proposedCart":[{"ingredient":"chickpeas","quantityNote":"2 cups","productName":"...","spinId":"...","skuId":"...","price":<number>}],"skipped":[]}`.

- [ ] **Step 3: Commit**

```bash
git add web/server/index.js
git commit -m "Add /api/search endpoint"
```

---

### Task 4: `POST /api/confirm`

**Files:**
- Modify: `web/server/index.js`

**Interfaces:**
- Consumes: module-level `mcpClient`; `{spinId, skuId}` shape produced by Task 3.
- Produces: `POST /api/confirm` — body `{items: [{spinId, skuId}], addressId: string}` → `200 {cart: <raw get_cart payload>}`.

- [ ] **Step 1: Add the confirm endpoint**

Add after the `/api/search` route:

```js
app.post("/api/confirm", async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(400).json({ error: "Not connected to Swiggy yet — call /api/connect first." });
    }
    const { items, addressId } = req.body;
    if (!Array.isArray(items) || !addressId) {
      return res.status(400).json({ error: "items (array) and addressId (string) are required" });
    }
    await callTool(mcpClient, "update_cart", {
      selectedAddressId: addressId,
      items: items.map((i) => ({ spinId: i.spinId, skuId: i.skuId, quantity: 1 })),
    });
    const cart = await callTool(mcpClient, "get_cart");
    res.json({ cart: cart.data ?? cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 2: Verify manually**

Repeat Task 3's verification, but capture a `spinId`/`skuId` from the `/api/search` response and pass it to `/api/confirm`:

```bash
cd web/server && node index.js &
sleep 1
curl -s -X POST http://localhost:3001/api/connect
# copy the address id, then run search as in Task 3 to get a spinId/skuId, then:
curl -s -X POST http://localhost:3001/api/confirm \
  -H "Content-Type: application/json" \
  -d '{"items":[{"spinId":"<paste-spinId>","skuId":"<paste-skuId>"}],"addressId":"<paste-addressId>"}'
kill %1
```

Expected: `{"cart": {...}}` containing the staged item(s) — check your Instamart app or the response body for the item you just added.

- [ ] **Step 3: Commit**

```bash
git add web/server/index.js
git commit -m "Add /api/confirm endpoint"
```

---

### Task 5: `web/client` scaffold + Step 1 (Recipe Input)

**Files:**
- Create: `web/client/package.json`
- Create: `web/client/vite.config.js`
- Create: `web/client/index.html`
- Create: `web/client/src/main.jsx`
- Create: `web/client/src/api.js`
- Create: `web/client/src/styles.css`
- Create: `web/client/src/steps/RecipeInput.jsx`
- Create: `web/client/src/App.jsx`

**Interfaces:**
- Consumes: `POST /api/extract` from Task 1, proxied through Vite dev server at `/api/*`.
- Produces: `extractIngredients(recipeText): Promise<Array<{search_query, quantity_note}>>` in `api.js`, used by `App.jsx` and all later tasks. `App.jsx` step state machine (`STEPS` array, `step`/`setStep`) that Tasks 6–8 extend.

- [ ] **Step 1: Create `web/client/package.json`**

```json
{
  "name": "swiggy-recipe-cart-web-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `web/client/vite.config.js`**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
```

- [ ] **Step 3: Create `web/client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recipe → Instamart Cart</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `web/client/src/main.jsx`**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Create `web/client/src/api.js`**

All four backend calls in one module now, since the endpoints already exist (Tasks 1–4 are done) even though only `extractIngredients` is used until Task 6:

```js
const BASE = "/api";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `${path} failed`);
  return json;
}

export async function extractIngredients(recipeText) {
  const { ingredients } = await post("/extract", { recipeText });
  return ingredients;
}

export async function connectSwiggy() {
  const { address } = await post("/connect");
  return address;
}

export async function searchInstamart(ingredients, addressId) {
  return post("/search", { ingredients, addressId });
}

export async function confirmCart(items, addressId) {
  const { cart } = await post("/confirm", { items, addressId });
  return cart;
}
```

- [ ] **Step 6: Create `web/client/src/styles.css`**

```css
:root {
  --swiggy-orange: #fc8019;
  --bg: #faf9f7;
  --border: #e5e2dd;
  --text-muted: #8a8578;
  --text: #1c1c1c;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #111214;
  color: var(--text);
}

.phone-shell {
  max-width: 400px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.dots {
  display: flex;
  gap: 5px;
  justify-content: center;
  padding: 16px 18px 8px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
}

.dot.filled {
  background: var(--swiggy-orange);
}

.step-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 18px 18px;
}

.step-footer {
  padding: 14px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

.btn-primary {
  width: 100%;
  background: var(--swiggy-orange);
  border: none;
  color: white;
  padding: 13px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title { font-size: 13px; font-weight: 600; }
.card-sub { font-size: 11.5px; color: var(--text-muted); }
.card-price { font-size: 13px; font-weight: 700; }

textarea.recipe-input {
  width: 100%;
  min-height: 260px;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  font-size: 13px;
  font-family: ui-monospace, monospace;
  resize: vertical;
}

.error-banner {
  background: #fdecec;
  color: #b3261e;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  margin: 0 18px 10px;
}

.title { font-size: 15px; font-weight: 700; margin: 6px 0 12px; }
.subtitle { font-size: 11.5px; color: var(--text-muted); margin: -2px 0 12px; }

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--swiggy-orange);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 7: Create `web/client/src/steps/RecipeInput.jsx`**

```jsx
export default function RecipeInput({ recipeText, onChange, onSubmit, loading }) {
  return (
    <>
      <div className="step-content">
        <div className="title">Paste your recipe</div>
        <textarea
          className="recipe-input"
          value={recipeText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a recipe (ingredients + method)..."
        />
      </div>
      <div className="step-footer">
        <button className="btn-primary" onClick={onSubmit} disabled={loading || !recipeText.trim()}>
          {loading ? "Reading with Claude..." : "Extract Ingredients →"}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 8: Create `web/client/src/App.jsx`**

```jsx
import { useState } from "react";
import RecipeInput from "./steps/RecipeInput.jsx";
import { extractIngredients } from "./api.js";

const EXAMPLE_RECIPE = `Chana Masala

Ingredients:
- 2 cups chickpeas (soaked overnight, or 2 cans)
- 2 medium onions, finely chopped
- 3 tomatoes, pureed
- 2 tbsp ginger garlic paste
- 2 green chillies, slit
- 1 tsp cumin seeds
- 2 tsp chana masala powder
- 1 tsp turmeric powder
- 1 tsp red chilli powder
- 3 tbsp oil
- Fresh coriander leaves, for garnish
- Salt to taste

Method:
1. Heat oil, add cumin seeds and let them splutter.
2. Add onions and saute until golden brown.
3. Add ginger garlic paste and green chillies, cook for 2 minutes.
4. Add tomato puree and cook until oil separates.
5. Add turmeric, chilli powder, and chana masala powder. Cook for 2 minutes.
6. Add chickpeas and enough water. Simmer for 20 minutes.
7. Garnish with coriander and serve hot.`;

const STEPS = ["recipe", "ingredients", "loading", "cart", "done"];

export default function App() {
  const [step, setStep] = useState("recipe");
  const [recipeText, setRecipeText] = useState(EXAMPLE_RECIPE);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const stepIndex = STEPS.indexOf(step);

  async function handleExtract() {
    setLoading(true);
    setError(null);
    try {
      const result = await extractIngredients(recipeText);
      setIngredients(result);
      setStep("ingredients");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="phone-shell">
      <div className="dots">
        {STEPS.map((s, i) => (
          <span key={s} className={`dot ${i <= stepIndex ? "filled" : ""}`} />
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {step === "recipe" && (
        <RecipeInput recipeText={recipeText} onChange={setRecipeText} onSubmit={handleExtract} loading={loading} />
      )}
      {step === "ingredients" && (
        <div className="step-content">
          <div className="title">Found {ingredients.length} ingredients</div>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(ingredients, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

(The raw-JSON block for the `ingredients` step is intentionally minimal — Task 6 replaces it with a real `IngredientsReview` component. This step's own deliverable is the working extract call and step transition, which is fully functional as written.)

- [ ] **Step 9: Verify manually**

```bash
cd web/server && node index.js &
cd web/client && npm install && npm run dev &
```

Open the printed Vite URL (typically `http://localhost:5173`) in a browser, resize the window to ~420px wide (or use device toolbar). Confirm: the example recipe is pre-filled, clicking "Extract Ingredients" shows a loading state then a JSON list of ingredients, and the first dot pair is filled in.

```bash
kill %1 %2
```

- [ ] **Step 10: Commit**

```bash
git add web/client
git commit -m "Add web client scaffold with recipe input step"
```

---

### Task 6: Ingredients Review + Loading step (connect + search)

**Files:**
- Create: `web/client/src/steps/IngredientsReview.jsx`
- Create: `web/client/src/steps/Loading.jsx`
- Modify: `web/client/src/App.jsx`

**Interfaces:**
- Consumes: `connectSwiggy()` and `searchInstamart(ingredients, addressId)` from `api.js` (Task 5).
- Produces: `address`, `proposedCart`, `skipped` state in `App.jsx`, read by Task 7's `ProposedCart` component.

- [ ] **Step 1: Create `web/client/src/steps/IngredientsReview.jsx`**

```jsx
export default function IngredientsReview({ ingredients, onSubmit }) {
  return (
    <>
      <div className="step-content">
        <div className="title">Found {ingredients.length} ingredients</div>
        {ingredients.map((ing, i) => (
          <div className="card" key={i}>
            <span className="card-title">{ing.search_query}</span>
            <span className="card-sub">{ing.quantity_note}</span>
          </div>
        ))}
      </div>
      <div className="step-footer">
        <button className="btn-primary" onClick={onSubmit}>
          Search Instamart →
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create `web/client/src/steps/Loading.jsx`**

```jsx
export default function Loading({ message }) {
  return (
    <div
      className="step-content"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, minHeight: 300 }}
    >
      <div className="spinner" />
      <div className="subtitle" style={{ margin: 0 }}>{message}</div>
    </div>
  );
}
```

- [ ] **Step 3: Modify `web/client/src/App.jsx`**

Change the imports at the top:

```jsx
import { useState } from "react";
import RecipeInput from "./steps/RecipeInput.jsx";
import IngredientsReview from "./steps/IngredientsReview.jsx";
import Loading from "./steps/Loading.jsx";
import { extractIngredients, connectSwiggy, searchInstamart } from "./api.js";
```

Add new state, right after the existing `useState` lines:

```jsx
  const [address, setAddress] = useState(null);
  const [proposedCart, setProposedCart] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [loadingMessage, setLoadingMessage] = useState("");
```

Add a new handler after `handleExtract`:

```jsx
  async function handleSearch() {
    setStep("loading");
    setError(null);
    try {
      setLoadingMessage("Connecting to Swiggy...");
      const addr = await connectSwiggy();
      setAddress(addr);
      setLoadingMessage("Searching Instamart...");
      const { proposedCart, skipped } = await searchInstamart(ingredients, addr.id);
      setProposedCart(proposedCart);
      setSkipped(skipped);
      setStep("cart");
    } catch (err) {
      setError(err.message);
      setStep("ingredients");
    }
  }
```

Replace the raw-JSON `ingredients` block:

```jsx
      {step === "ingredients" && (
        <div className="step-content">
          <div className="title">Found {ingredients.length} ingredients</div>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(ingredients, null, 2)}</pre>
        </div>
      )}
```

with:

```jsx
      {step === "ingredients" && (
        <IngredientsReview ingredients={ingredients} onSubmit={handleSearch} />
      )}
      {step === "loading" && <Loading message={loadingMessage} />}
```

- [ ] **Step 4: Verify manually**

Start both servers as in Task 5, click through: paste recipe → Extract → see ingredient cards → click "Search Instamart". Confirm in the browser's Network tab that `/api/connect` and `/api/search` both return `200`, the loading message updates from "Connecting..." to "Searching...", and the 4th dot becomes filled (content area will be blank at the `cart` step until Task 7 — that's expected).

- [ ] **Step 5: Commit**

```bash
git add web/client/src
git commit -m "Add ingredients review and loading steps"
```

---

### Task 7: Proposed Cart step

**Files:**
- Create: `web/client/src/steps/ProposedCart.jsx`
- Modify: `web/client/src/App.jsx`

**Interfaces:**
- Consumes: `confirmCart(items, addressId)` from `api.js`; `proposedCart`/`skipped`/`address` state from Task 6.
- Produces: `finalCart` state in `App.jsx`, read by Task 8's `Done` component.

- [ ] **Step 1: Create `web/client/src/steps/ProposedCart.jsx`**

```jsx
export default function ProposedCart({ proposedCart, skipped, onSubmit, loading, address }) {
  const total = proposedCart.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  return (
    <>
      <div className="step-content">
        <div className="title">Your proposed cart</div>
        <div className="subtitle">Delivering to {address?.addressTag ?? "saved address"}</div>
        {proposedCart.map((item, i) => (
          <div className="card" key={i}>
            <div>
              <div className="card-title">{item.productName}</div>
              <div className="card-sub">for {item.ingredient} · {item.quantityNote}</div>
            </div>
            <div className="card-price">₹{item.price ?? "?"}</div>
          </div>
        ))}
        {skipped.length > 0 && (
          <div className="subtitle">
            No match for: {skipped.map((s) => s.search_query).join(", ")} — add manually in the app.
          </div>
        )}
      </div>
      <div className="step-footer">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
          <span>Est. total</span>
          <b style={{ color: "var(--text)" }}>₹{total}</b>
        </div>
        <button className="btn-primary" onClick={onSubmit} disabled={loading || proposedCart.length === 0}>
          {loading ? "Adding to cart..." : "Add to Instamart Cart →"}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Modify `web/client/src/App.jsx`**

Add to imports:

```jsx
import ProposedCart from "./steps/ProposedCart.jsx";
import { extractIngredients, connectSwiggy, searchInstamart, confirmCart } from "./api.js";
```

(replace the existing `api.js` import line with the one above — it now includes `confirmCart`)

Add state after `loadingMessage`:

```jsx
  const [finalCart, setFinalCart] = useState(null);
```

Add a new handler after `handleSearch`:

```jsx
  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const cart = await confirmCart(
        proposedCart.map((i) => ({ spinId: i.spinId, skuId: i.skuId })),
        address.id
      );
      setFinalCart(cart);
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
```

Add after the `{step === "loading" && ...}` line:

```jsx
      {step === "cart" && (
        <ProposedCart
          proposedCart={proposedCart}
          skipped={skipped}
          onSubmit={handleConfirm}
          loading={loading}
          address={address}
        />
      )}
```

- [ ] **Step 3: Verify manually**

Click through to the cart step, confirm the product list and estimated total render correctly, click "Add to Instamart Cart", confirm `/api/confirm` returns `200` in the Network tab and the 5th dot fills in (content blank at `done` step until Task 8 — expected).

- [ ] **Step 4: Commit**

```bash
git add web/client/src
git commit -m "Add proposed cart step"
```

---

### Task 8: Done step + reset

**Files:**
- Create: `web/client/src/steps/Done.jsx`
- Modify: `web/client/src/App.jsx`

**Interfaces:**
- Consumes: `finalCart` state from Task 7.
- Produces: `handleReset()` in `App.jsx`, used both by `Done`'s "Start Over" button and the global error banner.

- [ ] **Step 1: Create `web/client/src/steps/Done.jsx`**

```jsx
export default function Done({ cart, onReset }) {
  return (
    <>
      <div className="step-content">
        <div className="title">Cart staged on Instamart ✓</div>
        <div className="subtitle">
          This stops here — open the Swiggy Instamart app to adjust quantities/brands and check out yourself.
        </div>
        <pre
          style={{
            fontSize: 11,
            whiteSpace: "pre-wrap",
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {JSON.stringify(cart, null, 2)}
        </pre>
      </div>
      <div className="step-footer">
        <button className="btn-primary" onClick={onReset}>Start Over</button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Modify `web/client/src/App.jsx`**

Add to imports:

```jsx
import Done from "./steps/Done.jsx";
```

Add a reset handler (place after `handleConfirm`):

```jsx
  function handleReset() {
    setStep("recipe");
    setIngredients([]);
    setAddress(null);
    setProposedCart([]);
    setSkipped([]);
    setFinalCart(null);
    setError(null);
  }
```

Replace the error banner line:

```jsx
      {error && <div className="error-banner">{error}</div>}
```

with:

```jsx
      {error && (
        <div className="error-banner">
          {error}
          <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleReset}>
            Start Over
          </button>
        </div>
      )}
```

Add after the `{step === "cart" && ...}` block:

```jsx
      {step === "done" && <Done cart={finalCart} onReset={handleReset} />}
```

- [ ] **Step 3: Verify manually**

Run the full flow end to end: recipe → extract → ingredients → search → cart → confirm → done. Confirm the final cart JSON renders, "Start Over" returns to the recipe step with fresh state, and triggering an error (e.g. stop `web/server` mid-flow and click a button) shows the error banner with its own "Start Over" button.

- [ ] **Step 4: Commit**

```bash
git add web/client/src
git commit -m "Add done step and reset handling"
```

---

### Task 9: Polish pass + README

**Files:**
- Create: `web/README.md`
- Modify: `web/client/src/styles.css` (only if the walkthrough in Step 1 finds visual issues — see below)

**Interfaces:** None new — this task only verifies and documents.

- [ ] **Step 1: Full manual walkthrough**

With both dev servers running and the browser resized to ~400px wide, check each of the following. If any item looks wrong, fix it directly in `web/client/src/styles.css` (e.g. adjust padding/sizing) before moving on — there's no separate step for this since the fix is whatever the specific issue turns out to be:

- [ ] Dot progress bar shows exactly 5 dots, filled dots use `#fc8019`
- [ ] Recipe textarea is pre-filled and scrollable, button disabled when empty
- [ ] Ingredient cards are legible and don't overflow the 400px width
- [ ] Loading spinner is centered and message updates between "Connecting..." and "Searching..."
- [ ] Proposed cart cards show product name, ingredient/quantity, and price; total sums correctly
- [ ] "Add to Instamart Cart" button disables while the confirm request is in flight
- [ ] Done screen's cart JSON is scrollable within its box, doesn't overflow the phone shell
- [ ] "Start Over" fully resets to a blank recipe step (no stale ingredients/cart data)

- [ ] **Step 2: Create `web/README.md`**

```markdown
# Web GUI (demo)

Mobile-first wizard UI wrapping the existing CLI flow, built for demoing to the Swiggy Builders Club team. This is a local, single-user demo artifact — not a deployed production app.

## Run it

Two terminals, both from the project root:

    cd web/server && npm install && npm run dev   # http://localhost:3001
    cd web/client && npm install && npm run dev    # http://localhost:5173

Requires the same `ANTHROPIC_API_KEY` env var as the CLI (`../README.md`).

Open the client URL in a browser resized to ~400px wide (or use your browser's device toolbar) — the layout is mobile-first and designed to be shown at phone width during a screen-share.

First Swiggy connection reuses the exact same OAuth flow as the CLI: a browser tab opens for login if there's no cached token in `.auth/` (shared with the CLI, ~5 day validity).
```

- [ ] **Step 3: Commit**

```bash
git add web/README.md web/client/src/styles.css
git commit -m "Polish mobile layout and document how to run the web demo"
```
