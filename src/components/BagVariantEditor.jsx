import { useState } from "react";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { changeBagVariant } from "../utils/commerce.js";
import { getCartItemKey, getVariantStock } from "../utils/cartUtils.js";
import Modal from "./Modal.jsx";
export default function BagVariantEditor({ item, onClose }) {
  const { products } = useCatalog(),
    { cart, setCart, notify } = useStore();
  const product = products.find((p) => String(p.id) === String(item.id));
  const [size, setSize] = useState(item.selectedSize),
    [color, setColor] = useState(item.selectedColor),
    [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    const result = changeBagVariant(
      cart,
      getCartItemKey(item),
      product,
      size,
      color,
    );
    if (result.error) {
      setError(result.error);
      return;
    }
    setCart(result.cart);
    notify("Bag options updated.");
    onClose();
  }
  return (
    <Modal title={`Edit options · ${item.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        {product?.colors?.length > 0 && (
          <div className="field">
            <label htmlFor="bag-edit-color">Colour</label>
            <select
              id="bag-edit-color"
              value={color || ""}
              onChange={(e) => setColor(e.target.value)}
            >
              {product.colors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        {product?.sizes?.length > 0 && (
          <div className="field">
            <label htmlFor="bag-edit-size">Size</label>
            <select
              id="bag-edit-size"
              value={size || ""}
              onChange={(e) => setSize(e.target.value)}
            >
              {product.sizes.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={getVariantStock(product, s, color) === 0}
                >
                  {s}
                  {getVariantStock(product, s, color) === 0
                    ? " — out of stock"
                    : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <p>
          Quantity stays at {item.quantity}. Matching bag items are combined
          only when enough stock is available.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button type="submit" className="button full">
          Save options
        </button>
      </form>
    </Modal>
  );
}