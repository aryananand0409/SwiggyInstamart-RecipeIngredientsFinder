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
