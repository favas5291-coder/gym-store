export default function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  return (
    <div
      className={`toast toast-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true">{type === "error" ? "!" : "✓"}</span>
      <p>{message}</p>
      <button type="button" aria-label="Close notification" onClick={onClose}>
        ×
      </button>
    </div>
  );
}