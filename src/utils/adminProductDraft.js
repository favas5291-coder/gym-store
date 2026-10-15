import {
  normalizeColorImages,
} from "./productImages.js";

import {
  normalizeMeeshoLink,
} from "./meeshoUrl.js";

import {
  money,
  getDiscountedPrice,
} from "./productPricing.js";

import {
  isPublicImageUrl,
} from "./imageUrl.js";

const EMPTY = {
  id: "",
  productCode: "",
  sku: "",
  name: "",
  slug: "",
  category: "",
  subcategory: "",
  brand: "",
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
  colorImagesText: {},
  tagsText: "",
  highlightsText: "",
  careInstructionsText: "",
  sizesText: "",
  colorsText: "",
  specificationsText: "",
  stock: "0",
  variants: {},
  variantSkus: [],
  isFeatured: false,
  isBestSeller: false,
  isNew: false,
  isActive: false,
  deliveryAvailable: true,
  estimatedDays: "",
  freeDeliveryAbove: "500",
  supplier: "",
  purchaseCost: "",
  meeshoProductLink: "",
  stockSource: "unconfirmed",
  dispatchBy: "unconfirmed",
  preparationDaysMin: "",
  preparationDaysMax: "",
  canSendToPackingLocation: false,
  supplierStockConfirmedAt: "",
  confirmSupplierStock: false,
  kitEligible: false,
  kitRoles: [],
  sizeLabel: "Size",
  colorLabel: "Colour",
  transitDaysMin: "",
  transitDaysMax: "",
  returnsEligible: "unconfirmed",
  returnConditions: "",
  returnWindowDays: "7",
};

function unique(values) {
  const seen = new Set();

  return values.flatMap((value) => {
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      return [];
    }

    const clean = value.trim();
    const key = clean.toLowerCase();

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);

    return [clean];
  });
}

