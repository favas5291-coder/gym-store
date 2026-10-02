import {
  getDiscountedPrice,
  getOriginalPrice,
  number,
} from "./productPricing.js";


export {
  getDiscountedPrice,
} from "./productPricing.js";


// ======================================================
// HELPERS
// ======================================================

const count = (
  value
) =>
  Math.max(
    0,

    Math.floor(
      number(
        value
      )
    )
  );


const own = (
  object,
  key
) =>
  Object.prototype
    .hasOwnProperty.call(
      object ||
        {},
      key
    );


function productId(
  product
) {
  return (
    product?.id ??
    product?._id ??
    product?.legacyId ??
    ""
  );
}


// ======================================================
// CHECK WHETHER PRODUCT REALLY HAS VARIANT INVENTORY
//
// Important:
//
// {} is truthy in JavaScript.
//
// So:
//
// variants: {}
//
// must NOT be treated as a real variant structure.
// ======================================================

function hasVariants(
  product
) {
  return Boolean(
    product?.variants &&
      typeof product.variants ===
        "object" &&
      !Array.isArray(
        product.variants
      ) &&
      Object.keys(
        product.variants
      ).length >
        0
  );
}


// ======================================================
// NORMALIZE OPTION LISTS
// ======================================================

function getSizes(
  product
) {
  return Array.isArray(
    product?.sizes
  )
    ? product.sizes
        .map(
          String
        )
        .filter(
          Boolean
        )
    : [];
}


function getColors(
  product
) {
  return Array.isArray(
    product?.colors
  )
    ? product.colors
        .map(
          String
        )
        .filter(
          Boolean
        )
    : [];
}


// ======================================================
// TOTAL PRODUCT STOCK
// ======================================================

export function getTotalStock(
  product
) {
  if (
    !product ||
    product.stockStatus ===
      "out-of-stock"
  ) {
    return 0;
  }


  function sum(
    value
  ) {
    if (
      value &&
      typeof value ===
        "object"
    ) {
      return Object.values(
        value
      ).reduce(
        (
          total,
          child
        ) =>
          total +
          sum(
            child
          ),

        0
      );
    }


    return count(
      value
    );
  }


  if (
    hasVariants(
      product
    )
  ) {
    return sum(
      product.variants
    );
  }


  return count(
    product.stock
  );
}


// ======================================================
// SELECTED VARIANT STOCK
//
// SUPPORTED STRUCTURES:
//
// 1. COLOUR + SIZE
//    variants[color][size]
//
// 2. COLOUR ONLY
//    variants[color].default
//
// 3. SIZE ONLY
//    variants[size]
//
// 4. NO OPTIONS
//    product.stock
// ======================================================

export function getVariantStock(
  product,
  selectedSize = null,
  selectedColor = null
) {
  if (
    !product ||
    product.stockStatus ===
      "out-of-stock"
  ) {
    return 0;
  }


  const sizes =
    getSizes(
      product
    );


  const colors =
    getColors(
      product
    );


  // ====================================================
  // VALIDATE REQUIRED SIZE
  // ====================================================

  if (
    sizes.length >
      0 &&
    (
      !selectedSize ||
      !sizes.includes(
        String(
          selectedSize
        )
      )
    )
  ) {
    return 0;
  }


  // ====================================================
  // VALIDATE REQUIRED COLOUR
  // ====================================================

  if (
    colors.length >
      0 &&
    (
      !selectedColor ||
      !colors.includes(
        String(
          selectedColor
        )
      )
    )
  ) {
    return 0;
  }


  // ====================================================
  // PRODUCT WITHOUT VARIANTS
  //
  // This also handles:
  //
  // variants: {}
  //
  // correctly.
  // ====================================================

  if (
    !hasVariants(
      product
    )
  ) {
    return count(
      product.stock
    );
  }


  let group =
    product.variants;


  // ====================================================
  // COLOUR VARIANTS
  // ====================================================

  if (
    colors.length >
    0
  ) {
    const colorKey =
      String(
        selectedColor
      );


    if (
      !own(
        group,
        colorKey
      )
    ) {
      return 0;
    }


    group =
      group[
        colorKey
      ];
  }


  // ====================================================
  // SIZE VARIANTS
  //
  // COLOUR + SIZE:
  // group is variants[color]
  //
  // SIZE ONLY:
  // group is variants
  // ====================================================

  if (
    sizes.length >
    0
  ) {
    const sizeKey =
      String(
        selectedSize
      );


    if (
      !group ||
      typeof group !==
        "object" ||
      !own(
        group,
        sizeKey
      )
    ) {
      return 0;
    }


    return count(
      group[
        sizeKey
      ]
    );
  }


  // ====================================================
  // COLOUR ONLY
  //
  // variants[color].default
  // ====================================================

  if (
    colors.length >
    0
  ) {
    return (
      group &&
      typeof group ===
        "object"
    )
      ? count(
          group.default
        )
      : count(
          group
        );
  }


  // ====================================================
  // NO DECLARED SIZE / COLOUR
  //
  // Normally this uses product.stock.
  //
  // But this fallback also safely supports:
  //
  // variants.default
  // ====================================================

  if (
    group &&
    typeof group ===
      "object" &&
    own(
      group,
      "default"
    )
  ) {
    return count(
      group.default
    );
  }


  return count(
    product.stock
  );
}


