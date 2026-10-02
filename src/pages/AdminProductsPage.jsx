import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import {
  getAdminProducts,
  createProduct,
  updateProduct,
  updateProductInventory,
  archiveProduct,
  restoreProduct,
} from "../services/productApi.js";


// ======================================================
// CONSTANTS
// ======================================================

const PAGE_SIZE = 25;


const EMPTY_DRAFT = {
  id: "",
  _id: "",

  name: "",
  slug: "",
  sku: "",

  category: "",
  subcategory: "",

  brand: "GymDrobe",
  gender: "Unisex",

  price: "",
  discount: "0",

  badge: "",

  description: "",
  material: "",
  whatsIncluded: "",
  returnPolicy: "",

  image: "",

  imagesText: "",

  tagsText: "",
  highlightsText: "",
  careInstructionsText: "",

  sizesText: "",
  colorsText: "",

  specificationsText: "",

  stock: "0",

  variants: {},

  isFeatured: false,
  isBestSeller: false,
  isNew: false,
  isActive: true,

  deliveryAvailable: true,

  estimatedDays:
    "3–7 business days",

  freeDeliveryAbove:
    "500",
};


// ======================================================
// HELPERS
// ======================================================

function productId(
  product
) {
  return (
    product?._id ||
    product?.id ||
    product?.slug ||
    ""
  );
}


function splitComma(
  value
) {
  return String(
    value || ""
  )
    .split(",")
    .map(
      (item) =>
        item.trim()
    )
    .filter(
      Boolean
    );
}


function splitLines(
  value
) {
  return String(
    value || ""
  )
    .split(
      /\r?\n/
    )
    .map(
      (item) =>
        item.trim()
    )
    .filter(
      Boolean
    );
}


function joinComma(
  value
) {
  return Array.isArray(
    value
  )
    ? value.join(
        ", "
      )
    : "";
}


function joinLines(
  value
) {
  return Array.isArray(
    value
  )
    ? value.join(
        "\n"
      )
    : "";
}


function money(
  value
) {
  return new Intl.NumberFormat(
    "en-IN",
    {
      style:
        "currency",

      currency:
        "INR",

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      value ||
        0
    )
  );
}


function safeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(
      value
    );


  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}


function stockLabel(
  status
) {
  const labels = {
    "in-stock":
      "In stock",

    "low-stock":
      "Low stock",

    "out-of-stock":
      "Out of stock",
  };


  return (
    labels[
      status
    ] ||
    "Unknown"
  );
}


function formatDate(
  value
) {
  if (
    !value
  ) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date.toLocaleString(
    "en-IN",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}


function parseSpecifications(
  value
) {
  const result =
    {};


  const lines =
    splitLines(
      value
    );


  for (
    const line
    of lines
  ) {
    const index =
      line.indexOf(
        ":"
      );


    if (
      index ===
      -1
    ) {
      continue;
    }


    const key =
      line
        .slice(
          0,
          index
        )
        .trim();


    const itemValue =
      line
        .slice(
          index +
            1
        )
        .trim();


    if (
      key
    ) {
      result[
        key
      ] =
        itemValue;
    }
  }


  return result;
}


function stringifySpecifications(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return "";
  }


  return Object.entries(
    value
  )
    .map(
      (
        [
          key,
          itemValue,
        ]
      ) =>
        `${key}: ${String(
          itemValue ??
            ""
        )}`
    )
    .join(
      "\n"
    );
}


function cloneVariants(
  value
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return {};
  }


  try {
    return structuredClone(
      value
    );

  } catch {
    return JSON.parse(
      JSON.stringify(
        value
      )
    );
  }
}


// ======================================================
// CREATE EDITOR DRAFT
// ======================================================

function makeDraft(
  product
) {
  if (
    !product
  ) {
    return {
      ...EMPTY_DRAFT,

      variants:
        {},
    };
  }


  return {
    id:
      product.id ||
      product._id ||
      "",

    _id:
      product._id ||
      product.id ||
      "",

    name:
      product.name ||
      "",

    slug:
      product.slug ||
      "",

    sku:
      product.sku ||
      "",

    category:
      product.category ||
      "",

    subcategory:
      product.subcategory ||
      "",

    brand:
      product.brand ||
      "GymDrobe",

    gender:
      product.gender ||
      "Unisex",

    price:
      String(
        product.price ??
          ""
      ),

    discount:
      String(
        product.discount ??
          0
      ),

    badge:
      product.badge ||
      "",

    description:
      product.description ||
      "",

    material:
      product.material ||
      "",

    whatsIncluded:
      product.whatsIncluded ||
      "",

    returnPolicy:
      product.returnPolicy ||
      "",

    image:
      product.image ||
      "",

    imagesText:
      joinLines(
        product.images
      ),

    tagsText:
      joinComma(
        product.tags
      ),

    highlightsText:
      joinLines(
        product.highlights
      ),

    careInstructionsText:
      joinLines(
        product.careInstructions
      ),

    sizesText:
      joinComma(
        product.sizes
      ),

    colorsText:
      joinComma(
        product.colors
      ),

    specificationsText:
      stringifySpecifications(
        product.specifications
      ),

    stock:
      String(
        product.stock ??
          0
      ),

    variants:
      cloneVariants(
        product.variants
      ),

    isFeatured:
      Boolean(
        product.isFeatured
      ),

    isBestSeller:
      Boolean(
        product.isBestSeller
      ),

    isNew:
      Boolean(
        product.isNew
      ),

    isActive:
      product.isActive !==
      false,

    deliveryAvailable:
      product.delivery
        ?.available !==
      false,

    estimatedDays:
      product.delivery
        ?.estimatedDays ||
      "",

    freeDeliveryAbove:
      String(
        product.delivery
          ?.freeDeliveryAbove ??
          500
      ),
  };
}


// ======================================================
// BUILD VARIANTS
//
// SUPPORTED:
//
// 1. Colour + Size
//    variants[color][size]
//
// 2. Colour only
//    variants[color].default
//
// 3. Size only
//    variants[size]
//
// 4. No options
//    normal stock field
// ======================================================

