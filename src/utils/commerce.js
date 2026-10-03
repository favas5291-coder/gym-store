import {
  getCartItemKey,
  normalizeCartItem,
  validateCartItem,
  getTotalStock,
} from "./cartUtils.js";

import {
  getDiscountedPrice,
} from "./productPricing.js";


// ======================================================
// BAG VARIANT
// ======================================================

// Validate the merged destination before changing either variant row.
export function changeBagVariant(
  cart,
  key,
  product,
  size,
  color
) {
  const old =
    cart.find(
      (
        row
      ) =>
        getCartItemKey(
          row
        ) ===
        key
    );


  if (
    !old ||
    String(
      old.id
    ) !==
      String(
        product?.id
      )
  ) {
    return {
      error:
        "This bag item is no longer available.",
    };
  }


  const nextKey =
    getCartItemKey({
      id:
        product.id,

      selectedSize:
        size,

      selectedColor:
        color,
    });


  const other =
    nextKey ===
    key
      ? null
      : cart.find(
          (
            row
          ) =>
            getCartItemKey(
              row
            ) ===
            nextKey
        );


  const quantity =
    old.quantity +
    (
      other?.quantity ||
      0
    );


  const check =
    validateCartItem(
      product,
      quantity,
      size,
      color
    );


  if (
    !check.valid
  ) {
    return {
      error:
        check.message,
    };
  }


  const item =
    normalizeCartItem(
      product,
      quantity,
      size,
      color
    );


  return {
    cart: [
      ...cart.filter(
        (
          row
        ) =>
          ![
            key,
            nextKey,
          ].includes(
            getCartItemKey(
              row
            )
          )
      ),

      item,
    ],
  };
}


// ======================================================
// SELECTED BAG
// ======================================================

export function selectedBag(
  cart,
  keys
) {
  const selected =
    new Set(
      Array.isArray(
        keys
      )
        ? keys
        : []
    );


  return cart.filter(
    (
      item
    ) =>
      selected.has(
        getCartItemKey(
          item
        )
      )
  );
}


// ======================================================
// PRODUCT SPECS
// ======================================================

export function productSpecs(
  product
) {
  return Object.entries({
    Brand:
      product.brand,

    Category:
      product.category,

    Style:
      product.subcategory,

    Material:
      product.material,

    For:
      product.gender,

    ...(
      product.specifications ||
      {}
    ),

    SKU:
      product.sku,

    "In the box":
      product.whatsIncluded,
  }).filter(
    (
      [
        ,
        value,
      ]
    ) =>
      value !=
        null &&
      String(
        value
      ).trim()
  );
}


// ======================================================
// RECOMMENDATION HELPERS
// ======================================================

function normalizeValue(
  value
) {
  return String(
    value ??
      ""
  )
    .trim()
    .toLowerCase();
}


function normalizeList(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .map(
        normalizeValue
      )
      .filter(
        Boolean
      );
  }


  const normalized =
    normalizeValue(
      value
    );


  return normalized
    ? [
        normalized,
      ]
    : [];
}


function sharedValues(
  first,
  second
) {
  const left =
    new Set(
      normalizeList(
        first
      )
    );


  return normalizeList(
    second
  ).filter(
    (
      value
    ) =>
      left.has(
        value
      )
  ).length;
}


// ======================================================
// COMPLEMENTARY PRODUCT RELATIONSHIPS
//
// Used only when those categories actually exist
// in the current catalogue.
// ======================================================