// ======================================================
// FIRST AVAILABLE OPTIONS
//
// Finds the first actual in-stock combination.
// ======================================================

export function firstOptions(
  product
) {
  const colors =
    getColors(
      product
    );


  const sizes =
    getSizes(
      product
    );


  const colorOptions =
    colors.length
      ? colors
      : [
          null,
        ];


  const sizeOptions =
    sizes.length
      ? sizes
      : [
          null,
        ];


  for (
    const color
    of colorOptions
  ) {
    for (
      const size
      of sizeOptions
    ) {
      if (
        getVariantStock(
          product,
          size,
          color
        ) >
        0
      ) {
        return {
          selectedColor:
            color,

          selectedSize:
            size,
        };
      }
    }
  }


  return {
    selectedColor:
      colors[0] ||
      null,

    selectedSize:
      sizes[0] ||
      null,
  };
}


// ======================================================
// CART ITEM KEY
//
// Same product with different size or colour becomes
// a separate cart row.
// ======================================================

export function getCartItemKey(
  item
) {
  return JSON.stringify([
    String(
      productId(
        item
      )
    ),

    item?.selectedSize ==
    null
      ? null
      : String(
          item.selectedSize
        ),

    item?.selectedColor ==
    null
      ? null
      : String(
          item.selectedColor
        ),
  ]);
}


// ======================================================
// SAME CART ITEM
// ======================================================

export function isSameCartItem(
  a,
  b
) {
  return (
    getCartItemKey(
      a
    ) ===
    getCartItemKey(
      b
    )
  );
}


// ======================================================
// NORMALIZE CART ITEM
// ======================================================

export function normalizeCartItem(
  product,
  quantity = 1,
  selectedSize = null,
  selectedColor = null
) {
  return {
    ...product,

    originalPrice:
      getOriginalPrice(
        product
      ),

    price:
      getDiscountedPrice(
        product
      ),

    quantity:
      Math.max(
        1,

        Math.floor(
          number(
            quantity,
            1
          )
        )
      ),

    selectedSize:
      selectedSize ==
      null
        ? null
        : String(
            selectedSize
          ),

    selectedColor:
      selectedColor ==
      null
        ? null
        : String(
            selectedColor
          ),
  };
}


// ======================================================
// CART VALIDATION
// ======================================================

export function validateCartItem(
  product,
  quantity,
  size = null,
  color = null
) {
  const stock =
    getVariantStock(
      product,
      size,
      color
    );


  const qty =
    Number(
      quantity
    );


  const sizes =
    getSizes(
      product
    );


  const colors =
    getColors(
      product
    );


  // ====================================================
  // QUANTITY VALIDATION
  // ====================================================

  if (
    !Number.isSafeInteger(
      qty
    ) ||
    qty <
      1
  ) {
    return {
      valid:
        false,

      stock,

      message:
        "Choose a whole-number quantity of at least 1.",
    };
  }


  // ====================================================
  // REQUIRED SIZE
  // ====================================================

  if (
    sizes.length >
      0 &&
    (
      !size ||
      !sizes.includes(
        String(
          size
        )
      )
    )
  ) {
    return {
      valid:
        false,

      stock:
        0,

      message:
        "Choose an available size.",
    };
  }


  // ====================================================
  // REQUIRED COLOUR
  // ====================================================

  if (
    colors.length >
      0 &&
    (
      !color ||
      !colors.includes(
        String(
          color
        )
      )
    )
  ) {
    return {
      valid:
        false,

      stock:
        0,

      message:
        "Choose an available colour.",
    };
  }


  // ====================================================
  // OUT OF STOCK
  // ====================================================

  if (
    stock <=
    0
  ) {
    let message =
      "This product is currently out of stock.";


    if (
      sizes.length &&
      colors.length
    ) {
      message =
        "This size and colour combination is currently out of stock.";

    } else if (
      sizes.length
    ) {
      message =
        "This size is currently out of stock.";

    } else if (
      colors.length
    ) {
      message =
        "This colour is currently out of stock.";
    }


    return {
      valid:
        false,

      stock,

      message,
    };
  }


  // ====================================================
  // QUANTITY > AVAILABLE STOCK
  // ====================================================

  if (
    qty >
    stock
  ) {
    return {
      valid:
        false,

      stock,

      message:
        `Only ${stock} available for this selection.`,
    };
  }


  return {
    valid:
      true,

    stock,

    message:
      "",
  };
}


