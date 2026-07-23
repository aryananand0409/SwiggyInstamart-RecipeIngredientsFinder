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
