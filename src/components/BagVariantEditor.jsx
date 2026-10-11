import {
  useId,
  useRef,
  useState,
} from "react";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getVariantStock,
  revalidateCart,
} from "../utils/cartUtils.js";

import {
  getDiscountedPrice,
  money,
} from "../utils/productPricing.js";

import {
  optionLabels,
} from "../utils/productInformation.js";

import {
  latestPurchaseProduct,
  productPriceAvailable,
  productReference,
  purchaseOptions,
} from "../utils/productPurchase.js";

import {
  bagEditSignature,
  previewBagVariant,
} from "../utils/bagVariantEditing.js";

import Modal from "./Modal.jsx";

export default function BagVariantEditor({
  item,
  onClose,
}) {
  const editorKey = JSON.stringify([
    productReference(item),
    item.selectedSize,
    item.selectedColor,
  ]);

  return (
    <Editor
      key={editorKey}
      item={item}
      onClose={onClose}
    />
  );
}

function Editor({ item, onClose }) {
  const { loading: authLoading } = useAuth();

  const {
    products,
    getLatestProducts,
  } = useCatalog();

  const {
    cart,
    latestCart,
    setCart,
    notify,
    catalogReady,
  } = useStore();

  const product = latestPurchaseProduct(products, item);
  const labels = optionLabels(product);

  const sizes = purchaseOptions(product?.sizes);
  const colors = purchaseOptions(product?.colors);

  const fieldId = useId();
  const saving = useRef(false);

  const [busy, setBusy] = useState(false);

  const [size, setSize] = useState(
    String(item.selectedSize ?? ""),
  );

  const [color, setColor] = useState(
    String(item.selectedColor ?? ""),
  );

  const [error, setError] = useState("");

  const selectedSize = size || null;
  const selectedColor = color || null;

  const preview = previewBagVariant(
    cart,
    item,
    product,
    selectedSize,
    selectedColor,
    catalogReady,
  );

  const unitPrice = productPriceAvailable(product)
    ? getDiscountedPrice(product)
    : null;

  const canSave =
    preview.canSave &&
    !authLoading &&
    !busy;

  const messageId = `${fieldId}-message`;

  function close() {
    if (!saving.current) {
      onClose();
    }
  }

  function colorHasStock(value) {
    return sizes.length
      ? sizes.some(
          (option) =>
            getVariantStock(product, option, value) > 0,
        )
      : getVariantStock(product, null, value) > 0;
  }

  function submit(event) {
    event.preventDefault();

    if (saving.current) {
      return;
    }

    setError("");

    if (authLoading) {
      setError(
        "Checking your account. Wait a moment before saving.",
      );
      return;
    }

    if (!preview.canSave) {
      setError(preview.message);
      return;
    }

    saving.current = true;
    setBusy(true);

    let accepted = false;

    try {
      const catalogue = getLatestProducts();

      if (!Array.isArray(catalogue)) {
        throw new Error(
          "Product information is unavailable. Retry the catalogue before saving.",
        );
      }

      const latestProduct = latestPurchaseProduct(
        catalogue,
        item,
      );

      const latestRows = latestCart();

      const checked = previewBagVariant(
        latestRows,
        item,
        latestProduct,
        selectedSize,
        selectedColor,
        catalogReady,
      );

      if (!checked.canSave) {
        throw new Error(checked.message);
      }

      const bagChanged =
        bagEditSignature(cart) !==
        bagEditSignature(latestRows);

      const priceChanged =
        !productPriceAvailable(latestProduct) ||
        getDiscountedPrice(latestProduct) !== unitPrice;

      if (bagChanged || priceChanged) {
        throw new Error(
          "Your bag or price changed. Close this window, review your bag and reopen the options before saving.",
        );
      }

      const validated = revalidateCart(
        checked.cart,
        catalogue,
      );

      if (
        bagEditSignature(checked.cart) !==
        bagEditSignature(validated.cart)
      ) {
        throw new Error(
          "Your bag needs a stock or price update. Close this window and review it before saving.",
        );
      }

      const persisted = setCart(validated.cart);

      if (
        bagEditSignature(latestCart()) !==
        bagEditSignature(validated.cart)
      ) {
        throw new Error(
          "The options could not be saved. Check your account and bag, then retry.",
        );
      }

      accepted = true;

      // StoreContext warns if browser storage fails.
      // A successful memory-only update remains usable this visit.
      if (persisted) {
        notify("Bag options updated.");
      }
    } catch (saveError) {
      setError(
        saveError.message ||
          "The options could not be saved. Please retry.",
      );
    } finally {
      // Prevent another save from a handler belonging
      // to an already successfully closed editor.
      saving.current = accepted;
      setBusy(false);
    }

    if (accepted) {
      onClose();
    }
  }

  return (
    <Modal
      title={`Edit options · ${
        product?.name || item.name || "Product"
      }`}
      onClose={close}
    >
      <form
        onSubmit={submit}
        aria-busy={busy}
      >
        {colors.length > 0 && (
          <div className="field">
            <label htmlFor={`${fieldId}-color`}>
              {labels.color}
            </label>

            <select
              id={`${fieldId}-color`}
              value={color}
              disabled={
                !catalogReady ||
                authLoading ||
                busy
              }
              aria-describedby={messageId}
              onChange={(event) => {
                setColor(event.target.value);
                setError("");
              }}
            >
              <option value="" disabled>
                Choose a {labels.color.toLowerCase()}
              </option>

              {color && !colors.includes(color) && (
                <option value={color} disabled>
                  {color} — unavailable
                </option>
              )}

              {colors.map((value) => {
                const available = colorHasStock(value);

                return (
                  <option
                    key={value}
                    value={value}
                    disabled={!available}
                  >
                    {value}
                    {!available ? " — out of stock" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {sizes.length > 0 && (
          <div className="field">
            <label htmlFor={`${fieldId}-size`}>
              {labels.size}
            </label>

            <select
              id={`${fieldId}-size`}
              value={size}
              disabled={
                !catalogReady ||
                authLoading ||
                busy ||
                (
                  colors.length > 0 &&
                  !colors.includes(color)
                )
              }
              aria-describedby={messageId}
              onChange={(event) => {
                setSize(event.target.value);
                setError("");
              }}
            >
              <option value="" disabled>
                Choose a {labels.size.toLowerCase()}
              </option>

              {size && !sizes.includes(size) && (
                <option value={size} disabled>
                  {size} — unavailable
                </option>
              )}

              {sizes.map((value) => {
                const available =
                  getVariantStock(
                    product,
                    value,
                    selectedColor,
                  ) > 0;

                return (
                  <option
                    key={value}
                    value={value}
                    disabled={!available}
                  >
                    {value}
                    {!available ? " — out of stock" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {!sizes.length &&
          !colors.length &&
          product && (
            <p>
              This product has one standard option.
            </p>
          )}

        {preview.quantity > 0 && (
          <p>
            Quantity stays at{" "}
            <strong>{preview.quantity}</strong>.
            Change quantities in your bag.
          </p>
        )}

        {preview.matchingQuantity > 0 && (
          <p className="notice" role="status">
            Your bag already contains{" "}
            {preview.matchingQuantity} of this selection.
            Saving combines them into{" "}
            <strong>{preview.combinedQuantity}</strong>{" "}
            units.
          </p>
        )}

        {unitPrice != null && (
          <p className="muted">
            {money(unitPrice)} each

            {preview.combinedQuantity > 0 && (
              <>
                {" "}· Combined item total{" "}
                {money(
                  unitPrice * preview.combinedQuantity,
                )}
              </>
            )}

            <br />
            Before order coupons and delivery charges.
          </p>
        )}

        <p
          id={messageId}
          className={
            preview.canSave ? "muted" : "field-error"
          }
          aria-live="polite"
        >
          {authLoading
            ? "Checking your account…"
            : preview.message ||
              `${preview.stock} available for this selection. Stock is checked again at checkout.`}
        </p>

        {error && (
          <p
            role="alert"
            className="field-error"
          >
            {error}
          </p>
        )}

        <div className="purchase-actions">
          <button
            type="submit"
            className="button"
            disabled={!canSave}
          >
            {busy ? "Saving…" : "Save options"}
          </button>

          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}