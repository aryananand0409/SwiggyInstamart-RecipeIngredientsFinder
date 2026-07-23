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
