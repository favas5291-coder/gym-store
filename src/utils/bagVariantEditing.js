import { changeBagVariant } from "./commerce.js";
import {
  getCartItemKey,
  revalidateCart,
} from "./cartUtils.js";
import {
  productReference,
  purchaseState,
} from "./productPurchase.js";

// Detect changes to quantities, selections and prices before saving.
export function bagEditSignature(rows, prices = true) {
  return JSON.stringify(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [
        getCartItemKey(row),
        Number(row?.quantity),
        ...(prices ? [Number(row?.price)] : []),
      ])
      .sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
      ),
  );
}

export function previewBagVariant(
  rows,
  item,
  product,
  size,
  color,
  ready = true,
) {
  const cart = Array.isArray(rows) ? rows : [];
  const originalKey = getCartItemKey(item);

  const selectedKey = getCartItemKey({
    id: productReference(product) || productReference(item),
    selectedSize: size,
    selectedColor: color,
  });

  const originals = cart.filter(
    (row) => row && getCartItemKey(row) === originalKey,
  );

  const matches =
    selectedKey === originalKey
      ? []
      : cart.filter(
          (row) => row && getCartItemKey(row) === selectedKey,
        );

  const quantity = originals.reduce(
    (sum, row) => sum + Number(row.quantity),
    0,
  );

  const matchingQuantity = matches.reduce(
    (sum, row) => sum + Number(row.quantity),
    0,
  );

  const combinedQuantity = quantity + matchingQuantity;

  const state = purchaseState(
    product,
    size,
    color,
    combinedQuantity,
    ready,
  );

  const result = {
    quantity,
    matchingQuantity,
    combinedQuantity,
    stock: state.stock,
    selectedKey,
  };

  const fail = (message) => ({
    ...result,
    canSave: false,
    message,
    cart: null,
  });

  if (!ready) {
    return fail(
      "Wait for the latest products before saving your options.",
    );
  }

  if (!originals.length) {
    return fail(
      "This item changed or was removed. Close this window and check your bag.",
    );
  }

  const invalidQuantity = [...originals, ...matches].some(
    (row) =>
      !["number", "string"].includes(typeof row.quantity) ||
      !Number.isSafeInteger(Number(row.quantity)) ||
      Number(row.quantity) < 1,
  );

  if (
    invalidQuantity ||
    !Number.isSafeInteger(combinedQuantity)
  ) {
    return fail(
      "The bag quantity is invalid. Close this window and correct your bag.",
    );
  }

  if (!state.canBuy) {
    const stockShortage =
      state.stock > 0 &&
      combinedQuantity > state.stock &&
      state.priceAvailable &&
      product?.isActive !== false &&
      product?.delivery?.available !== false;

    return fail(
      stockShortage
        ? `Only ${state.stock} available. The combined quantity would be ${combinedQuantity}. Choose another option or adjust your bag quantity first.`
        : state.message,
    );
  }

  const changed = changeBagVariant(
    cart,
    originalKey,
    product,
    size,
    color,
  );

  if (changed.error) {
    return fail(changed.error);
  }

  // Products without variant inventory share one stock pool.
  // Refuse edits that would silently reduce another bag quantity.
  const references = new Set(
    [product?.id, product?._id, product?.legacyId]
      .filter((value) => value != null)
      .map(String),
  );

  const productRows = changed.cart.filter((row) =>
    references.has(String(productReference(row))),
  );

  const checked = revalidateCart(productRows, [product]);

  if (
    bagEditSignature(productRows, false) !==
    bagEditSignature(checked.cart, false)
  ) {
    return fail(
      "There is not enough shared stock for all options in your bag. Review your bag quantities before saving.",
    );
  }

  return {
    ...result,
    canSave: true,
    message: "",
    cart: changed.cart,
  };
}