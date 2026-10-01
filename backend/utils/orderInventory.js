function number(
  value,
  fallback = 0
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


function count(
  value
) {
  return Math.max(
    0,
    Math.floor(
      number(value)
    )
  );
}


function own(
  object,
  key
) {
  return Object.prototype
    .hasOwnProperty.call(
      object || {},
      key
    );
}


// ======================================================
// TOTAL STOCK
// ======================================================

function getTotalStock(
  product
) {
  if (
    !product ||
    product.stockStatus ===
      "out-of-stock"
  ) {
    return 0;
  }


  const sum = (
    value
  ) =>
    value &&
    typeof value ===
      "object"
      ? Object.values(
          value
        ).reduce(
          (
            total,
            child
          ) =>
            total +
            sum(child),
          0
        )
      : count(value);


  return product.variants
    ? sum(
        product.variants
      )
    : count(
        product.stock
      );
}


// ======================================================
// VARIANT STOCK
// ======================================================

function getVariantStock(
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
    (
      product.sizes ||
      []
    ).map(String);


  const colors =
    (
      product.colors ||
      []
    ).map(String);


  if (
    sizes.length &&
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


  if (
    colors.length &&
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


  if (
    !product.variants
  ) {
    return count(
      product.stock
    );
  }


  let group =
    product.variants;


  if (
    colors.length
  ) {
    if (
      !own(
        group,
        selectedColor
      )
    ) {
      return 0;
    }


    group =
      group[
        selectedColor
      ];
  }


  if (
    sizes.length
  ) {
    return own(
      group,
      selectedSize
    )
      ? count(
          group[
            selectedSize
          ]
        )
      : 0;
  }


  return typeof group ===
    "object"
      ? count(
          group?.default
        )
      : count(
          group
        );
}


// ======================================================
// VARIANT TOTAL
// ======================================================

function calculateVariantTotal(
  variants
) {
  const sum = (
    value
  ) => {
    if (
      value &&
      typeof value ===
        "object"
    ) {
      return Object
        .values(value)
        .reduce(
          (
            total,
            child
          ) =>
            total +
            sum(child),
          0
        );
    }


    return count(
      value
    );
  };


  return sum(
    variants ||
      {}
  );
}


// ======================================================
// STOCK STATUS
// ======================================================

function updateStockStatus(
  product
) {
  const stock =
    count(
      product.stock
    );


  product.stockStatus =
    stock <= 0
      ? "out-of-stock"
      : stock <= 10
        ? "low-stock"
        : "in-stock";
}


// ======================================================
// RESERVE STOCK
//
// Used when an order is placed.
// ======================================================

function reserveVariantStock(
  product,
  quantity,
  selectedSize = null,
  selectedColor = null
) {
  const qty =
    Number(
      quantity
    );


  if (
    !Number.isSafeInteger(
      qty
    ) ||
    qty < 1
  ) {
    throw new Error(
      "Invalid order quantity."
    );
  }


  const available =
    getVariantStock(
      product,
      selectedSize,
      selectedColor
    );


  if (
    available <
    qty
  ) {
    throw new Error(
      available > 0
        ? `Only ${available} available for this selection.`
        : "This product selection is out of stock."
    );
  }


  const sizes =
    (
      product.sizes ||
      []
    ).map(String);


  const colors =
    (
      product.colors ||
      []
    ).map(String);


  if (
    product.variants
  ) {
    if (
      colors.length
    ) {
      const color =
        String(
          selectedColor
        );


      if (
        sizes.length
      ) {
        const size =
          String(
            selectedSize
          );


        product.variants[
          color
        ][
          size
        ] =
          count(
            product.variants[
              color
            ][
              size
            ]
          ) -
          qty;

      } else {
        product.variants[
          color
        ].default =
          count(
            product.variants[
              color
            ]?.default
          ) -
          qty;
      }

    } else if (
      sizes.length
    ) {
      const size =
        String(
          selectedSize
        );


      product.variants[
        size
      ] =
        count(
          product.variants[
            size
          ]
        ) -
        qty;

    } else {
      product.variants.default =
        count(
          product.variants
            ?.default
        ) -
        qty;
    }


    if (
      typeof product.markModified ===
      "function"
    ) {
      product.markModified(
        "variants"
      );
    }


    product.stock =
      calculateVariantTotal(
        product.variants
      );

  } else {
    product.stock =
      count(
        product.stock
      ) -
      qty;
  }


  updateStockStatus(
    product
  );


  return product;
}


// ======================================================
// RESTORE STOCK
//
// Used when an order is cancelled.
// ======================================================

function restoreVariantStock(
  product,
  quantity,
  selectedSize = null,
  selectedColor = null
) {
  const qty =
    Number(
      quantity
    );


  if (
    !Number.isSafeInteger(
      qty
    ) ||
    qty < 1
  ) {
    throw new Error(
      "Invalid restore quantity."
    );
  }


  const sizes =
    (
      product.sizes ||
      []
    ).map(String);


  const colors =
    (
      product.colors ||
      []
    ).map(String);


  if (
    product.variants
  ) {
    if (
      colors.length
    ) {
      const color =
        String(
          selectedColor
        );


      if (
        !own(
          product.variants,
          color
        )
      ) {
        throw new Error(
          "Product colour variant no longer exists."
        );
      }


      if (
        sizes.length
      ) {
        const size =
          String(
            selectedSize
          );


        if (
          !own(
            product.variants[
              color
            ],
            size
          )
        ) {
          throw new Error(
            "Product size variant no longer exists."
          );
        }


        product.variants[
          color
        ][
          size
        ] =
          count(
            product.variants[
              color
            ][
              size
            ]
          ) +
          qty;

      } else {
        product.variants[
          color
        ].default =
          count(
            product.variants[
              color
            ]?.default
          ) +
          qty;
      }

    } else if (
      sizes.length
    ) {
      const size =
        String(
          selectedSize
        );


      if (
        !own(
          product.variants,
          size
        )
      ) {
        throw new Error(
          "Product size variant no longer exists."
        );
      }


      product.variants[
        size
      ] =
        count(
          product.variants[
            size
          ]
        ) +
        qty;

    } else {
      product.variants.default =
        count(
          product.variants
            ?.default
        ) +
        qty;
    }


    if (
      typeof product.markModified ===
      "function"
    ) {
      product.markModified(
        "variants"
      );
    }


    product.stock =
      calculateVariantTotal(
        product.variants
      );

  } else {
    product.stock =
      count(
        product.stock
      ) +
      qty;
  }


  updateStockStatus(
    product
  );


  return product;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getTotalStock,
  getVariantStock,
  reserveVariantStock,
  restoreVariantStock,
  updateStockStatus,
};