const COMPLEMENTARY_CATEGORIES = {
  "workout clothes": [
    "gym shoes",
    "socks",
    "water bottles",
    "shaker bottles",
    "gym towels",
    "headphones",
  ],

  "gym shoes": [
    "workout clothes",
    "socks",
    "water bottles",
    "gym towels",
  ],

  socks: [
    "gym shoes",
    "workout clothes",
  ],

  "gym towels": [
    "workout clothes",
    "water bottles",
    "shaker bottles",
    "gym shoes",
  ],

  "water bottles": [
    "workout clothes",
    "gym shoes",
    "gym towels",
    "protein",
    "shaker bottles",
  ],

  "shaker bottles": [
    "protein",
    "water bottles",
    "workout clothes",
    "gym towels",
  ],

  protein: [
    "shaker bottles",
    "water bottles",
  ],

  headphones: [
    "workout clothes",
    "gym shoes",
    "water bottles",
  ],

  "gym bags": [
    "workout clothes",
    "gym shoes",
    "water bottles",
    "shaker bottles",
    "gym towels",
    "socks",
  ],
};


function complementaryScore(
  product,
  candidate
) {
  const sourceCategory =
    normalizeValue(
      product?.category
    );


  const candidateCategory =
    normalizeValue(
      candidate?.category
    );


  if (
    !sourceCategory ||
    !candidateCategory
  ) {
    return 0;
  }


  const relationships =
    COMPLEMENTARY_CATEGORIES[
      sourceCategory
    ] ||
    [];


  const position =
    relationships.indexOf(
      candidateCategory
    );


  if (
    position ===
    -1
  ) {
    return 0;
  }


  // Earlier complementary categories receive
  // a slightly higher relevance score.
  return Math.max(
    8,
    20 -
      position *
        2
  );
}


// ======================================================
// PRICE SIMILARITY
// ======================================================

function priceSimilarityScore(
  product,
  candidate
) {
  const sourcePrice =
    Number(
      getDiscountedPrice(
        product
      )
    );


  const candidatePrice =
    Number(
      getDiscountedPrice(
        candidate
      )
    );


  if (
    !Number.isFinite(
      sourcePrice
    ) ||
    !Number.isFinite(
      candidatePrice
    ) ||
    sourcePrice <=
      0 ||
    candidatePrice <=
      0
  ) {
    return 0;
  }


  const difference =
    Math.abs(
      sourcePrice -
      candidatePrice
    );


  const ratio =
    difference /
    Math.max(
      sourcePrice,
      candidatePrice
    );


  if (
    ratio <=
    0.15
  ) {
    return 10;
  }


  if (
    ratio <=
    0.3
  ) {
    return 7;
  }


  if (
    ratio <=
    0.5
  ) {
    return 4;
  }


  if (
    ratio <=
    0.75
  ) {
    return 2;
  }


  return 0;
}


// ======================================================
// RELATED PRODUCT SCORE
// ======================================================

function relatedScore(
  product,
  candidate
) {
  let score =
    0;


  const productCategory =
    normalizeValue(
      product?.category
    );


  const candidateCategory =
    normalizeValue(
      candidate?.category
    );


  const productSubcategory =
    normalizeValue(
      product?.subcategory
    );


  const candidateSubcategory =
    normalizeValue(
      candidate?.subcategory
    );


  const productBrand =
    normalizeValue(
      product?.brand
    );


  const candidateBrand =
    normalizeValue(
      candidate?.brand
    );


  const productGender =
    normalizeValue(
      product?.gender
    );


  const candidateGender =
    normalizeValue(
      candidate?.gender
    );


  // ====================================================
  // COMPLEMENTARY CATEGORY
  //
  // Useful for cross-selling and basket building.
  // ====================================================

  score +=
    complementaryScore(
      product,
      candidate
    );


  // ====================================================
  // SAME CATEGORY
  // ====================================================

  if (
    productCategory &&
    productCategory ===
      candidateCategory
  ) {
    score +=
      18;
  }


  // ====================================================
  // SAME SUBCATEGORY
  // ====================================================

  if (
    productSubcategory &&
    productSubcategory ===
      candidateSubcategory
  ) {
    score +=
      15;
  }


  // ====================================================
  // SHARED TAGS
  // ====================================================

  score +=
    sharedValues(
      product?.tags,
      candidate?.tags
    ) *
    7;


  // ====================================================
  // SHARED ACTIVITY / USE CASE
  //
  // Supports common optional data fields if they exist.
  // ====================================================

  score +=
    sharedValues(
      product?.activities ||
        product?.activity ||
        product?.useCases,

      candidate?.activities ||
        candidate?.activity ||
        candidate?.useCases
    ) *
    6;


  // ====================================================
  // SAME AUDIENCE
  // ====================================================

  if (
    productGender &&
    candidateGender &&
    productGender ===
      candidateGender
  ) {
    score +=
      4;
  }


  // ====================================================
  // SAME BRAND
  // ====================================================

  if (
    productBrand &&
    candidateBrand &&
    productBrand ===
      candidateBrand
  ) {
    score +=
      3;
  }


  // ====================================================
  // SAME MATERIAL
  // ====================================================

  if (
    normalizeValue(
      product?.material
    ) &&
    normalizeValue(
      product?.material
    ) ===
      normalizeValue(
        candidate?.material
      )
  ) {
    score +=
      2;
  }


  // ====================================================
  // SIMILAR PRICE
  // ====================================================

  score +=
    priceSimilarityScore(
      product,
      candidate
    );


  // ====================================================
  // CATALOGUE QUALITY SIGNALS
  // ====================================================

  if (
    candidate?.isBestSeller
  ) {
    score +=
      5;
  }


  if (
    candidate?.isFeatured
  ) {
    score +=
      3;
  }


  if (
    candidate?.isNew
  ) {
    score +=
      2;
  }


  // ====================================================
  // STOCK
  // ====================================================

  if (
    getTotalStock(
      candidate
    ) >
    0
  ) {
    score +=
      8;
  }


  return score;
}


