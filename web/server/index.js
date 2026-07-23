import express from "express";
import { extractIngredients } from "../../src/ingredients.js";
import { connectSwiggy, callTool } from "../../src/swiggyClient.js";

const app = express();
app.use(express.json());

let mcpClient = null;

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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Web server listening on http://localhost:${PORT}`);
});