// ======================================================
// REVALIDATE CART
//
// Used when:
//
// - catalogue changes
// - price changes
// - stock changes
// - customer reloads cart
//
// It ensures cart rows still match current catalogue data.
// ======================================================

export function revalidateCart(
  cart,
  products
) {
  const catalogue =
    new Map();


  for (
    const product
    of Array.isArray(
      products
    )
      ? products
      : []
  ) {
    if (
      !product
    ) {
      continue;
    }


    const ids = [
      product.id,
      product._id,
      product.legacyId,
    ]
      .filter(
        (
          value
        ) =>
          value !=
          null &&
          value !==
          ""
      )
      .map(
        String
      );


    for (
      const id
      of ids
    ) {
      catalogue.set(
        id,
        product
      );
    }
  }


  const rows =
    new Map();


  const changes =
    [];


  for (
    const item
    of Array.isArray(
      cart
    )
      ? cart
      : []
  ) {
    // ==================================================
    // INVALID CART ROW
    // ==================================================

    if (
      !item ||
      typeof item !==
        "object"
    ) {
      changes.push({
        type:
          "removed",

        reason:
          "Invalid bag item.",
      });

      continue;
    }


    // ==================================================
    // FIND CURRENT PRODUCT
    // ==================================================

    const id =
      String(
        productId(
          item
        )
      );


    const product =
      catalogue.get(
        id
      );


    if (
      !product
    ) {
      changes.push({
        type:
          "removed",

        item,

        reason:
          "This product is no longer available.",
      });

      continue;
    }


    // ==================================================
    // CHECK CURRENT STOCK
    // ==================================================

    const stock =
      getVariantStock(
        product,

        item.selectedSize,

        item.selectedColor
      );


    if (
      stock <=
      0
    ) {
      changes.push({
        type:
          "removed",

        item,

        reason:
          "This selection is no longer available.",
      });

      continue;
    }


    // ==================================================
    // QUANTITY
    // ==================================================

    const qty =
      Number(
        item.quantity
      );


    if (
      !Number.isSafeInteger(
        qty
      ) ||
      qty <
        1
    ) {
      changes.push({
        type:
          "removed",

        item,

        reason:
          "Invalid quantity.",
      });

      continue;
    }


    // ==================================================
    // MERGE DUPLICATE CART ROWS
    // ==================================================

    const key =
      getCartItemKey(
        item
      );


    const previous =
      rows.get(
        key
      );


    const combinedQuantity =
      qty +
      (
        previous?.quantity ||
        0
      );


    const quantity =
      Math.min(
        stock,

        combinedQuantity
      );


    const normalized =
      normalizeCartItem(
        product,

        quantity,

        item.selectedSize ??
          null,

        item.selectedColor ??
          null
      );


    // ==================================================
    // RECORD CHANGES
    // ==================================================

    const priceChanged =
      Number(
        normalized.price
      ) !==
      Number(
        item.price
      );


    const quantityChanged =
      quantity !==
      qty;


    if (
      previous ||
      priceChanged ||
      quantityChanged
    ) {
      changes.push({
        type:
          "updated",

        item,

        reason:
          "Bag updated to current price and available stock.",
      });
    }


    rows.set(
      key,
      normalized
    );
  }


  return {
    cart:
      [
        ...rows.values(),
      ],

    changes,
  };
}