// ======================================================
// RELATED PRODUCTS
// ======================================================

export function rankRelated(
  product,
  catalogue
) {
  if (
    !product ||
    !Array.isArray(
      catalogue
    )
  ) {
    return [];
  }


  return catalogue
    .filter(
      (
        item
      ) =>
        item &&
        item.id !=
          null &&
        String(
          item.id
        ) !==
          String(
            product.id
          )
    )
    .map(
      (
        item,
        index
      ) => ({
        item,

        index,

        score:
          relatedScore(
            product,
            item
          ),

        stock:
          getTotalStock(
            item
          ),

        price:
          Number(
            getDiscountedPrice(
              item
            )
          ) ||
          0,
      })
    )
    .sort(
      (
        a,
        b
      ) => {
        // ----------------------------------------------
        // AVAILABLE PRODUCTS FIRST
        // ----------------------------------------------

        const aAvailable =
          a.stock >
          0
            ? 1
            : 0;


        const bAvailable =
          b.stock >
          0
            ? 1
            : 0;


        if (
          bAvailable !==
          aAvailable
        ) {
          return (
            bAvailable -
            aAvailable
          );
        }


        // ----------------------------------------------
        // RELEVANCE
        // ----------------------------------------------

        if (
          b.score !==
          a.score
        ) {
          return (
            b.score -
            a.score
          );
        }


        // ----------------------------------------------
        // STABLE ORIGINAL ORDER
        // ----------------------------------------------

        return (
          a.index -
          b.index
        );
      }
    )
    .map(
      (
        entry
      ) =>
        entry.item
    );
}


// ======================================================
// PRICE / STOCK WATCHES
// ======================================================

export function watchChanges(
  watches,
  catalogue
) {
  return watches.flatMap(
    (
      watch
    ) => {
      const product =
        catalogue.find(
          (
            item
          ) =>
            String(
              item.id
            ) ===
            String(
              watch.id
            )
        );


      if (
        !product
      ) {
        return [];
      }


      const price =
        getDiscountedPrice(
          product
        );


      const stock =
        getTotalStock(
          product
        );


      const updates =
        [];


      if (
        watch.stock ===
          0 &&
        stock >
          0
      ) {
        updates.push(
          "Back in stock"
        );
      }


      if (
        price <
        watch.price
      ) {
        updates.push(
          "Price dropped"
        );
      }


      return [
        {
          ...watch,

          product,

          priceNow:
            price,

          stockNow:
            stock,

          updates,
        },
      ];
    }
  );
}


