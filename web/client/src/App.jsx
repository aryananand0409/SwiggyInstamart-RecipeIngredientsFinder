import { useState } from "react";
import RecipeInput from "./steps/RecipeInput.jsx";
import IngredientsReview from "./steps/IngredientsReview.jsx";
import Loading from "./steps/Loading.jsx";
import ProposedCart from "./steps/ProposedCart.jsx";
import Done from "./steps/Done.jsx";
import { extractIngredients, connectSwiggy, searchInstamart, confirmCart } from "./api.js";

const EXAMPLE_RECIPE = `Ingredients

100g butter (melted)
150g sugar (¾ cup)
2 eggs
1 tsp vanilla extract
40g cocoa powder (½ cup)
65g all-purpose flour (½ cup)
¼ tsp salt
50–75g chocolate chips or chopped chocolate (optional)

Method

Preheat oven to 175°C.
Grease or line an 8×8 inch baking pan with parchment paper.
Whisk melted butter and sugar until well combined.
Add eggs one at a time and whisk until smooth.
Stir in vanilla extract.
Sift in cocoa powder, flour, and salt.
Fold gently until no dry flour remains. Do not overmix.
Fold in chocolate chips if using.
Pour batter into the prepared pan and spread evenly.
Bake for 22–28 minutes. A toothpick should come out with a few moist crumbs (not wet batter).
Cool in the pan for 20–30 minutes before slicing.`;

const STEPS = ["recipe", "ingredients", "loading", "cart", "done"];

export default function App() {
  const [step, setStep] = useState("recipe");
  const [recipeText, setRecipeText] = useState(EXAMPLE_RECIPE);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [address, setAddress] = useState(null);
  const [proposedCart, setProposedCart] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [finalCart, setFinalCart] = useState(null);

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

  function handleReset() {
    setStep("recipe");
    setRecipeText(EXAMPLE_RECIPE);
    setIngredients([]);
    setAddress(null);
    setProposedCart([]);
    setSkipped([]);
    setFinalCart(null);
    setError(null);
  }

  return (
    <div className="phone-shell">
      <div className="dots">
        {STEPS.map((s, i) => (
          <span key={s} className={`dot ${i <= stepIndex ? "filled" : ""}`} />
        ))}
      </div>
      {error && (
        <div className="error-banner">
          {error}
          <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleReset}>
            Start Over
          </button>
        </div>
      )}
      {step === "recipe" && (
        <RecipeInput recipeText={recipeText} onChange={setRecipeText} onSubmit={handleExtract} loading={loading} />
      )}
      {step === "ingredients" && (
        <IngredientsReview ingredients={ingredients} onSubmit={handleSearch} />
      )}
      {step === "loading" && <Loading message={loadingMessage} />}
      {step === "cart" && (
        <ProposedCart
          proposedCart={proposedCart}
          skipped={skipped}
          onSubmit={handleConfirm}
          loading={loading}
          address={address}
        />
      )}
      {step === "done" && <Done cart={finalCart} onReset={handleReset} />}
    </div>
  );
}
