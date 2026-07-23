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
