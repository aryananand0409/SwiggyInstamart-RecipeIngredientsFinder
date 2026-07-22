import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { connectSwiggy, callTool } from "./swiggyClient.js";
import { extractIngredients } from "./ingredients.js";

const rl = readline.createInterface({ input, output });
const ask = (q) => rl.question(q);

function readRecipeText() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm start -- recipes/my-recipe.txt");
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf8");
}

async function main() {
  const recipeText = readRecipeText();

  console.log("\nReading ingredients from the recipe with Claude...");
  const ingredients = await extractIngredients(recipeText);
  console.log(`Found ${ingredients.length} ingredients to shop for:`);
  ingredients.forEach((i, idx) => console.log(`  ${idx + 1}. ${i.search_query} (${i.quantity_note})`));

  const confirmList = await ask("\nLook right? Proceed to search on Instamart? (y/n) ");
  if (confirmList.trim().toLowerCase() !== "y") {
    console.log("Stopped. Edit the recipe file and re-run when ready.");
    rl.close();
    return;
  }

  const client = await connectSwiggy("instamart");

  console.log("\nLooking up your delivery address...");
  const addresses = await callTool(client, "get_addresses");
  const addressList = addresses.addresses ?? addresses.data ?? addresses;
  if (!addressList?.length) {
    console.error("No saved Instamart addresses found. Add one in the Swiggy app first, then re-run.");
    rl.close();
    await client.close();
    return;
  }
  const address = addressList.find((a) => a.addressTag === "Home") ?? addressList[0];
  console.log(`Delivering to: ${address.addressTag ?? "saved address"} (${address.id})`);

  // For each ingredient, search and pick the first in-stock variant as the
  // proposed pick. Nothing is added to the cart yet — this is a draft only.
  const proposedCart = [];
  const skipped = [];

  for (const ingredient of ingredients) {
    process.stdout.write(`Searching: ${ingredient.search_query}... `);
    let results;
    try {
      results = await callTool(client, "search_products", {
        addressId: address.id,
        query: ingredient.search_query,
      });
    } catch (err) {
      console.log(`search failed (${err.message})`);
      skipped.push(ingredient);
      continue;
    }
    const products = results.data?.products ?? results.products ?? [];
    const firstProduct = products[0];
    const variant = firstProduct?.variations?.[0];
    if (!variant) {
      console.log("no match found");
      skipped.push(ingredient);
      continue;
    }
    const price = variant.price?.offerPrice ?? variant.price?.mrp;
    console.log(`-> ${firstProduct.displayName} (${variant.quantityDescription ?? ""}) ₹${price ?? "?"}`);
    proposedCart.push({
      ingredient: ingredient.search_query,
      quantityNote: ingredient.quantity_note,
      productName: firstProduct.displayName,
      spinId: variant.spinId,
      skuId: variant.skuId,
      price,
    });
  }

  console.log("\n--- Proposed cart ---");
  proposedCart.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.productName} — ₹${item.price}  (for: ${item.ingredient}, recipe wants ${item.quantityNote})`);
  });
  if (skipped.length) {
    console.log("\nCouldn't find a match for:");
    skipped.forEach((s) => console.log(`  - ${s.search_query} (${s.quantity_note}) — add manually in the app`));
  }

  const estTotal = proposedCart.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
  console.log(`\nEstimated total: ₹${estTotal} (before delivery fee/taxes, and before quantities beyond 1x each)`);

  const confirmCart = await ask("\nAdd these items to your Instamart cart? This does NOT place the order yet. (y/n) ");
  if (confirmCart.trim().toLowerCase() !== "y") {
    console.log("Stopped before touching your cart.");
    rl.close();
    await client.close();
    return;
  }

  await callTool(client, "update_cart", {
    selectedAddressId: address.id,
    items: proposedCart.map((i) => ({ spinId: i.spinId, skuId: i.skuId, quantity: 1 })),
  });

  const cart = await callTool(client, "get_cart");
  console.log("\n--- Cart on Instamart ---");
  console.log(JSON.stringify(cart.data ?? cart, null, 2));

  console.log(
    "\nCart is staged. This script deliberately stops here — open the Swiggy Instamart app " +
      "(or extend this script) to adjust quantities/brands and check out yourself. " +
      "Automatic checkout is intentionally not wired up in this version."
  );

  rl.close();
  await client.close();
}

main().catch((err) => {
  console.error("\nSomething went wrong:", err.message);
  process.exit(1);
});