function commas(value) {
  return unique(
    String(value || "").split(","),
  );
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function list(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function idFor(product) {
  return (
    product?._id ||
    product?.id ||
    product?.slug ||
    ""
  );
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(
    object || {},
    key,
  );
}

function safeKey(value) {
  return (
    ![
      "__proto__",
      "constructor",
      "prototype",
      "default",
    ].includes(value) &&
    !value.startsWith("$") &&
    !value.includes(".") &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function validNumber(
  value,
  maximum,
  whole = false,
) {
  return (
    typeof value !== "boolean" &&
    value != null &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= maximum &&
    (
      !whole ||
      Number.isSafeInteger(Number(value))
    )
  );
}

function sellingPrice(product) {
  return (
    validNumber(product.price, 100000000) &&
    validNumber(product.discount ?? 0, 100)
  )
    ? money(getDiscountedPrice(product))
    : "Not recorded";
}

function draftFor(product) {
  if (!product) {
    return {
      ...EMPTY,
      variants: {},
      variantSkus: [],
      kitRoles: [],
    };
  }

  const draft = { ...EMPTY };

  for (const key of [
    "meeshoProductLink",
    "productCode",
    "sku",
    "name",
    "slug",
    "category",
    "subcategory",
    "brand",
    "badge",
    "description",
    "material",
    "whatsIncluded",
    "returnPolicy",
    "image",
  ]) {
    draft[key] =
      typeof product[key] === "string"
        ? product[key]
        : "";
  }

  return {
    ...draft,

    id: idFor(product),
    gender: product.gender || "Unisex",
    price: String(product.price ?? ""),
    discount: String(product.discount ?? 0),
    stock: String(product.stock ?? 0),

    variants: JSON.parse(
      JSON.stringify(product.variants || {}),
    ),

    variantSkus: list(product.variantSkus),

    imagesText: list(product.images).join("\n"),

    colorImagesText: Object.fromEntries(
      list(product.colorImages)
        .filter(
          (row) =>
            row &&
            typeof row.color === "string",
        )
        .map((row) => [
          row.color,
          list(row.images).join("\n"),
        ]),
    ),

    tagsText: list(product.tags).join(", "),

    highlightsText:
      list(product.highlights).join("\n"),

    careInstructionsText:
      list(product.careInstructions).join("\n"),

    sizesText: list(product.sizes).join(", "),
    colorsText: list(product.colors).join(", "),

    specificationsText: Object.entries(
      product.specifications || {},
    )
      .map(
        ([key, value]) =>
          `${key}: ${String(value ?? "")}`,
      )
      .join("\n"),

    isFeatured: Boolean(product.isFeatured),
    isBestSeller: Boolean(product.isBestSeller),

    isNew: Boolean(
      product.isNew ?? product.isNewArrival,
    ),

    isActive: product.isActive !== false,

    deliveryAvailable:
      product.delivery?.available !== false,

    estimatedDays: String(
      product.delivery?.estimatedDays || "",
    ),

    freeDeliveryAbove: String(
      product.delivery?.freeDeliveryAbove ?? 500,
    ),

    supplier: String(
      product.supplier?.id ??
      product.supplier?._id ??
      product.supplier ??
      "",
    ),

    purchaseCost: String(
      product.purchaseCost ?? "",
    ),

    stockSource:
      product.fulfillment?.stockSource ||
      "unconfirmed",

    dispatchBy:
      product.fulfillment?.dispatchBy ||
      "unconfirmed",

    preparationDaysMin: String(
      product.fulfillment?.preparationDaysMin ??
      "",
    ),

    preparationDaysMax: String(
      product.fulfillment?.preparationDaysMax ??
      "",
    ),

    canSendToPackingLocation:
      product.fulfillment
        ?.canSendToPackingLocation === true,

    supplierStockConfirmedAt:
      product.fulfillment
        ?.supplierStockConfirmedAt || "",

    confirmSupplierStock: false,

    kitEligible:
      product.kitSettings?.eligible === true,

    kitRoles: [
      ...list(product.kitSettings?.roles),
    ],

    sizeLabel:
      product.optionLabels?.size || "Size",

    colorLabel:
      product.optionLabels?.color || "Colour",

    transitDaysMin: String(
      product.delivery?.transitDaysMin ?? "",
    ),

    transitDaysMax: String(
      product.delivery?.transitDaysMax ?? "",
    ),

    returnsEligible:
      product.returnsEligible || "unconfirmed",

    returnConditions:
      product.returnConditions || "",

    returnWindowDays: String(
      product.returnWindowDays ?? 7,
    ),
  };
}

function optionRows(draft) {
  const colors = commas(draft.colorsText);
  const sizes = commas(draft.sizesText);

  return (
    colors.length ? colors : [""]
  ).flatMap((color) =>
    (
      sizes.length ? sizes : [""]
    ).map((size) => ({
      color,
      size,
    })),
  );
}

function quantityFor(draft, color, size) {
  if (!color && !size) {
    return draft.stock;
  }

  const variants = draft.variants || {};

  if (color) {
    if (!own(variants, color)) {
      return 0;
    }

    const group = variants[color];

    if (
      !size &&
      typeof group !== "object"
    ) {
      return group ?? 0;
    }

    return own(group, size || "default")
      ? group[size || "default"]
      : 0;
  }

  return own(variants, size)
    ? variants[size]
    : 0;
}

function totalStock(draft) {
  const rows = optionRows(draft);

  if (
    rows.some(
      (row) =>
        !validNumber(
          quantityFor(
            draft,
            row.color,
            row.size,
          ),
          1000000,
          true,
        ),
    )
  ) {
    return "Check quantities";
  }

  return rows.reduce(
    (sum, row) =>
      sum +
      Number(
        quantityFor(
          draft,
          row.color,
          row.size,
        ),
      ),
    0,
  );
}

function buildVariants(draft) {
  const result = Object.create(null);

  for (
    const { color, size } of optionRows(draft)
  ) {
    if (!color && !size) {
      continue;
    }

    const quantity = Number(
      quantityFor(draft, color, size),
    );

    if (color) {
      result[color] ||= Object.create(null);

      result[color][size || "default"] =
        quantity;
    } else {
      result[size] = quantity;
    }
  }

  return result;
}

function inventoryKey(draft) {
  return JSON.stringify({
    colors: commas(draft.colorsText),
    sizes: commas(draft.sizesText),

    rows: optionRows(draft).map((row) => [
      row.color,
      row.size,

      Number(
        quantityFor(
          draft,
          row.color,
          row.size,
        ),
      ),
    ]),
  });
}

function validImage(value) {
  const source = value.trim();

  if (!source) {
    return true;
  }

  if (/^https?:\/\//i.test(source)) {
    return isPublicImageUrl(source);
  }

  return (
    !/^[a-z][a-z0-9+.-]*:/i.test(source) &&
    !source.includes("\\") &&
    !source.startsWith("//") &&
    !/[<>]/.test(source) &&
    !/^(?:\.\/)?public\/$/.test(source)
  );
}

function colorPhotosFor(draft) {
  const colors = commas(
    draft.colorsText,
  );

  return normalizeColorImages(
    colors.map((color) => ({
      color,

      images: lines(
        typeof draft.colorImagesText?.[color] ===
          "string"
          ? draft.colorImagesText[color]
          : "",
      ),
    })),
    colors,
  );
}

function validateBasicDraft(draft) {
  try {
    normalizeMeeshoLink(
      draft.meeshoProductLink,
    );
  } catch (error) {
    return error.message;
  }

  if (
    draft.name.trim().length < 2 ||
    draft.name.trim().length > 200
  ) {
    return "Product name must contain 2–200 characters.";
  }

  if (
    !draft.category.trim() ||
    draft.category.trim().length > 100
  ) {
    return "Choose a category of no more than 100 characters.";
  }

  if (
    !draft.brand.trim() ||
    draft.brand.trim().length > 100
  ) {
    return "Choose the actual brand, using no more than 100 characters.";
  }

  if (
    draft.subcategory.trim().length > 100
  ) {
    return "Subcategory cannot exceed 100 characters.";
  }

  if (
    !validNumber(draft.price, 100000000)
  ) {
    return "Enter an original price from ₹0 to ₹10,00,00,000.";
  }

  if (!validNumber(draft.discount, 100)) {
    return "Discount must be between 0 and 100%.";
  }

  if (
    !validNumber(
      draft.freeDeliveryAbove,
      100000000,
    )
  ) {
    return "Enter a valid non-negative delivery threshold.";
  }

  const sizes = commas(draft.sizesText);
  const colors = commas(draft.colorsText);

  if (
    sizes.length > 50 ||
    colors.length > 50
  ) {
    return "Use no more than 50 sizes or 50 colours.";
  }

  if (
    sizes.some(
      (value) =>
        !safeKey(value) ||
        value.length > 50,
    ) ||
    colors.some(
      (value) =>
        !safeKey(value) ||
        value.length > 80,
    )
  ) {
    return "Size and colour names cannot contain dots, start with $, use reserved names, or exceed their length limits.";
  }

  try {
    colorPhotosFor(draft);
  } catch (error) {
    return error.message;
  }

  for (const row of optionRows(draft)) {
    if (
      !validNumber(
        quantityFor(
          draft,
          row.color,
          row.size,
        ),
        1000000,
        true,
      )
    ) {
      const selection =
        [
          row.color,
          row.size,
        ]
          .filter(Boolean)
          .join(" / ") ||
        "this product";

      return `Enter whole stock from 0 to 1,000,000 for ${selection}.`;
    }
  }

  if (totalStock(draft) > 1000000) {
    return "Combined product stock cannot exceed 1,000,000.";
  }

  const specs = lines(
    draft.specificationsText,
  );

  const names = new Set();

  if (specs.length > 100) {
    return "Use no more than 100 specifications.";
  }

  for (const line of specs) {
    const colon = line.indexOf(":");

    const key = line
      .slice(0, colon)
      .trim();

    const value = line
      .slice(colon + 1)
      .trim();

    if (
      colon < 1 ||
      !safeKey(key) ||
      key.length > 100 ||
      !value ||
      value.length > 1000
    ) {
      return "Write each specification as Name: Value, with a unique valid name and a non-empty value.";
    }

    if (names.has(key.toLowerCase())) {
      return `The specification "${key}" is repeated. Use each name once.`;
    }

    names.add(key.toLowerCase());
  }

  for (
    const [key, label, maximum, length] of [
      [
        "imagesText",
        "Additional photos",
        20,
        2000,
      ],
      [
        "highlightsText",
        "Main benefits",
        30,
        500,
      ],
      [
        "careInstructionsText",
        "Care instructions",
        30,
        500,
      ],
    ]
  ) {
    const values = lines(draft[key]);

    if (
      values.length > maximum ||
      values.some(
        (value) =>
          value.length > length,
      )
    ) {
      return `${label}: use no more than ${maximum} entries, each up to ${length} characters.`;
    }
  }

  if (
    commas(draft.tagsText).length > 50 ||
    commas(draft.tagsText).some(
      (value) => value.length > 100,
    )
  ) {
    return "Use up to 50 tags, each no longer than 100 characters.";
  }

  if (
    !validImage(draft.image) ||
    lines(draft.imagesText).some(
      (value) => !validImage(value),
    )
  ) {
    return (
      "Photos must use publicly hosted HTTP/HTTPS links or website image " +
      "paths. Localhost links and computer file paths cannot be used."
    );
  }

  return "";
}

export const KIT_ROLES = {
  clothing: "Gym clothing",
  footwear: "Footwear",
  supplements: "Supplements (optional)",
  "training-accessories": "Training accessories",
  "gym-bag": "Gym bag",
  "bottle-or-shaker": "Bottle or shaker",
  "workout-essentials":
    "Towels, socks and essentials",
};

const SIZE_LABELS = [
  "Size",
  "Pack size",
  "Capacity",
  "Weight",
  "Length",
  "Option",
];

const COLOR_LABELS = [
  "Colour",
  "Flavour",
  "Style",
  "Material",
  "Option",
];

const STOCK_SOURCES = [
  "unconfirmed",
  "gymdrobe",
  "supplier",
];

const DISPATCH_METHODS = [
  "unconfirmed",
  "gymdrobe",
  "supplier",
  "fulfillment-partner",
];

const SUPPLY_FIELDS = [
  "supplier",
  "stockSource",
  "dispatchBy",
  "preparationDaysMin",
  "preparationDaysMax",
  "canSendToPackingLocation",
];

const blank = (value) =>
  value == null ||
  String(value).trim() === "";

const nullableNumber = (value) =>
  blank(value)
    ? null
    : Number(value);

const changed = (
  draft,
  original,
  keys,
) =>
  !original ||
  keys.some(
    (key) =>
      JSON.stringify(draft[key]) !==
      JSON.stringify(original[key]),
  );

export function normalizeProductOptions(
  data,
) {
  const fail = () => {
    throw new Error(
      "Supplier and kit settings were not returned correctly. Run the updated product backend, then reload dropdown options.",
    );
  };

  if (
    !data ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.brands) ||
    !data.subcategories ||
    typeof data.subcategories !== "object" ||
    Array.isArray(data.subcategories) ||
    !Array.isArray(data.suppliers)
  ) {
    fail();
  }

  for (
    const [field, expected] of [
      ["kitRoles", Object.keys(KIT_ROLES)],
      ["sizeOptionLabels", SIZE_LABELS],
      ["colorOptionLabels", COLOR_LABELS],
      ["stockSources", STOCK_SOURCES],
      ["dispatchMethods", DISPATCH_METHODS],
      [
        "returnEligibility",
        ["unconfirmed", "yes", "no"],
      ],
    ]
  ) {
    const values = data[field];

    if (
      !Array.isArray(values) ||
      values.length !== expected.length ||
      new Set(values).size !== values.length ||
      expected.some(
        (value) => !values.includes(value),
      )
    ) {
      fail();
    }
  }

  if (
    data.returnWindow?.minimumDays !== 1 ||
    data.returnWindow?.maximumDays !== 7
  ) {
    fail();
  }

  const supplierIds = new Set();

  const suppliers = data.suppliers.map(
    (row) => {
      if (
        !row ||
        !/^[a-f0-9]{24}$/i.test(row.id) ||
        supplierIds.has(row.id) ||
        typeof row.name !== "string" ||
        !row.name.trim() ||
        ![
          "draft",
          "active",
          "blocked",
        ].includes(row.status) ||
        typeof row.available !== "boolean" ||
        typeof row.unavailableReason !==
          "string" ||
        typeof row.dispatchToCustomer !==
          "boolean" ||
        typeof row.sendToPackingLocation !==
          "boolean" ||
        (
          row.available &&
          (
            row.status !== "active" ||
            row.unavailableReason
          )
        )
      ) {
        fail();
      }

      supplierIds.add(row.id);

      return {
        ...row,
        name: row.name.trim(),
      };
    },
  );

  const subcategories = Object.create(null);

  for (
    const [key, values] of
    Object.entries(data.subcategories)
  ) {
    if (!Array.isArray(values)) {
      fail();
    }

    subcategories[key] = unique(values);
  }

  return {
    ...data,
    categories: unique(data.categories),
    brands: unique(data.brands),
    subcategories,
    suppliers,
    ready: true,
  };
}

export function rangeError(
  minimum,
  maximum,
  label,
) {
  if (
    blank(minimum) &&
    blank(maximum)
  ) {
    return "";
  }

  if (
    !validNumber(minimum, 365, true) ||
    !validNumber(maximum, 365, true)
  ) {
    return `${label}: enter both limits as whole days from 0 to 365, or leave both blank.`;
  }

  return Number(minimum) > Number(maximum)
    ? `${label}: the maximum must be at least the minimum.`
    : "";
}

export function publicationProblems(
  draft,
  options,
) {
  const problems = [];

  const selected = options?.suppliers?.find(
    (row) => row.id === draft.supplier,
  );

  const supplierStock =
    draft.stockSource === "supplier";

  if (draft.supplier) {
    if (!options?.ready) {
      problems.push(
        "Reload supplier options to check the selected supplier.",
      );
    } else if (!selected) {
      problems.push(
        "The linked supplier is archived or unavailable. Choose an available supplier.",
      );
    } else if (!selected.available) {
      problems.push(
        selected.unavailableReason ||
        "The supplier is not ready to publish products.",
      );
    }

    if (
      selected?.available &&
      draft.dispatchBy === "supplier" &&
      !selected.dispatchToCustomer
    ) {
      problems.push(
        "This supplier is not configured to dispatch to customers.",
      );
    }

    if (
      selected?.available &&
      draft.canSendToPackingLocation &&
      !selected.sendToPackingLocation
    ) {
      problems.push(
        "This supplier is not configured to send products to a packing location.",
      );
    }
  } else if (
    supplierStock ||
    draft.dispatchBy === "supplier" ||
    draft.canSendToPackingLocation
  ) {
    problems.push(
      "Select the supplier responsible for this product.",
    );
  }

  if (
    draft.stockSource === "unconfirmed"
  ) {
    problems.push(
      "Record who holds the stock.",
    );
  }

  if (
    draft.dispatchBy === "unconfirmed"
  ) {
    problems.push(
      "Record who dispatches the product.",
    );
  }

  if (
    blank(draft.preparationDaysMin) ||
    blank(draft.preparationDaysMax)
  ) {
    problems.push(
      "Record the minimum and maximum preparation days.",
    );
  } else {
    const invalid = rangeError(
      draft.preparationDaysMin,
      draft.preparationDaysMax,
      "Preparation time",
    );

    if (invalid) {
      problems.push(invalid);
    }
  }

  if (
    supplierStock &&
    draft.dispatchBy !== "supplier" &&
    !draft.canSendToPackingLocation
  ) {
    problems.push(
      "Confirm that the supplier can send these products to the packing location.",
    );
  }

  if (
    supplierStock &&
    !draft.supplierStockConfirmedAt &&
    !draft.confirmSupplierStock
  ) {
    problems.push(
      "Check supplier stock and record a fresh confirmation.",
    );
  }

  return problems;
}

export function validateDraft(
  draft,
  original = null,
  options = null,
) {
  const basic = validateBasicDraft(draft);

  if (basic) {
    return basic;
  }

  if (
    changed(
      draft,
      original,
      ["supplier"],
    ) &&
    draft.supplier &&
    !/^[a-f0-9]{24}$/i.test(draft.supplier)
  ) {
    return "Choose a valid supplier.";
  }

  if (
    changed(
      draft,
      original,
      ["purchaseCost"],
    ) &&
    !blank(draft.purchaseCost)
  ) {
    const cost = Number(draft.purchaseCost);

    if (
      !validNumber(
        draft.purchaseCost,
        100000000,
      ) ||
      Math.abs(
        cost * 100 -
        Math.round(cost * 100),
      ) > 0.00001
    ) {
      return "Purchase cost must be non-negative, with no more than two decimal places. Leave unknown costs blank.";
    }
  }

  if (
    changed(
      draft,
      original,
      SUPPLY_FIELDS,
    )
  ) {
    if (
      !STOCK_SOURCES.includes(
        draft.stockSource,
      ) ||
      !DISPATCH_METHODS.includes(
        draft.dispatchBy,
      )
    ) {
      return "Choose valid stock and dispatch responsibilities.";
    }

    const invalid = rangeError(
      draft.preparationDaysMin,
      draft.preparationDaysMax,
      "Preparation time",
    );

    if (invalid) {
      return invalid;
    }
  }

  if (
    changed(
      draft,
      original,
      [
        "transitDaysMin",
        "transitDaysMax",
      ],
    )
  ) {
    const invalid = rangeError(
      draft.transitDaysMin,
      draft.transitDaysMax,
      "Courier transit time",
    );

    if (invalid) {
      return invalid;
    }
  }

  if (
    changed(
      draft,
      original,
      ["sizeLabel", "colorLabel"],
    ) &&
    (
      !SIZE_LABELS.includes(draft.sizeLabel) ||
      !COLOR_LABELS.includes(draft.colorLabel)
    )
  ) {
    return "Choose valid product option labels.";
  }

  if (
    changed(
      draft,
      original,
      ["kitEligible", "kitRoles"],
    )
  ) {
    if (
      !Array.isArray(draft.kitRoles) ||
      draft.kitRoles.some(
        (role) =>
          !Object.hasOwn(KIT_ROLES, role),
      )
    ) {
      return "Choose supported Fitness Kit categories.";
    }

    if (
      draft.kitEligible &&
      !draft.kitRoles.length
    ) {
      return "Select at least one kit category, or turn off kit eligibility.";
    }
  }

  if (
    changed(
      draft,
      original,
      [
        "returnsEligible",
        "returnWindowDays",
        "returnConditions",
        "returnPolicy",
      ],
    )
  ) {
    if (
      ![
        "unconfirmed",
        "yes",
        "no",
      ].includes(draft.returnsEligible)
    ) {
      return "Choose a valid return eligibility.";
    }

    if (
      !validNumber(
        draft.returnWindowDays,
        7,
        true,
      ) ||
      Number(draft.returnWindowDays) < 1
    ) {
      return "The current return flow supports a window of 1–7 days.";
    }

    if (
      draft.returnConditions.length > 2000
    ) {
      return "Return conditions cannot exceed 2,000 characters.";
    }

    if (
      draft.returnsEligible === "yes" &&
      !draft.returnPolicy.trim() &&
      !draft.returnConditions.trim()
    ) {
      return "Record the actual return conditions before marking the product returnable.";
    }
  }

  if (draft.confirmSupplierStock) {
    if (
      draft.stockSource !== "supplier" ||
      !draft.supplier
    ) {
      return "Select supplier-held stock before confirming it.";
    }

    const supplier = options?.suppliers?.find(
      (row) => row.id === draft.supplier,
    );

    if (
      !options?.ready ||
      !supplier?.available
    ) {
      return "Reload options and choose an available, verified supplier before confirming stock.";
    }
  }

  // Keep existing unlinked products working.
  // Apply supply checks when publishing a draft
  // or editing supply responsibilities.
  if (
    draft.isActive &&
    (
      !original ||
      !original.isActive ||
      draft.supplier ||
      changed(
        draft,
        original,
        SUPPLY_FIELDS,
      )
    )
  ) {
    const problems = publicationProblems(
      draft,
      options,
    );

    if (problems.length) {
      return `Before publishing: ${problems[0]}`;
    }
  }

  return "";
}

export function payloadFor(
  draft,
  original = null,
) {
  const payload = {};

  function put(
    key,
    value,
    draftKeys = [key],
  ) {
    if (
      changed(
        draft,
        original,
        draftKeys,
      )
    ) {
      payload[key] = value;
    }
  }

  for (const key of [
    "name",
    "category",
    "subcategory",
    "brand",
    "gender",
    "badge",
    "description",
    "material",
    "whatsIncluded",
    "returnPolicy",
    "image",
    "returnConditions",
  ]) {
    put(key, draft[key].trim());
  }

  put(
    "colorImages",
    colorPhotosFor(draft),
    [
      "colorImagesText",
      "colorsText",
    ],
  );

  put("price", Number(draft.price));
  put("discount", Number(draft.discount));

  for (
    const [key, source, values] of [
      [
        "images",
        "imagesText",
        unique(lines(draft.imagesText)),
      ],
      [
        "tags",
        "tagsText",
        commas(draft.tagsText),
      ],
      [
        "highlights",
        "highlightsText",
        lines(draft.highlightsText),
      ],
      [
        "careInstructions",
        "careInstructionsText",
        lines(draft.careInstructionsText),
      ],
    ]
  ) {
    put(key, values, [source]);
  }

  for (const key of [
    "isFeatured",
    "isBestSeller",
    "isNew",
    "isActive",
  ]) {
    put(key, draft[key]);
  }

  put(
    "supplier",
    draft.supplier || null,
  );

  put(
    "purchaseCost",
    nullableNumber(draft.purchaseCost),
  );

  put(
    "meeshoProductLink",
    normalizeMeeshoLink(
      draft.meeshoProductLink,
    ),
  );

  put(
    "returnsEligible",
    draft.returnsEligible,
  );

  put(
    "returnWindowDays",
    Number(draft.returnWindowDays),
  );

  const nested = [
    [
      "delivery",
      [
        [
          "available",
          "deliveryAvailable",
          draft.deliveryAvailable,
        ],
        [
          "estimatedDays",
          "estimatedDays",
          draft.estimatedDays.trim() || null,
        ],
        [
          "freeDeliveryAbove",
          "freeDeliveryAbove",
          Number(draft.freeDeliveryAbove),
        ],
        [
          "transitDaysMin",
          "transitDaysMin",
          nullableNumber(draft.transitDaysMin),
        ],
        [
          "transitDaysMax",
          "transitDaysMax",
          nullableNumber(draft.transitDaysMax),
        ],
      ],
    ],
    [
      "fulfillment",
      [
        [
          "stockSource",
          "stockSource",
          draft.stockSource,
        ],
        [
          "dispatchBy",
          "dispatchBy",
          draft.dispatchBy,
        ],
        [
          "preparationDaysMin",
          "preparationDaysMin",
          nullableNumber(
            draft.preparationDaysMin,
          ),
        ],
        [
          "preparationDaysMax",
          "preparationDaysMax",
          nullableNumber(
            draft.preparationDaysMax,
          ),
        ],
        [
          "canSendToPackingLocation",
          "canSendToPackingLocation",
          draft.canSendToPackingLocation,
        ],
      ],
    ],
    [
      "kitSettings",
      [
        [
          "eligible",
          "kitEligible",
          draft.kitEligible,
        ],
        [
          "roles",
          "kitRoles",
          [...draft.kitRoles],
        ],
      ],
    ],
    [
      "optionLabels",
      [
        [
          "size",
          "sizeLabel",
          draft.sizeLabel,
        ],
        [
          "color",
          "colorLabel",
          draft.colorLabel,
        ],
      ],
    ],
  ];

  for (const [group, fields] of nested) {
    const values = {};

    for (
      const [key, source, value] of fields
    ) {
      if (
        changed(
          draft,
          original,
          [source],
        )
      ) {
        values[key] = value;
      }
    }

    if (Object.keys(values).length) {
      payload[group] = values;
    }
  }

  // Preserve typed specifications unless their text changed.
  if (
    changed(
      draft,
      original,
      ["specificationsText"],
    )
  ) {
    payload.specifications =
      Object.fromEntries(
        lines(
          draft.specificationsText,
        ).map((line) => {
          const colon = line.indexOf(":");

          return [
            line.slice(0, colon).trim(),
            line.slice(colon + 1).trim(),
          ];
        }),
      );
  }

  // Detail-only edits do not send an old stock matrix.
  if (
    !original ||
    inventoryKey(draft) !==
      inventoryKey(original)
  ) {
    payload.sizes = commas(draft.sizesText);
    payload.colors = commas(draft.colorsText);
    payload.variants = buildVariants(draft);

    if (
      !payload.sizes.length &&
      !payload.colors.length
    ) {
      payload.stock = Number(draft.stock);
    }
  }

  if (draft.slug.trim()) {
    put("slug", draft.slug.trim());
  }

  // The backend records the confirmation timestamp.
  if (draft.confirmSupplierStock) {
    payload.confirmSupplierStock = true;
  }

  return payload;
}

export function conflictFor(
  draft,
  original,
  latestProduct,
) {
  const latest = draftFor(latestProduct);

  const patch = payloadFor(
    draft,
    original,
  );

  const before = payloadFor(original);
  const now = payloadFor(latest);

  for (
    const [key, value] of
    Object.entries(patch)
  ) {
    if (key === "confirmSupplierStock") {
      continue;
    }

    if (
      [
        "delivery",
        "fulfillment",
        "kitSettings",
        "optionLabels",
      ].includes(key)
    ) {
      for (
        const child of Object.keys(value)
      ) {
        if (
          JSON.stringify(
            before[key]?.[child],
          ) !==
          JSON.stringify(
            now[key]?.[child],
          )
        ) {
          return `The ${key} settings changed while you were editing. Reload the latest product before saving.`;
        }
      }
    } else if (
      JSON.stringify(before[key]) !==
      JSON.stringify(now[key])
    ) {
      return `The product's ${key} changed while you were editing. Reload the latest product before saving.`;
    }
  }

  if (
    draft.confirmSupplierStock &&
    (
      inventoryKey(original) !==
        inventoryKey(latest) ||
      SUPPLY_FIELDS.some(
        (key) =>
          original[key] !== latest[key],
      )
    )
  ) {
    return "Stock or supply details changed. Reload the latest product and check supplier quantities again.";
  }

  return "";
}

export {
  unique,
  commas,
  lines,
  list,
  idFor,
  own,
  validNumber,
  sellingPrice,
  draftFor,
  optionRows,
  quantityFor,
  totalStock,
  inventoryKey,
};