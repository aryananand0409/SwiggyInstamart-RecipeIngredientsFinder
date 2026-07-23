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
