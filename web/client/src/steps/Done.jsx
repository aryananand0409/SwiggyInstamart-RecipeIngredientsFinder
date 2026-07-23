export default function Done({ cart, onReset }) {
  return (
    <>
      <div className="step-content">
        <div className="title">Cart staged on Instamart ✓</div>
        <div className="subtitle">
          This stops here — open the Swiggy Instamart app to adjust quantities/brands and check out yourself.
        </div>
        <pre
          style={{
            fontSize: 11,
            whiteSpace: "pre-wrap",
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {JSON.stringify(cart, null, 2)}
        </pre>
      </div>
      <div className="step-footer">
        <button className="btn-primary" onClick={onReset}>Start Over</button>
      </div>
    </>
  );
}
