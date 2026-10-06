import { Component, lazy, Suspense, useState } from "react";
import { createPortal } from "react-dom";
import catalog from "../../../config/virtual-try-on.json";
import "./virtual-try-on.css";
const Studio = lazy(() => import("./VirtualTryOnStudio.jsx"));
class LoadBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="vto-error">
        The fitting room could not open. Refresh the page and try again.
      </p>
    ) : (
      this.props.children
    );
  }
}
export default function VirtualTryOnButton({
  product,
  color,
  size,
  onSelectionChange,
}) {
  const [open, setOpen] = useState(false);
  const productId = String(product?.id ?? product?._id ?? "");
  if (catalog.products?.[productId]?.enabled !== true) return null;
  return (
    <>
      <button
        type="button"
        className="vto-entry"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <span className="vto-entry-icon" aria-hidden="true">
          ✦
        </span>
        <span>
          <strong>Virtual Try-On</strong>
          <small>See this style on you with AI</small>
        </span>
        <span className="vto-entry-arrow" aria-hidden="true">
          ↗
        </span>
      </button>
      {open &&
        createPortal(
          <LoadBoundary>
            <Suspense
              fallback={
                <p role="status" className="vto-loading-entry">
                  Opening Virtual Try-On…
                </p>
              }
            >
              <Studio
                product={product}
                initialColor={color}
                initialSize={size}
                onSelectionChange={onSelectionChange}
                onClose={() => setOpen(false)}
              />
            </Suspense>
          </LoadBoundary>,
          document.body,
        )}
    </>
  );
}