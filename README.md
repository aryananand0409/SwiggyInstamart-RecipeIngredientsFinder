# Recipe → Instamart Cart

Paste a recipe in, get the ingredients staged in your Swiggy Instamart cart.
Stops before checkout on purpose — see "Why it stops before checkout" below.

## What this actually does (read before you assume more)

1. You give it a recipe (a `.txt` file).
2. Claude (via the Anthropic API) extracts a shopping list from it — this is
   an LLM guess at what a recipe needs, not a Swiggy feature. Review it.
3. For each item, it calls Swiggy's `search_products` and proposes the
   *first* matching product/variant. Instamart often has several brands and
   pack sizes per search term — the script does not know your preferences,
   it picks the top result. Check the proposed cart before confirming.
4. Only after you confirm does it call `update_cart` to actually add items.
5. It prints the live cart from `get_cart` and stops. It does **not** call
   `checkout`.

## Why it stops before checkout

Checkout places a real COD order — real money, real delivery. A script
guessing brands/quantities from a recipe is not a safe thing to point at
"place order" unsupervised. Review the cart in the Swiggy app (or extend
`src/index.js` yourself, see bottom of this file) and check out there.

## Setup

### 1. Prerequisites
- Node.js 20+
- A Swiggy account with a saved Instamart delivery address
- An Anthropic API key (console.anthropic.com) for the ingredient-extraction
  step — this is separate from your Claude.ai login

### 2. Install
```
npm install
```

### 3. Set your Anthropic API key
```
export ANTHROPIC_API_KEY=sk-ant-...
```
(Put this in your shell profile, or a `.env` file + `dotenv` if you'd rather
not export it every session — not wired up by default to keep the script
dependency-light.)

### 4. Run it
```
npm start -- recipes/example-chana-masala.txt
```

### 5. First run: Swiggy login
The first time you run it, `search_products` (or any tool call) will fail
with "unauthorized", and the script will:
- Start a local server on `http://localhost:8787/callback`
- Print a Swiggy login URL and try to open it in your browser
- You log in with phone + OTP, same as the Swiggy app
- Swiggy redirects back to localhost, the script picks up the code and you're in

This matches the Swiggy Builders Club docs: steps through OAuth work on
`http://localhost` without needing production approval — you're using their
staging environment. Tokens are cached in `.auth/` (gitignored) for 5 days;
after that you'll be prompted to log in again automatically.

**Note:** the docs describe Dynamic Client Registration as self-serve, but if
the login step throws a client-registration error, you may need to email
`builders@swiggy.in` to register `http://localhost:8787/callback` as an
allowed redirect URI for your Builders Club application — this is one of the
account-level steps that's on you, not something I can do for you.

## Write your own recipe file
Just plain text, ingredients + method, anything readable. Save it under
`recipes/` and pass the path to `npm start --`.

## Extending to checkout (do this deliberately, not by default)
`src/swiggyClient.js` already wraps every Swiggy tool via `callTool()`. To
checkout, in `src/index.js` after the cart review you'd add something like:
```js
const order = await callTool(client, "checkout", { paymentMethod: "COD" });
```
Only do this after you're confident the item-matching is reliable for your
recipes — put a hard confirmation prompt in front of it, the same way the
cart step has one now.

## Next step: turning this into a web app
Once this feels solid from the command line, the natural port is a small
Express (or Next.js) app: same three modules (`auth.js`, `swiggyClient.js`,
`ingredients.js`) reused as-is, with a form replacing the CLI prompts and the
OAuth callback server becoming a real route instead of a temporary one. Say
the word when you're ready and we'll do that migration.