function buildVariants(
  draft
) {
  const colors =
    splitComma(
      draft.colorsText
    );


  const sizes =
    splitComma(
      draft.sizesText
    );


  const previous =
    draft.variants &&
    typeof draft.variants ===
      "object"
      ? draft.variants
      : {};


  function quantity(
    value
  ) {
    return Math.max(
      0,

      Math.floor(
        safeNumber(
          value,
          0
        )
      )
    );
  }


  // ====================================================
  // NO COLOUR + NO SIZE
  // ====================================================

  if (
    colors.length ===
      0 &&
    sizes.length ===
      0
  ) {
    return null;
  }


  const variants =
    {};


  // ====================================================
  // COLOUR + SIZE
  // variants[color][size]
  // ====================================================

  if (
    colors.length >
      0 &&
    sizes.length >
      0
  ) {
    for (
      const color
      of colors
    ) {
      variants[
        color
      ] =
        {};


      for (
        const size
        of sizes
      ) {
        variants[
          color
        ][
          size
        ] =
          quantity(
            previous?.[
              color
            ]?.[
              size
            ]
          );
      }
    }


    return variants;
  }


  // ====================================================
  // COLOUR ONLY
  // variants[color].default
  // ====================================================

  if (
    colors.length >
    0
  ) {
    for (
      const color
      of colors
    ) {
      variants[
        color
      ] = {
        default:
          quantity(
            previous?.[
              color
            ]?.default
          ),
      };
    }


    return variants;
  }


  // ====================================================
  // SIZE ONLY
  // variants[size]
  // ====================================================

  for (
    const size
    of sizes
  ) {
    variants[
      size
    ] =
      quantity(
        previous?.[
          size
        ]
      );
  }


  return variants;
}


// ======================================================
// PRODUCT PAYLOAD
// ======================================================

function buildProductPayload(
  draft,
  {
    creating = false,
  } = {}
) {
  const variants =
    buildVariants(
      draft
    );


  const payload = {
    name:
      draft.name.trim(),

    sku:
      draft.sku
        .trim()
        .toUpperCase(),

    category:
      draft.category.trim(),

    subcategory:
      draft.subcategory.trim(),

    brand:
      draft.brand.trim() ||
      "GymDrobe",

    gender:
      draft.gender.trim() ||
      "Unisex",

    price:
      safeNumber(
        draft.price
      ),

    discount:
      safeNumber(
        draft.discount
      ),

    badge:
      draft.badge.trim(),

    description:
      draft.description.trim(),

    material:
      draft.material.trim(),

    whatsIncluded:
      draft.whatsIncluded.trim(),

    returnPolicy:
      draft.returnPolicy.trim(),

    image:
      draft.image.trim(),

    images:
      splitLines(
        draft.imagesText
      ),

    tags:
      splitComma(
        draft.tagsText
      ),

    highlights:
      splitLines(
        draft.highlightsText
      ),

    careInstructions:
      splitLines(
        draft.careInstructionsText
      ),

    sizes:
      splitComma(
        draft.sizesText
      ),

    colors:
      splitComma(
        draft.colorsText
      ),

    specifications:
      parseSpecifications(
        draft.specificationsText
      ),

    isFeatured:
      Boolean(
        draft.isFeatured
      ),

    isBestSeller:
      Boolean(
        draft.isBestSeller
      ),

    isNew:
      Boolean(
        draft.isNew
      ),

    isActive:
      Boolean(
        draft.isActive
      ),

    delivery: {
      available:
        Boolean(
          draft.deliveryAvailable
        ),

      estimatedDays:
        draft.estimatedDays
          .trim() ||
        null,

      freeDeliveryAbove:
        Math.max(
          0,

          safeNumber(
            draft.freeDeliveryAbove,
            500
          )
        ),
    },
  };


  if (
    draft.slug.trim()
  ) {
    payload.slug =
      draft.slug.trim();
  }


  if (
    variants
  ) {
    payload.variants =
      variants;

  } else {
    payload.variants =
      {};

    payload.stock =
      Math.max(
        0,

        Math.floor(
          safeNumber(
            draft.stock
          )
        )
      );
  }


  if (
    creating
  ) {
    delete payload.isActive;

    payload.isActive =
      true;
  }


  return payload;
}


// ======================================================
// FIELD COMPONENT
// ======================================================

function Field({
  label,
  children,
  help,
}) {
  return (
    <label
      style={{
        display:
          "grid",

        gap:
          "7px",
      }}
    >
      <strong>
        {
          label
        }
      </strong>

      {
        children
      }

      {help && (
        <small
          className="muted"
        >
          {
            help
          }
        </small>
      )}
    </label>
  );
}


// ======================================================
// CHECKBOX COMPONENT
// ======================================================

function Checkbox({
  checked,
  onChange,
  children,
}) {
  return (
    <label
      style={{
        display:
          "flex",

        gap:
          "10px",

        alignItems:
          "center",
      }}
    >
      <input
        type="checkbox"
        checked={
          checked
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event.target
                .checked
            )
        }
      />

      <span>
        {
          children
        }
      </span>
    </label>
  );
}


// ======================================================
// STATUS BADGE
// ======================================================

function StatusBadge({
  product,
}) {
  const archived =
    product.isActive ===
    false;


  const text =
    archived
      ? "Archived"
      : stockLabel(
          product.stockStatus
        );


  return (
    <span
      style={{
        display:
          "inline-flex",

        padding:
          "5px 9px",

        borderRadius:
          "999px",

        border:
          "1px solid currentColor",

        fontSize:
          "12px",

        fontWeight:
          "700",

        opacity:
          archived
            ? 0.65
            : 1,
      }}
    >
      {
        text
      }
    </span>
  );
}


// ======================================================
// INVENTORY EDITOR
// ======================================================

