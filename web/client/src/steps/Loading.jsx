export default function Loading({ message }) {
  return (
    <div
      className="step-content"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, minHeight: 300 }}
    >
      <div className="spinner" />
      <div className="subtitle" style={{ margin: 0 }}>{message}</div>
    </div>
  );
}
