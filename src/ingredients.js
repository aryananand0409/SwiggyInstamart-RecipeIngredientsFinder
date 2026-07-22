import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const EXTRACTION_TOOL = {
  name: "record_shopping_list",
  description: "Record the shopping-list ingredients extracted from a recipe.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            // Kept deliberately generic (e.g. "cumin seeds", "onions") so it
            // reads well as a search query against Instamart's catalogue —
            // pantry staples the user obviously already has (salt, water)
            // are excluded.
            search_query: { type: "string", description: "Short grocery search term, e.g. 'basmati rice' or 'ginger garlic paste'" },
            quantity_note: { type: "string", description: "Human-readable quantity from the recipe, e.g. '2 cups' or '500g' — for display only, not for matching a SKU" },
          },
          required: ["search_query", "quantity_note"],
        },
      },
    },
    required: ["items"],
  },
};

/**
 * @param {string} recipeText - full pasted recipe (ingredients + method is fine, method is ignored)
 * @returns {Promise<{search_query: string, quantity_note: string}[]>}
 */
export async function extractIngredients(recipeText) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system:
      "You extract grocery shopping lists from recipes. Skip water, ice, and anything a " +
      "typical kitchen already has unless the recipe clearly needs a specific unusual amount. " +
      "Use plain, genericized search terms (no brand names) so each item matches well against a " +
      "grocery-app search box.",
    messages: [{ role: "user", content: `Extract the shopping list from this recipe:\n\n${recipeText}` }],
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_shopping_list" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a shopping list — try again or check the recipe text.");
  return toolUse.input.items;
}