function InventoryEditor({
  draft,
  setDraft,
}) {
  const colors =
    splitComma(
      draft.colorsText
    );


  const sizes =
    splitComma(
      draft.sizesText
    );


  function stockQuantity(
    value
  ) {
    return Math.max(
      0,

      Math.floor(
        safeNumber(
          value,
          0
        )
      )
    );
  }


  // ====================================================
  // COLOUR + SIZE STOCK
  // ====================================================

  function setColorSizeStock(
    color,
    size,
    value
  ) {
    const quantity =
      stockQuantity(
        value
      );


    setDraft(
      (
        current
      ) => {
        const variants =
          cloneVariants(
            current.variants
          );


        if (
          !variants[
            color
          ] ||
          typeof variants[
            color
          ] !==
            "object"
        ) {
          variants[
            color
          ] =
            {};
        }


        variants[
          color
        ][
          size
        ] =
          quantity;


        return {
          ...current,

          variants,
        };
      }
    );
  }


  // ====================================================
  // COLOUR ONLY STOCK
  // ====================================================

  function setColorStock(
    color,
    value
  ) {
    const quantity =
      stockQuantity(
        value
      );


    setDraft(
      (
        current
      ) => {
        const variants =
          cloneVariants(
            current.variants
          );


        variants[
          color
        ] = {
          ...(
            variants[
              color
            ] &&
            typeof variants[
              color
            ] ===
              "object"
              ? variants[
                  color
                ]
              : {}
          ),

          default:
            quantity,
        };


        return {
          ...current,

          variants,
        };
      }
    );
  }


  // ====================================================
  // SIZE ONLY STOCK
  // ====================================================

  function setSizeStock(
    size,
    value
  ) {
    const quantity =
      stockQuantity(
        value
      );


    setDraft(
      (
        current
      ) => {
        const variants =
          cloneVariants(
            current.variants
          );


        variants[
          size
        ] =
          quantity;


        return {
          ...current,

          variants,
        };
      }
    );
  }


  // ====================================================
  // NO COLOUR + NO SIZE
  // ====================================================

  if (
    colors.length ===
      0 &&
    sizes.length ===
      0
  ) {
    return (
      <div
        className="panel"
      >
        <h3>
          INVENTORY
        </h3>

        <p
          className="muted"
        >
          This product has no size or colour options, so use one total stock quantity.
        </p>

        <Field
          label="Total stock"
        >
          <input
            className="field"
            type="number"
            min="0"
            step="1"
            value={
              draft.stock
            }
            onChange={
              (
                event
              ) =>
                setDraft(
                  (
                    current
                  ) => ({
                    ...current,

                    stock:
                      event.target
                        .value,
                  })
                )
            }
          />
        </Field>
      </div>
    );
  }


  // ====================================================
  // SIZE ONLY
  // ====================================================

  if (
    colors.length ===
      0 &&
    sizes.length >
      0
  ) {
    return (
      <div
        className="panel"
      >
        <h3>
          SIZE INVENTORY
        </h3>

        <p
          className="muted"
        >
          Set the available quantity for each size. Total stock is calculated automatically.
        </p>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(120px, 1fr))",

            gap:
              "12px",

            marginTop:
              "16px",
          }}
        >
          {sizes.map(
            (
              size
            ) => (
              <Field
                key={
                  size
                }
                label={`Size ${size}`}
              >
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    draft
                      .variants?.[
                        size
                      ] ??
                    0
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setSizeStock(
                        size,
                        event.target
                          .value
                      )
                  }
                />
              </Field>
            )
          )}
        </div>
      </div>
    );
  }


  // ====================================================
  // COLOUR ONLY
  // ====================================================

  if (
    colors.length >
      0 &&
    sizes.length ===
      0
  ) {
    return (
      <div
        className="panel"
      >
        <h3>
          COLOUR INVENTORY
        </h3>

        <p
          className="muted"
        >
          Set the available quantity for each colour. Total stock is calculated automatically.
        </p>

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, 1fr))",

            gap:
              "12px",

            marginTop:
              "16px",
          }}
        >
          {colors.map(
            (
              color
            ) => (
              <Field
                key={
                  color
                }
                label={
                  color
                }
              >
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  value={
                    draft
                      .variants?.[
                        color
                      ]?.default ??
                    0
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setColorStock(
                        color,
                        event.target
                          .value
                      )
                  }
                />
              </Field>
            )
          )}
        </div>
      </div>
    );
  }


  // ====================================================
  // COLOUR + SIZE
  // ====================================================

  return (
    <div
      className="panel"
    >
      <h3>
        VARIANT INVENTORY
      </h3>

      <p
        className="muted"
      >
        Set stock for every colour and size combination. Total stock is calculated automatically.
      </p>

      <div
        style={{
          display:
            "grid",

          gap:
            "18px",

          marginTop:
            "16px",
        }}
      >
        {colors.map(
          (
            color
          ) => (
            <div
              key={
                color
              }
              style={{
                border:
                  "1px solid #e5e7eb",

                borderRadius:
                  "12px",

                padding:
                  "14px",
              }}
            >
              <strong>
                {
                  color
                }
              </strong>

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(120px, 1fr))",

                  gap:
                    "10px",

                  marginTop:
                    "12px",
                }}
              >
                {sizes.map(
                  (
                    size
                  ) => (
                    <Field
                      key={
                        `${color}-${size}`
                      }
                      label={`Size ${size}`}
                    >
                      <input
                        className="field"
                        type="number"
                        min="0"
                        step="1"
                        value={
                          draft
                            .variants?.[
                              color
                            ]?.[
                              size
                            ] ??
                          0
                        }
                        onChange={
                          (
                            event
                          ) =>
                            setColorSizeStock(
                              color,
                              size,
                              event.target
                                .value
                            )
                        }
                      />
                    </Field>
                  )
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}


// ======================================================
// PRODUCT EDITOR
// ======================================================

function ProductEditor({
  draft,
  setDraft,
  mode,
  busy,
  error,
  onSave,
  onCancel,
}) {
  const creating =
    mode ===
    "create";


  function field(
    name,
    value
  ) {
    setDraft(
      (
        current
      ) => ({
        ...current,

        [
          name
        ]:
          value,
      })
    );
  }


  return (
    <section
      className="panel"
      style={{
        marginBottom:
          "28px",
      }}
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          gap:
            "14px",

          flexWrap:
            "wrap",

          alignItems:
            "center",
        }}
      >
        <div>
          <p
            className="eyebrow"
          >
            ADMIN PRODUCT EDITOR
          </p>

          <h2>
            {creating
              ? "Add new product"
              : `Edit ${draft.name || "product"}`}
          </h2>
        </div>


        <button
          type="button"
          className="button secondary"
          disabled={
            busy
          }
          onClick={
            onCancel
          }
        >
          Cancel
        </button>
      </div>


      {error && (
        <p
          className="field-error"
          role="alert"
        >
          {
            error
          }
        </p>
      )}


      <form
        onSubmit={
          (
            event
          ) => {
            event.preventDefault();

            onSave();
          }
        }
        style={{
          display:
            "grid",

          gap:
            "22px",

          marginTop:
            "22px",
        }}
      >
        {/* BASIC INFORMATION */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",

            gap:
              "16px",
          }}
        >
          <Field
            label="Product name *"
          >
            <input
              className="field"
              value={
                draft.name
              }
              required
              onChange={
                (
                  event
                ) =>
                  field(
                    "name",
                    event.target
                      .value
                  )
              }
            />
          </Field>


          <Field
            label="SKU *"
            help="Example: GD-TSHIRT-002"
          >
            <input
              className="field"
              value={
                draft.sku
              }
              required
              onChange={
                (
                  event
                ) =>
                  field(
                    "sku",

                    event.target
                      .value
                      .toUpperCase()
                  )
              }
            />
          </Field>


          <Field
            label="Slug"
            help="Leave blank when creating and GymDrobe will generate it from the product name."
          >
            <input
              className="field"
              value={
                draft.slug
              }
              onChange={
                (
                  event
                ) =>
                  field(
                    "slug",

                    event.target
                      .value
                  )
              }
            />
          </Field>


          <Field
            label="Brand"
          >
            <input
              className="field"
              value={
                draft.brand
              }
              onChange={
                (
                  event
                ) =>
                  field(
                    "brand",

                    event.target
                      .value
                  )
              }
            />
          </Field>


          <Field
            label="Category *"
            help="Example: Workout Clothes"
          >
            <input
              className="field"
              value={
                draft.category
              }
              required
              onChange={
                (
                  event
                ) =>
                  field(
                    "category",

                    event.target
                      .value
                  )
              }
            />
          </Field>


          <Field
            label="Subcategory"
          >
            <input
              className="field"
              value={
                draft.subcategory
              }
              onChange={
                (
                  event
                ) =>
                  field(
                    "subcategory",

                    event.target
                      .value
                  )
              }
            />
          </Field>


          <Field
            label="Gender"
          >
            <select
              className="field"
              value={
                draft.gender
              }
              onChange={
                (
                  event
                ) =>
                  field(
                    "gender",

                    event.target
                      .value
                  )
              }
            >
              <option
                value="Unisex"
              >
                Unisex
              </option>

              <option
                value="Men"
              >
                Men
              </option>

              <option
                value="Women"
              >
                Women
              </option>

              <option
                value="Kids"
              >
                Kids
              </option>
            </select>
          </Field>


          <Field
            label="Badge"
            help="Example: BESTSELLER"
          >
            <input
              className="field"
              value={
                draft.badge
              }
              onChange={
                (
                  event
                ) =>
                  field(
                    "badge",

                    event.target
                      .value
                  )
              }
            />
          </Field>
        </div>


        {/* PRICING */}

        <div
          className="panel"
        >
          <h3>
            PRICING
          </h3>

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",

              gap:
                "16px",
            }}
          >
            <Field
              label="Original price (₹) *"
            >
              <input
                className="field"
                type="number"
                min="0"
                step="1"
                required
                value={
                  draft.price
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "price",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Discount (%)"
            >
              <input
                className="field"
                type="number"
                min="0"
                max="100"
                step="1"
                value={
                  draft.discount
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "discount",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <div>
              <strong>
                Selling price
              </strong>

              <p
                style={{
                  fontSize:
                    "24px",

                  fontWeight:
                    "800",

                  marginTop:
                    "10px",
                }}
              >
                {money(
                  safeNumber(
                    draft.price
                  ) *
                    (
                      1 -
                      safeNumber(
                        draft.discount
                      ) /
                        100
                    )
                )}
              </p>
            </div>
          </div>
        </div>


        {/* OPTIONS */}

        <div
          className="panel"
        >
          <h3>
            PRODUCT OPTIONS
          </h3>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",

              gap:
                "16px",
            }}
          >
            <Field
              label="Colours"
              help="Separate with commas. Example: Black, White, Blue"
            >
              <input
                className="field"
                value={
                  draft.colorsText
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "colorsText",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Sizes"
              help="Separate with commas. Example: S, M, L, XL"
            >
              <input
                className="field"
                value={
                  draft.sizesText
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "sizesText",

                      event.target
                        .value
                    )
                }
              />
            </Field>
          </div>
        </div>


        <InventoryEditor
          draft={
            draft
          }
          setDraft={
            setDraft
          }
        />


        {/* PRODUCT DETAILS */}

        <div
          className="panel"
        >
          <h3>
            PRODUCT DETAILS
          </h3>


          <div
            style={{
              display:
                "grid",

              gap:
                "16px",
            }}
          >
            <Field
              label="Description"
            >
              <textarea
                className="field"
                rows="5"
                value={
                  draft.description
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "description",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Material"
            >
              <input
                className="field"
                value={
                  draft.material
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "material",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="What's included"
            >
              <input
                className="field"
                value={
                  draft.whatsIncluded
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "whatsIncluded",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Tags"
              help="Separate with commas."
            >
              <input
                className="field"
                value={
                  draft.tagsText
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "tagsText",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Highlights"
              help="Write one highlight per line."
            >
              <textarea
                className="field"
                rows="5"
                value={
                  draft.highlightsText
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "highlightsText",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Specifications"
              help={'One per line using "Name: Value". Example: Material: Cotton'}
            >
              <textarea
                className="field"
                rows="6"
                value={
                  draft.specificationsText
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "specificationsText",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Care instructions"
              help="Write one instruction per line."
            >
              <textarea
                className="field"
                rows="5"
                value={
                  draft.careInstructionsText
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "careInstructionsText",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Return policy"
            >
              <textarea
                className="field"
                rows="3"
                value={
                  draft.returnPolicy
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "returnPolicy",

                      event.target
                        .value
                    )
                }
              />
            </Field>
          </div>
        </div>


        {/* IMAGES */}

        <div
          className="panel"
        >
          <h3>
            PRODUCT IMAGES
          </h3>


          <div
            style={{
              display:
                "grid",

              gap:
                "16px",
            }}
          >
            <Field
              label="Main image"
              help="Enter an image path or URL."
            >
              <input
                className="field"
                value={
                  draft.image
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "image",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Image gallery"
              help="Enter one image path or URL per line."
            >
              <textarea
                className="field"
                rows="5"
                value={
                  draft.imagesText
                }
                onChange={
                  (
                    event
                  ) =>
                    field(
                      "imagesText",

                      event.target
                        .value
                    )
                }
              />
            </Field>


            {draft.image && (
              <div
                style={{
                  width:
                    "160px",

                  aspectRatio:
                    "1 / 1",

                  overflow:
                    "hidden",

                  borderRadius:
                    "12px",

                  border:
                    "1px solid #e5e7eb",
                }}
              >
                <img
                  src={
                    draft.image
                  }
                  alt=""
                  style={{
                    width:
                      "100%",

                    height:
                      "100%",

                    objectFit:
                      "cover",
                  }}
                />
              </div>
            )}
          </div>
        </div>


        {/* DELIVERY */}

        <div
          className="panel"
        >
          <h3>
            DELIVERY
          </h3>


          <div
            style={{
              display:
                "grid",

              gap:
                "16px",
            }}
          >
            <Checkbox
              checked={
                draft.deliveryAvailable
              }
              onChange={
                (
                  value
                ) =>
                  field(
                    "deliveryAvailable",
                    value
                  )
              }
            >
              Delivery available
            </Checkbox>


            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",

                gap:
                  "16px",
              }}
            >
              <Field
                label="Estimated delivery"
              >
                <input
                  className="field"
                  value={
                    draft.estimatedDays
                  }
                  onChange={
                    (
                      event
                    ) =>
                      field(
                        "estimatedDays",

                        event.target
                          .value
                      )
                  }
                />
              </Field>


              <Field
                label="Free delivery above ₹"
              >
                <input
                  className="field"
                  type="number"
                  min="0"
                  value={
                    draft.freeDeliveryAbove
                  }
                  onChange={
                    (
                      event
                    ) =>
                      field(
                        "freeDeliveryAbove",

                        event.target
                          .value
                      )
                  }
                />
              </Field>
            </div>
          </div>
        </div>


        {/* STORE VISIBILITY */}

        <div
          className="panel"
        >
          <h3>
            STORE VISIBILITY
          </h3>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",

              gap:
                "14px",
            }}
          >
            <Checkbox
              checked={
                draft.isFeatured
              }
              onChange={
                (
                  value
                ) =>
                  field(
                    "isFeatured",
                    value
                  )
              }
            >
              Featured product
            </Checkbox>


            <Checkbox
              checked={
                draft.isBestSeller
              }
              onChange={
                (
                  value
                ) =>
                  field(
                    "isBestSeller",
                    value
                  )
              }
            >
              Bestseller
            </Checkbox>


            <Checkbox
              checked={
                draft.isNew
              }
              onChange={
                (
                  value
                ) =>
                  field(
                    "isNew",
                    value
                  )
              }
            >
              New arrival
            </Checkbox>


            {!creating && (
              <Checkbox
                checked={
                  draft.isActive
                }
                onChange={
                  (
                    value
                  ) =>
                    field(
                      "isActive",
                      value
                    )
                }
              >
                Product active
              </Checkbox>
            )}
          </div>
        </div>


        <div
          style={{
            display:
              "flex",

            gap:
              "12px",

            flexWrap:
              "wrap",
          }}
        >
          <button
            type="submit"
            className="button"
            disabled={
              busy
            }
          >
            {busy
              ? "Saving…"
              : creating
                ? "Create product"
                : "Save product"}
          </button>


          <button
            type="button"
            className="button secondary"
            disabled={
              busy
            }
            onClick={
              onCancel
            }
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}


// ======================================================
// PRODUCT CARD
// ======================================================

function AdminProductCard({
  product,
  busyId,
  onEdit,
  onArchive,
  onRestore,
}) {
  const id =
    productId(
      product
    );


  const busy =
    busyId ===
    id;


  return (
    <article
      className="panel"
    >
      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "100px minmax(0, 1fr)",

          gap:
            "18px",

          alignItems:
            "start",
        }}
      >
        <div
          style={{
            width:
              "100px",

            height:
              "100px",

            borderRadius:
              "12px",

            overflow:
              "hidden",

            background:
              "#f4f4f5",
          }}
        >
          {product.image ? (
            <img
              src={
                product.image
              }
              alt={
                product.name ||
                ""
              }
              style={{
                width:
                  "100%",

                height:
                  "100%",

                objectFit:
                  "cover",
              }}
            />

          ) : (
            <div
              style={{
                display:
                  "grid",

                placeItems:
                  "center",

                width:
                  "100%",

                height:
                  "100%",

                fontSize:
                  "12px",
              }}
            >
              No image
            </div>
          )}
        </div>


        <div
          style={{
            minWidth:
              0,
          }}
        >
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              gap:
                "12px",

              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h3
                style={{
                  margin:
                    "0 0 6px",
                }}
              >
                {
                  product.name
                }
              </h3>

              <p
                className="muted"
                style={{
                  margin:
                    0,
                }}
              >
                {product.sku ||
                  "No SKU"}

                {" · "}

                {product.category ||
                  "No category"}
              </p>
            </div>


            <StatusBadge
              product={
                product
              }
            />
          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit, minmax(110px, 1fr))",

              gap:
                "12px",

              marginTop:
                "16px",
            }}
          >
            <div>
              <small
                className="muted"
              >
                Price
              </small>

              <strong
                style={{
                  display:
                    "block",
                }}
              >
                {money(
                  product.price
                )}
              </strong>
            </div>


            <div>
              <small
                className="muted"
              >
                Discount
              </small>

              <strong
                style={{
                  display:
                    "block",
                }}
              >
                {safeNumber(
                  product.discount
                )}
                %
              </strong>
            </div>


            <div>
              <small
                className="muted"
              >
                Stock
              </small>

              <strong
                style={{
                  display:
                    "block",
                }}
              >
                {safeNumber(
                  product.stock
                )}
              </strong>
            </div>


            <div>
              <small
                className="muted"
              >
                Rating
              </small>

              <strong
                style={{
                  display:
                    "block",
                }}
              >
                {safeNumber(
                  product.rating
                ).toFixed(
                  1
                )}
              </strong>
            </div>
          </div>


          <p
            className="muted"
            style={{
              marginTop:
                "14px",
            }}
          >
            Updated{" "}

            {formatDate(
              product.updatedAt
            ) ||
              "—"}
          </p>


          <div
            style={{
              display:
                "flex",

              gap:
                "10px",

              flexWrap:
                "wrap",

              marginTop:
                "14px",
            }}
          >
            <button
              type="button"
              className="button secondary"
              disabled={
                busy
              }
              onClick={
                () =>
                  onEdit(
                    product
                  )
              }
            >
              Edit product
            </button>


            {product.isActive ===
            false ? (
              <button
                type="button"
                className="button"
                disabled={
                  busy
                }
                onClick={
                  () =>
                    onRestore(
                      product
                    )
                }
              >
                {busy
                  ? "Restoring…"
                  : "Restore"}
              </button>

            ) : (
              <button
                type="button"
                className="button secondary"
                disabled={
                  busy
                }
                onClick={
                  () =>
                    onArchive(
                      product
                    )
                }
              >
                {busy
                  ? "Archiving…"
                  : "Archive"}
              </button>
            )}


            {product.isActive !==
              false && (
              <Link
                className="button secondary"
                to={`/product/${encodeURIComponent(
                  id
                )}`}
              >
                Customer view
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}


// ======================================================
// MAIN PAGE
// ======================================================

export default function AdminProductsPage() {
  const {
    token,
  } =
    useAuth();


  const catalog =
    useCatalog();


  const editorRef =
    useRef(
      null
    );


  const [
    products,
    setProducts,
  ] =
    useState(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    success,
    setSuccess,
  ] =
    useState("");


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    searchInput,
    setSearchInput,
  ] =
    useState("");


  const [
    stockStatus,
    setStockStatus,
  ] =
    useState("");


  const [
    active,
    setActive,
  ] =
    useState("");


  const [
    page,
    setPage,
  ] =
    useState(
      1
    );


  const [
    pages,
    setPages,
  ] =
    useState(
      1
    );


  const [
    total,
    setTotal,
  ] =
    useState(
      0
    );


  const [
    editorMode,
    setEditorMode,
  ] =
    useState(
      null
    );


  const [
    draft,
    setDraft,
  ] =
    useState(
      () =>
        makeDraft(
          null
        )
    );


  const [
    editorError,
    setEditorError,
  ] =
    useState("");


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    busyId,
    setBusyId,
  ] =
    useState("");


  // ====================================================
  // LOAD PRODUCTS
  // ====================================================

  async function loadProducts() {
    if (
      !token
    ) {
      return;
    }


    setLoading(
      true
    );

    setError(
      ""
    );


    try {
      const result =
        await getAdminProducts(
          token,
          {
            search,

            stockStatus,

            active,

            page,

            limit:
              PAGE_SIZE,
          }
        );


      setProducts(
        Array.isArray(
          result.products
        )
          ? result.products
          : []
      );


      setTotal(
        Number(
          result.total ||
            0
        )
      );


      const pageCount =
        Math.max(
          1,

          Number(
            result.pages ||
              1
          )
        );


      setPages(
        pageCount
      );


      if (
        page >
        pageCount
      ) {
        setPage(
          pageCount
        );
      }

    } catch (
      loadError
    ) {
      console.error(
        "Admin products load error:",
        loadError
      );


      setProducts(
        []
      );


      setError(
        loadError.message ||
          "Unable to load products."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      loadProducts();
    },

    [
      token,
      search,
      stockStatus,
      active,
      page,
    ]
  );


  // ====================================================
  // REFRESH STOREFRONT CATALOG
  // ====================================================

  async function refreshStorefront() {
    try {
      if (
        typeof catalog
          ?.refreshProducts ===
        "function"
      ) {
        await catalog.refreshProducts();
      }

    } catch (
      refreshError
    ) {
      console.error(
        "Catalog refresh error:",
        refreshError
      );
    }
  }


  // ====================================================
  // OPEN CREATE
  // ====================================================

  function openCreate() {
    setDraft(
      makeDraft(
        null
      )
    );


    setEditorMode(
      "create"
    );


    setEditorError(
      ""
    );


    setSuccess(
      ""
    );


    requestAnimationFrame(
      () =>
        editorRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          })
    );
  }


  // ====================================================
  // OPEN EDIT
  // ====================================================

  function openEdit(
    product
  ) {
    setDraft(
      makeDraft(
        product
      )
    );


    setEditorMode(
      "edit"
    );


    setEditorError(
      ""
    );


    setSuccess(
      ""
    );


    requestAnimationFrame(
      () =>
        editorRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          })
    );
  }


  // ====================================================
  // CLOSE EDITOR
  // ====================================================

  function closeEditor() {
    if (
      saving
    ) {
      return;
    }


    setEditorMode(
      null
    );


    setEditorError(
      ""
    );
  }


  // ====================================================
  // SAVE PRODUCT
  // ====================================================

  async function saveProduct() {
    if (
      !token
    ) {
      setEditorError(
        "Admin login is required."
      );

      return;
    }


    setEditorError(
      ""
    );

    setSuccess(
      ""
    );


    if (
      draft.name
        .trim()
        .length <
      2
    ) {
      setEditorError(
        "Enter a product name."
      );

      return;
    }


    if (
      !draft.category.trim()
    ) {
      setEditorError(
        "Enter a product category."
      );

      return;
    }


    if (
      !draft.sku.trim()
    ) {
      setEditorError(
        "Enter a product SKU."
      );

      return;
    }


    const price =
      Number(
        draft.price
      );


    if (
      !Number.isFinite(
        price
      ) ||
      price <
        0
    ) {
      setEditorError(
        "Enter a valid product price."
      );

      return;
    }


    const discount =
      Number(
        draft.discount
      );


    if (
      !Number.isFinite(
        discount
      ) ||
      discount <
        0 ||
      discount >
        100
    ) {
      setEditorError(
        "Discount must be between 0 and 100."
      );

      return;
    }


    setSaving(
      true
    );


    try {
      const creating =
        editorMode ===
        "create";


      const payload =
        buildProductPayload(
          draft,
          {
            creating,
          }
        );


      let response;


      if (
        creating
      ) {
        response =
          await createProduct(
            token,
            payload
          );

      } else {
        response =
          await updateProduct(
            token,

            draft._id ||
              draft.id,

            payload
          );
      }


      /*
        Inventory has its own endpoint.

        Variant products send variants.

        Products without size or colour options send
        a normal stock value.
      */

      const savedProduct =
        response.product;


      const savedId =
        productId(
          savedProduct
        ) ||
        draft._id ||
        draft.id;


      const variants =
        buildVariants(
          draft
        );


      if (
        savedId
      ) {
        if (
          variants
        ) {
          await updateProductInventory(
            token,

            savedId,

            {
              variants,
            }
          );

        } else {
          await updateProductInventory(
            token,

            savedId,

            {
              stock:
                Math.max(
                  0,

                  Math.floor(
                    safeNumber(
                      draft.stock
                    )
                  )
                ),
            }
          );
        }
      }


      await loadProducts();

      await refreshStorefront();


      setEditorMode(
        null
      );


      setSuccess(
        creating
          ? "Product created successfully."
          : "Product updated successfully."
      );

    } catch (
      saveError
    ) {
      console.error(
        "Admin product save error:",
        saveError
      );


      setEditorError(
        saveError.message ||
          "Unable to save product."
      );

    } finally {
      setSaving(
        false
      );
    }
  }


  // ====================================================
  // ARCHIVE
  // ====================================================

  async function handleArchive(
    product
  ) {
    const id =
      productId(
        product
      );


    if (
      !id
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        `Archive "${product.name}"?\n\nCustomers will no longer see or buy this product, but old order records will remain safe.`
      );


    if (
      !confirmed
    ) {
      return;
    }


    setBusyId(
      id
    );

    setError(
      ""
    );

    setSuccess(
      ""
    );


    try {
      const response =
        await archiveProduct(
          token,
          id
        );


      setSuccess(
        response.message ||
          "Product archived successfully."
      );


      await loadProducts();

      await refreshStorefront();

    } catch (
      archiveError
    ) {
      console.error(
        "Archive product error:",
        archiveError
      );


      setError(
        archiveError.message ||
          "Unable to archive product."
      );

    } finally {
      setBusyId(
        ""
      );
    }
  }


  // ====================================================
  // RESTORE
  // ====================================================

  async function handleRestore(
    product
  ) {
    const id =
      productId(
        product
      );


    if (
      !id
    ) {
      return;
    }


    setBusyId(
      id
    );

    setError(
      ""
    );

    setSuccess(
      ""
    );


    try {
      const response =
        await restoreProduct(
          token,
          id
        );


      setSuccess(
        response.message ||
          "Product restored successfully."
      );


      await loadProducts();

      await refreshStorefront();

    } catch (
      restoreError
    ) {
      console.error(
        "Restore product error:",
        restoreError
      );


      setError(
        restoreError.message ||
          "Unable to restore product."
      );

    } finally {
      setBusyId(
        ""
      );
    }
  }


  // ====================================================
  // PAGE STATISTICS
  // ====================================================

  const pageStats =
    useMemo(
      () => {
        let activeCount =
          0;

        let archivedCount =
          0;

        let lowStock =
          0;

        let outOfStock =
          0;


        for (
          const product
          of products
        ) {
          if (
            product.isActive ===
            false
          ) {
            archivedCount +=
              1;

          } else {
            activeCount +=
              1;
          }


          if (
            product.stockStatus ===
            "low-stock"
          ) {
            lowStock +=
              1;
          }


          if (
            product.stockStatus ===
            "out-of-stock"
          ) {
            outOfStock +=
              1;
          }
        }


        return {
          activeCount,
          archivedCount,
          lowStock,
          outOfStock,
        };
      },

      [
        products,
      ]
    );


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <div
      className="page"
    >
      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "flex-start",

          gap:
            "18px",

          flexWrap:
            "wrap",

          marginBottom:
            "26px",
        }}
      >
        <div>
          <p
            className="eyebrow"
          >
            GYMDROBE ADMIN
          </p>

          <h1>
            Products & inventory
          </h1>

          <p
            className="muted"
          >
            Add products, update prices, manage variants and stock, and control which products appear in the GymDrobe store.
          </p>
        </div>


        <div
          style={{
            display:
              "flex",

            gap:
              "10px",

            flexWrap:
              "wrap",
          }}
        >
          <Link
            className="button secondary"
            to="/admin/orders"
          >
            Admin orders
          </Link>


          <Link
            className="button secondary"
            to="/admin/returns"
          >
            Returns
          </Link>


          <button
            type="button"
            className="button"
            onClick={
              openCreate
            }
          >
            + Add product
          </button>
        </div>
      </div>


      {/* ================================================
          EDITOR
      ================================================ */}

      <div
        ref={
          editorRef
        }
      >
        {editorMode && (
          <ProductEditor
            draft={
              draft
            }
            setDraft={
              setDraft
            }
            mode={
              editorMode
            }
            busy={
              saving
            }
            error={
              editorError
            }
            onSave={
              saveProduct
            }
            onCancel={
              closeEditor
            }
          />
        )}
      </div>


      {/* ================================================
          MESSAGES
      ================================================ */}

      {success && (
        <div
          className="notice"
          style={{
            marginBottom:
              "18px",
          }}
        >
          {
            success
          }
        </div>
      )}


      {error && (
        <p
          className="field-error"
          role="alert"
        >
          {
            error
          }
        </p>
      )}


      {/* ================================================
          SUMMARY
      ================================================ */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit, minmax(150px, 1fr))",

          gap:
            "12px",

          marginBottom:
            "20px",
        }}
      >
        <div
          className="panel"
        >
          <small
            className="muted"
          >
            Matching products
          </small>

          <strong
            style={{
              display:
                "block",

              fontSize:
                "28px",
            }}
          >
            {
              total
            }
          </strong>
        </div>


        <div
          className="panel"
        >
          <small
            className="muted"
          >
            Active on this page
          </small>

          <strong
            style={{
              display:
                "block",

              fontSize:
                "28px",
            }}
          >
            {
              pageStats.activeCount
            }
          </strong>
        </div>


        <div
          className="panel"
        >
          <small
            className="muted"
          >
            Low stock
          </small>

          <strong
            style={{
              display:
                "block",

              fontSize:
                "28px",
            }}
          >
            {
              pageStats.lowStock
            }
          </strong>
        </div>


        <div
          className="panel"
        >
          <small
            className="muted"
          >
            Out of stock
          </small>

          <strong
            style={{
              display:
                "block",

              fontSize:
                "28px",
            }}
          >
            {
              pageStats.outOfStock
            }
          </strong>
        </div>


        <div
          className="panel"
        >
          <small
            className="muted"
          >
            Archived on this page
          </small>

          <strong
            style={{
              display:
                "block",

              fontSize:
                "28px",
            }}
          >
            {
              pageStats.archivedCount
            }
          </strong>
        </div>
      </div>


      {/* ================================================
          FILTERS
      ================================================ */}

      <section
        className="panel"
        style={{
          marginBottom:
            "20px",
        }}
      >
        <form
          onSubmit={
            (
              event
            ) => {
              event.preventDefault();

              setPage(
                1
              );

              setSearch(
                searchInput.trim()
              );
            }
          }
        >
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "minmax(220px, 2fr) repeat(2, minmax(160px, 1fr)) auto",

              gap:
                "12px",

              alignItems:
                "end",
            }}
          >
            <Field
              label="Search products"
            >
              <input
                className="field"
                type="search"
                placeholder="Name, SKU, brand or category"
                value={
                  searchInput
                }
                onChange={
                  (
                    event
                  ) =>
                    setSearchInput(
                      event.target
                        .value
                    )
                }
              />
            </Field>


            <Field
              label="Stock"
            >
              <select
                className="field"
                value={
                  stockStatus
                }
                onChange={
                  (
                    event
                  ) => {
                    setStockStatus(
                      event.target
                        .value
                    );

                    setPage(
                      1
                    );
                  }
                }
              >
                <option
                  value=""
                >
                  All stock
                </option>

                <option
                  value="in-stock"
                >
                  In stock
                </option>

                <option
                  value="low-stock"
                >
                  Low stock
                </option>

                <option
                  value="out-of-stock"
                >
                  Out of stock
                </option>
              </select>
            </Field>


            <Field
              label="Visibility"
            >
              <select
                className="field"
                value={
                  active
                }
                onChange={
                  (
                    event
                  ) => {
                    setActive(
                      event.target
                        .value
                    );

                    setPage(
                      1
                    );
                  }
                }
              >
                <option
                  value=""
                >
                  Active + archived
                </option>

                <option
                  value="true"
                >
                  Active only
                </option>

                <option
                  value="false"
                >
                  Archived only
                </option>
              </select>
            </Field>


            <button
              type="submit"
              className="button"
            >
              Search
            </button>
          </div>
        </form>


        {(search ||
          stockStatus ||
          active) && (
          <button
            type="button"
            className="button secondary"
            style={{
              marginTop:
                "14px",
            }}
            onClick={
              () => {
                setSearchInput(
                  ""
                );

                setSearch(
                  ""
                );

                setStockStatus(
                  ""
                );

                setActive(
                  ""
                );

                setPage(
                  1
                );
              }
            }
          >
            Clear filters
          </button>
        )}
      </section>


      {/* ================================================
          PRODUCTS
      ================================================ */}

      {loading ? (
        <div
          className="panel"
        >
          <h3>
            Loading products…
          </h3>

          <p
            className="muted"
          >
            Getting the latest GymDrobe inventory from MongoDB.
          </p>
        </div>

      ) : products.length ===
        0 ? (
        <div
          className="empty-state"
        >
          <h3>
            No products found
          </h3>

          <p>
            Try changing your filters or add a new GymDrobe product.
          </p>

          <button
            type="button"
            className="button"
            onClick={
              openCreate
            }
          >
            Add product
          </button>
        </div>

      ) : (
        <div
          style={{
            display:
              "grid",

            gap:
              "14px",
          }}
        >
          {products.map(
            (
              product
            ) => (
              <AdminProductCard
                key={
                  productId(
                    product
                  )
                }
                product={
                  product
                }
                busyId={
                  busyId
                }
                onEdit={
                  openEdit
                }
                onArchive={
                  handleArchive
                }
                onRestore={
                  handleRestore
                }
              />
            )
          )}
        </div>
      )}


      {/* ================================================
          PAGINATION
      ================================================ */}

      {!loading &&
        pages >
          1 && (
          <div
            style={{
              display:
                "flex",

              justifyContent:
                "center",

              alignItems:
                "center",

              gap:
                "12px",

              marginTop:
                "24px",

              flexWrap:
                "wrap",
            }}
          >
            <button
              type="button"
              className="button secondary"
              disabled={
                page <=
                1
              }
              onClick={
                () =>
                  setPage(
                    (
                      current
                    ) =>
                      Math.max(
                        1,

                        current -
                          1
                      )
                  )
              }
            >
              Previous
            </button>


            <strong>
              Page{" "}
              {
                page
              }{" "}
              of{" "}
              {
                pages
              }
            </strong>


            <button
              type="button"
              className="button secondary"
              disabled={
                page >=
                pages
              }
              onClick={
                () =>
                  setPage(
                    (
                      current
                    ) =>
                      Math.min(
                        pages,

                        current +
                          1
                      )
                  )
              }
            >
              Next
            </button>
          </div>
        )}
    </div>
  );
}