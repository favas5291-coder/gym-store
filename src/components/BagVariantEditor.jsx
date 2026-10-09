import { useId, useState } from "react";

import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import { changeBagVariant } from "../utils/commerce.js";

import {
  getCartItemKey,
  getVariantStock,
} from "../utils/cartUtils.js";

import Modal from "./Modal.jsx";

function options(values) {
  return Array.isArray(values)
    ? [...new Set(values.map(String).filter(Boolean))]
    : [];
}

export default function BagVariantEditor({
  item,
  onClose,
}) {
  const { products, getLatestProducts } = useCatalog();

  const {
    cart,
    latestCart,
    setCart,
    notify,
    catalogReady,
  } = useStore();

  const fieldId = useId();
  const originalKey = getCartItemKey(item);

  const product = (
    Array.isArray(products) ? products : []
  ).find(
    (entry) => String(entry.id) === String(item.id),
  );

  const currentItem = cart.find(
    (entry) => getCartItemKey(entry) === originalKey,
  );

  const colors = options(product?.colors);
  const sizes = options(product?.sizes);

  const [size, setSize] = useState(
    item.selectedSize == null
      ? ""
      : String(item.selectedSize),
  );

  const [color, setColor] = useState(
    item.selectedColor == null
      ? ""
      : String(item.selectedColor),
  );

  const [error, setError] = useState("");

  const selectedSize = sizes.length ? size || null : null;
  const selectedColor = colors.length ? color || null : null;

  const validSelection =
    (!sizes.length || sizes.includes(size)) &&
    (!colors.length || colors.includes(color));

  const selectedKey = getCartItemKey({
    id: item.id,
    selectedSize,
    selectedColor,
  });

  const matchingItem =
    selectedKey !== originalKey
      ? cart.find(
          (entry) => getCartItemKey(entry) === selectedKey,
        )
      : null;

  const quantity = Number(
    currentItem?.quantity ?? item.quantity,
  );

  const combinedQuantity =
    quantity + Number(matchingItem?.quantity || 0);

  const stock =
    catalogReady && product && validSelection
      ? getVariantStock(
          product,
          selectedSize,
          selectedColor,
        )
      : 0;

  const canSave =
    catalogReady &&
    Boolean(product) &&
    product.isActive !== false &&
    Boolean(currentItem) &&
    validSelection &&
    Number.isSafeInteger(combinedQuantity) &&
    combinedQuantity >= 1 &&
    stock >= combinedQuantity;

  function colorHasStock(value) {
    if (!product) return false;

    if (!sizes.length) {
      return getVariantStock(product, null, value) > 0;
    }

    return sizes.some(
      (option) =>
        getVariantStock(product, option, value) > 0,
    );
  }

  function changeColor(value) {
    setColor(value);
    setError("");

    // Ask the customer to choose a size again if their
    // previous size is unavailable in the new colour.
    if (
      sizes.length &&
      size &&
      getVariantStock(product, size, value) <= 0
    ) {
      setSize("");
    }
  }

  function submit(event) {
    event.preventDefault();
    setError("");

    if (!catalogReady) {
      setError(
        "Wait for products to load before saving your options.",
      );
      return;
    }

    const latestProducts = getLatestProducts();

    const latestProduct = latestProducts.find(
      (entry) => String(entry.id) === String(item.id),
    );

    if (!latestProduct || latestProduct.isActive === false) {
      setError("This product is no longer available.");
      return;
    }

    const latestRows = latestCart();

    const original = latestRows.find(
      (entry) => getCartItemKey(entry) === originalKey,
    );

    if (!original) {
      setError(
        "This bag item changed or was removed. Close this window and check your bag.",
      );
      return;
    }

    const latestSizes = options(latestProduct.sizes);
    const latestColors = options(latestProduct.colors);

    if (latestSizes.length && !latestSizes.includes(size)) {
      setError("Choose an available size.");
      return;
    }

    if (
      latestColors.length &&
      !latestColors.includes(color)
    ) {
      setError("Choose an available colour.");
      return;
    }

    const result = changeBagVariant(
      latestRows,
      originalKey,
      latestProduct,
      latestSizes.length ? size : null,
      latestColors.length ? color : null,
    );

    if (result.error) {
      setError(result.error);
      return;
    }

    const saved = setCart(result.cart);

    // StoreContext already shows a warning if persistent
    // storage fails, while keeping the update in memory.
    if (saved) {
      notify("Bag options updated.");
    }

    onClose();
  }

  return (
    <Modal
      title={`Edit options · ${
        product?.name || item.name || "Product"
      }`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {!catalogReady && (
          <p className="notice" role="status">
            Product availability must be checked before
            saving changes.
          </p>
        )}

        {catalogReady && !product && (
          <p className="field-error" role="alert">
            This product is no longer available.
          </p>
        )}

        {catalogReady && !currentItem && (
          <p className="field-error" role="alert">
            This item is no longer in your bag.
          </p>
        )}

        {colors.length > 0 && (
          <div className="field">
            <label htmlFor={`${fieldId}-color`}>
              Colour
            </label>

            <select
              id={`${fieldId}-color`}
              value={color}
              disabled={!catalogReady || !currentItem}
              onChange={(event) =>
                changeColor(event.target.value)
              }
            >
              <option value="" disabled>
                Choose a colour
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
              Size
            </label>

            <select
              id={`${fieldId}-size`}
              value={size}
              disabled={
                !catalogReady ||
                !currentItem ||
                (colors.length > 0 && !colors.includes(color))
              }
              onChange={(event) => {
                setSize(event.target.value);
                setError("");
              }}
            >
              <option value="" disabled>
                Choose a size
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

        {!sizes.length && !colors.length && product && (
          <p>This product has one standard option.</p>
        )}

        <p>
          Quantity stays at {quantity}. Matching bag
          items are combined only when enough stock
          is available.
        </p>

        {matchingItem && (
          <p className="notice" role="status">
            Your bag already contains{" "}
            {matchingItem.quantity} of this selection.
            The combined quantity will be{" "}
            <strong>{combinedQuantity}</strong>.
          </p>
        )}

        {catalogReady && product && validSelection && (
          <p className={canSave ? "muted" : "field-error"}>
            {stock <= 0
              ? "This selection is out of stock."
              : stock < combinedQuantity
                ? `Only ${stock} available. Your combined quantity would be ${combinedQuantity}. Choose another option or adjust your bag quantity first.`
                : `${stock} available for this selection.`}
          </p>
        )}

        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}

        <div className="purchase-actions">
          <button
            type="submit"
            className="button"
            disabled={!canSave}
          >
            Save options
          </button>

          <button
            type="button"
            className="button secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}