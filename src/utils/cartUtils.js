import { getDiscountedPrice } from "./productPricing";

export { getDiscountedPrice } from "./productPricing";

/* --------------------------------
   GET VARIANT STOCK
--------------------------------- */

export function getVariantStock(
  product,
  selectedSize = null,
  selectedColor = null
) {
  if (!product) {
    return 0;
  }

  // Product without variants
  if (!product.variants) {
    return Math.max(
      Number(product.stock ?? 0),
      0
    );
  }

  // Product with color + size
  if (selectedColor && selectedSize) {
    return Math.max(
      Number(
        product.variants?.[
          selectedColor
        ]?.[selectedSize] ?? 0
      ),
      0
    );
  }

  // Product with color only
  if (selectedColor) {
    return Math.max(
      Number(
        product.variants?.[
          selectedColor
        ]?.default ?? 0
      ),
      0
    );
  }

  return 0;
}


/* --------------------------------
   CREATE UNIQUE CART ITEM KEY
--------------------------------- */

export function getCartItemKey(item) {
  return [
    item?.id ?? "",
    item?.selectedSize ?? "",
    item?.selectedColor ?? "",
  ].join("::");
}


/* --------------------------------
   CHECK IF TWO CART ITEMS
   ARE THE SAME
--------------------------------- */

export function isSameCartItem(
  firstItem,
  secondItem
) {
  return (
    getCartItemKey(firstItem) ===
    getCartItemKey(secondItem)
  );
}


/* --------------------------------
   CREATE NORMALIZED CART ITEM
--------------------------------- */

export function normalizeCartItem(
  product,
  quantity = 1,
  selectedSize = null,
  selectedColor = null
) {
  return {
    ...product,

    // Always store the actual selling price
    price: getDiscountedPrice(product),

    quantity: Math.max(
      Number(quantity) || 1,
      1
    ),

    selectedSize,
    selectedColor,
  };
}


/* --------------------------------
   VALIDATE CART ITEM
--------------------------------- */

export function validateCartItem(
  product,
  quantity,
  selectedSize = null,
  selectedColor = null
) {
  const stock = getVariantStock(
    product,
    selectedSize,
    selectedColor
  );

  const requestedQuantity =
    Number(quantity) || 0;

  // Out of stock
  if (stock <= 0) {
    return {
      valid: false,
      stock,
      message:
        "This product is out of stock.",
    };
  }

  // Invalid quantity
  if (requestedQuantity <= 0) {
    return {
      valid: false,
      stock,
      message: "Invalid quantity.",
    };
  }

  // Quantity greater than stock
  if (requestedQuantity > stock) {
    return {
      valid: false,
      stock,
      message: `Only ${stock} item${
        stock > 1 ? "s" : ""
      } available.`,
    };
  }

  return {
    valid: true,
    stock,
    message: "",
  };
}


/* --------------------------------
   REVALIDATE ENTIRE CART
--------------------------------- */

export function revalidateCart(
  cart,
  products
) {
  if (!Array.isArray(cart)) {
    return {
      cart: [],
      changes: [],
    };
  }

  if (!Array.isArray(products)) {
    return {
      cart,
      changes: [],
    };
  }

  const productMap = new Map(
    products.map((product) => [
      String(product.id),
      product,
    ])
  );

  const changes = [];
  const validCart = [];

  cart.forEach((item) => {
    const product =
      productMap.get(String(item.id));

    // Product no longer exists
    if (!product) {
      changes.push({
        type: "removed",
        item,
        reason:
          "Product is no longer available.",
      });

      return;
    }

    const stock = getVariantStock(
      product,
      item.selectedSize ?? null,
      item.selectedColor ?? null
    );

    // Variant/product is out of stock
    if (stock <= 0) {
      changes.push({
        type: "removed",
        item,
        reason:
          "Product is out of stock.",
      });

      return;
    }

    const oldQuantity =
      Number(item.quantity) || 1;

    const newQuantity = Math.min(
      Math.max(oldQuantity, 1),
      stock
    );

    // Quantity was reduced because stock changed
    if (newQuantity !== oldQuantity) {
      changes.push({
        type: "quantity-adjusted",
        item,
        oldQuantity,
        newQuantity,
        reason:
          "Cart quantity was adjusted to available stock.",
      });
    }

    validCart.push({
      ...product,

      // Always use current selling price
      price: getDiscountedPrice(product),

      quantity: newQuantity,

      selectedSize:
        item.selectedSize ?? null,

      selectedColor:
        item.selectedColor ?? null,
    });
  });

  return {
    cart: validCart,
    changes,
  };
}