// ======================================================
// DELIVERY DATE
// ======================================================

export function deliveredAt(
  order
) {
  const event = [
    ...(
      order.tracking
        ?.events ||
      []
    ),
  ]
    .reverse()
    .find(
      (
        entry
      ) =>
        entry.status ===
        "delivered"
    );


  return (
    order.deliveredAt ||
    order.delivery
      ?.deliveredAt ||
    event?.timestamp ||
    null
  );
}


// ======================================================
// RETURN ELIGIBILITY
// ======================================================

// A delivered timestamp is required;
// an order's creation date is not its delivery date.
export function returnEligibility(
  order,
  now =
    Date.now()
) {
  if (
    order.status !==
    "delivered"
  ) {
    return {
      eligible:
        false,

      message:
        "Returns and exchanges open after delivery.",
    };
  }


  if (
    order.returnRequest
      ?.status &&
    order.returnRequest
      .status !==
      "not-requested" &&
    order.returnRequest
      .status !==
      "rejected"
  ) {
    return {
      eligible:
        false,

      message:
        "A return or exchange request is already recorded for this order.",
    };
  }


  const start =
    Date.parse(
      deliveredAt(
        order
      )
    );


  if (
    !Number.isFinite(
      start
    ) ||
    start >
      now
  ) {
    return {
      eligible:
        false,

      message:
        "Contact support to confirm the delivery date and return eligibility.",
    };
  }


  const end =
    start +
    7 *
      86400000;


  return now <=
    end
    ? {
        eligible:
          true,

        deadline:
          new Date(
            end
          ).toISOString(),
      }

    : {
        eligible:
          false,

        message:
          "The 7-day request window has ended. Contact support for help.",
      };
}


// ======================================================
// RETURN / EXCHANGE VALIDATION
// ======================================================

export function validateReturnItems(
  order,
  requested,
  catalogue,
  type
) {
  if (
    !Array.isArray(
      requested
    ) ||
    !requested.length
  ) {
    return "Select at least one item.";
  }


  const seen =
    new Set();


  for (
    const row of
    requested
  ) {
    const item =
      order.items[
        row.index
      ];


    if (
      !Number.isSafeInteger(
        row.index
      ) ||
      !item ||
      seen.has(
        row.index
      ) ||
      !Number.isSafeInteger(
        row.quantity
      ) ||
      row.quantity <
        1 ||
      row.quantity >
        item.quantity
    ) {
      return "Choose valid item quantities.";
    }


    if (
      type ===
      "exchange"
    ) {
      const product =
        catalogue.find(
          (
            entry
          ) =>
            String(
              entry.id
            ) ===
            String(
              item.id
            )
        );


      const check =
        validateCartItem(
          product,
          row.quantity,
          row.size,
          row.color
        );


      if (
        !check.valid
      ) {
        return `${item.name}: ${check.message}`;
      }


      if (
        (
          row.size ??
          null
        ) ===
          (
            item.selectedSize ??
            null
          ) &&
        (
          row.color ??
          null
        ) ===
          (
            item.selectedColor ??
            null
          )
      ) {
        return "Choose a different size or colour for an exchange.";
      }
    }


    seen.add(
      row.index
    );
  }


  return "";
}


// ======================================================
// CSV
// ======================================================

export function csvCell(
  value
) {
  const text =
    String(
      value ??
        ""
    );


  return (
    '"' +
    (
      /^[\s]*[=+@-]/.test(
        text
      )
        ? "'"
        : ""
    ) +
    text.replaceAll(
      '"',
      '""'
    ) +
    '"'
  );
}


// ======================================================
// DOWNLOAD TEXT
// ======================================================

export function downloadText(
  filename,
  text,
  type =
    "text/plain"
) {
  const url =
    URL.createObjectURL(
      new Blob(
        [
          text,
        ],
        {
          type,
        }
      )
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    filename;


  document.body.append(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),

    1000
  );
}