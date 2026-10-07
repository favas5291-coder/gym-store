import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getAdminProducts,
  getAdminProductById,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
} from "../services/productApi.js";

import categories from "../data/categories";
import { ProductImage } from "../components/StorefrontShared.jsx";
import { money, getDiscountedPrice } from "../utils/productPricing.js";

import "./AdminProductsPage.css";

const PAGE_SIZE = 25;

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

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
  isActive: true,
  deliveryAvailable: true,
  estimatedDays: "",
  freeDeliveryAbove: "500",
};

function unique(values) {
  const seen = new Set();

  return values.filter((value) => {
    if (typeof value !== "string" || !value.trim()) return false;

    const key = value.trim().toLowerCase();

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function commas(value) {
  return unique(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function idFor(product) {
  return product?._id || product?.id || product?.slug || "";
}

function draftFor(product) {
  if (!product) {
    return { ...EMPTY, variants: {}, variantSkus: [] };
  }

  return {
    ...EMPTY,
    id: idFor(product),
    productCode: product.productCode || "",
    sku: product.sku || "",
    name: product.name || "",
    slug: product.slug || "",
    category: product.category || "",
    subcategory: product.subcategory || "",
    brand: product.brand || "",
    gender: product.gender || "Unisex",
    price: String(product.price ?? ""),
    discount: String(product.discount ?? 0),
    badge: product.badge || "",
    description: product.description || "",
    material: product.material || "",
    whatsIncluded: product.whatsIncluded || "",
    returnPolicy: product.returnPolicy || "",
    image: product.image || "",
    imagesText: (product.images || []).join("\n"),
    tagsText: (product.tags || []).join(", "),
    highlightsText: (product.highlights || []).join("\n"),
    careInstructionsText: (product.careInstructions || []).join("\n"),
    sizesText: (product.sizes || []).join(", "),
    colorsText: (product.colors || []).join(", "),
    specificationsText: Object.entries(
      product.specifications || {}
    )
      .map(([key, value]) => `${key}: ${String(value ?? "")}`)
      .join("\n"),
    stock: String(product.stock ?? 0),
    variants: JSON.parse(JSON.stringify(product.variants || {})),
    variantSkus: product.variantSkus || [],
    isFeatured: Boolean(product.isFeatured),
    isBestSeller: Boolean(product.isBestSeller),
    isNew: Boolean(product.isNew ?? product.isNewArrival),
    isActive: product.isActive !== false,
    deliveryAvailable: product.delivery?.available !== false,
    estimatedDays: product.delivery?.estimatedDays || "",
    freeDeliveryAbove: String(
      product.delivery?.freeDeliveryAbove ?? 500
    ),
  };
}

function optionRows(draft) {
  const colors = commas(draft.colorsText);
  const sizes = commas(draft.sizesText);

  if (colors.length) {
    return colors.flatMap((color) =>
      (sizes.length ? sizes : [""]).map((size) => ({
        color,
        size,
      }))
    );
  }

  return (sizes.length ? sizes : [""]).map((size) => ({
    color: "",
    size,
  }));
}

function quantityFor(draft, color, size) {
  if (color) {
    return draft.variants?.[color]?.[size || "default"] ?? 0;
  }

  if (size) return draft.variants?.[size] ?? 0;

  return draft.stock;
}

function totalStock(draft) {
  return optionRows(draft).reduce((sum, row) => {
    const quantity = Number(quantityFor(draft, row.color, row.size));

    return sum + (Number.isFinite(quantity) ? quantity : 0);
  }, 0);
}

function buildVariants(draft) {
  const result = {};

  for (const { color, size } of optionRows(draft)) {
    if (!color && !size) continue;

    const quantity = Number(quantityFor(draft, color, size));

    if (color) {
      if (!Object.prototype.hasOwnProperty.call(result, color)) {
        Object.defineProperty(result, color, {
          value: {},
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      Object.defineProperty(result[color], size || "default", {
        value: quantity,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      Object.defineProperty(result, size, {
        value: quantity,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  return result;
}

function validateDraft(draft) {
  if (draft.name.trim().length < 2) {
    return "Enter a product name with at least two characters.";
  }

  if (!draft.category.trim()) return "Choose a category.";
  if (!draft.brand.trim()) return "Choose the actual product brand.";

  if (
    draft.price === "" ||
    !Number.isFinite(Number(draft.price)) ||
    Number(draft.price) < 0
  ) {
    return "Enter a valid original price.";
  }

  if (
    draft.discount === "" ||
    !Number.isFinite(Number(draft.discount)) ||
    Number(draft.discount) < 0 ||
    Number(draft.discount) > 100
  ) {
    return "Discount must be between 0 and 100%.";
  }

  const options = [
    ...commas(draft.colorsText),
    ...commas(draft.sizesText),
  ];

  if (
    options.some(
      (value) =>
        ["__proto__", "constructor", "prototype"].includes(value) ||
        value.startsWith("$") ||
        value.includes(".")
    )
  ) {
    return "Size and colour names cannot contain dots, start with $, or use reserved names.";
  }

  if (
    commas(draft.colorsText).length > 50 ||
    commas(draft.sizesText).length > 50
  ) {
    return "Use no more than 50 sizes or 50 colours.";
  }

  for (const row of optionRows(draft)) {
    const value = quantityFor(draft, row.color, row.size);
    const quantity = Number(value);

    if (
      value === "" ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > 1000000
    ) {
      return `Enter a whole stock quantity from 0 to 1,000,000 for ${
        [row.color, row.size].filter(Boolean).join(" / ") ||
        "this product"
      }.`;
    }
  }

  for (const line of lines(draft.specificationsText)) {
    const separator = line.indexOf(":");
    const name = line.slice(0, separator).trim();

    if (
      separator < 1 ||
      !name ||
      ["__proto__", "constructor", "prototype"].includes(name) ||
      name.startsWith("$") ||
      name.includes(".")
    ) {
      return "Write specifications as Name: Value, one per line, using valid names.";
    }
  }

  if (
    draft.freeDeliveryAbove === "" ||
    !Number.isFinite(Number(draft.freeDeliveryAbove)) ||
    Number(draft.freeDeliveryAbove) < 0
  ) {
    return "Enter a valid free delivery threshold.";
  }

  return "";
}

function payloadFor(draft) {
  const specifications = Object.fromEntries(
    lines(draft.specificationsText).map((line) => {
      const separator = line.indexOf(":");

      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim(),
      ];
    })
  );

  const payload = {
    name: draft.name.trim(),
    category: draft.category.trim(),
    subcategory: draft.subcategory.trim(),
    brand: draft.brand.trim(),
    gender: draft.gender,
    price: Number(draft.price),
    discount: Number(draft.discount),
    badge: draft.badge.trim(),
    description: draft.description.trim(),
    material: draft.material.trim(),
    whatsIncluded: draft.whatsIncluded.trim(),
    returnPolicy: draft.returnPolicy.trim(),
    image: draft.image.trim(),
    images: lines(draft.imagesText),
    tags: commas(draft.tagsText),
    highlights: lines(draft.highlightsText),
    careInstructions: lines(draft.careInstructionsText),
    sizes: commas(draft.sizesText),
    colors: commas(draft.colorsText),
    specifications,
    variants: buildVariants(draft),
    isFeatured: draft.isFeatured,
    isBestSeller: draft.isBestSeller,
    isNew: draft.isNew,
    isActive: draft.isActive,
    delivery: {
      available: draft.deliveryAvailable,
      estimatedDays: draft.estimatedDays.trim() || null,
      freeDeliveryAbove: Number(draft.freeDeliveryAbove),
    },
  };

  if (!payload.colors.length && !payload.sizes.length) {
    payload.stock = Number(draft.stock);
  }

  if (draft.slug.trim()) payload.slug = draft.slug.trim();

  return payload;
}

function Field({ label, help, children }) {
  return (
    <label className="ap-field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
  required = false,
  disabled = false,
  allowEmpty = false,
}) {
  const [adding, setAdding] = useState(false);
  const values = unique([...options, value]);

  return (
    <div>
      <Field label={`${label}${required ? " *" : ""}`}>
        <select
          value={adding ? "__add_new__" : value}
          required={required}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value === "__add_new__") {
              setAdding(true);
              return;
            }

            setAdding(false);
            onChange(event.target.value);
          }}
        >
          <option value="">
            {allowEmpty ? "None" : `Choose ${label.toLowerCase()}`}
          </option>

          {values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}

          <option value="__add_new__">
            + Add a new {label.toLowerCase()}
          </option>
        </select>
      </Field>

      {adding && (
        <Field
          label={`New ${label.toLowerCase()}`}
          help="This option becomes available to other admins after the product is saved."
        >
          <input
            type="text"
            value={value}
            required={required}
            maxLength={100}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </Field>
      )}
    </div>
  );
}

const SECTIONS = [
  {
    id: "pricing",
    title: "2. Price",
    help: "Enter the original price in rupees and an accurate discount.",
    fields: [
      ["price", "Original price (₹)", "999", "number", true],
      ["discount", "Discount (%)", "0", "number"],
    ],
  },
  {
    id: "photos",
    title: "3. Product photos",
    help: "This form saves hosted image links or public image paths.",
    fields: [
      ["image", "Main photo", "https://your-host.com/photo.jpg"],
      ["imagesText", "Additional photos", "One image URL per line", "textarea"],
    ],
  },
  {
    id: "options",
    title: "4. Sizes, colours and stock",
    help: "Separate sizes and colours with commas. Each combination gets its own SKU after saving.",
    fields: [
      ["sizesText", "Available sizes", "S, M, L, XL"],
      ["colorsText", "Available colours", "Black, White, Blue"],
    ],
  },
  {
    id: "details",
    title: "5. Product description",
    help: "Describe the product accurately. Optional fields remain available.",
    fields: [
      ["description", "Description", "Describe the product and fit", "textarea"],
      ["highlightsText", "Main benefits", "One benefit per line", "textarea"],
      ["material", "Material", "Cotton blend"],
      ["whatsIncluded", "What's included", "1 training T-shirt"],
      ["tagsText", "Search tags", "training, lightweight, tshirt"],
      ["specificationsText", "Specifications", "Material: Cotton\nFit: Regular", "textarea"],
      ["careInstructionsText", "Care instructions", "One instruction per line", "textarea"],
    ],
  },
  {
    id: "delivery",
    title: "6. Delivery and returns",
    help: "Use delivery estimates and return conditions that actually apply.",
    fields: [
      ["estimatedDays", "Delivery estimate", "Enter a confirmed estimate"],
      ["freeDeliveryAbove", "Free delivery threshold (₹)", "500", "number"],
      ["returnPolicy", "Return policy", "Applicable return conditions", "textarea"],
    ],
  },
];

function InventoryEditor({ draft, setDraft }) {
  function change(color, size, value) {
    setDraft((current) => {
      if (!color && !size) return { ...current, stock: value };

      const variants = JSON.parse(
        JSON.stringify(current.variants || {})
      );

      if (color) {
        const group =
          variants[color] && typeof variants[color] === "object"
            ? variants[color]
            : {};

        Object.defineProperty(group, size || "default", {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });

        Object.defineProperty(variants, color, {
          value: group,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else {
        Object.defineProperty(variants, size, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }

      return { ...current, variants };
    });
  }

  return (
    <div className="ap-stock-box">
      <h4>Stock and variant SKUs</h4>

      <p>
        Use 0 for an unavailable option. Total stock:{" "}
        <strong>{totalStock(draft)}</strong>.
      </p>

      <p>
        Renaming a size or colour creates a different combination.
        Check its stock before saving.
      </p>

      <div className="ap-grid">
        {optionRows(draft).map(({ color, size }) => {
          const savedSku = draft.variantSkus.find(
            (row) =>
              (row.color || "") === color &&
              (row.size || "") === size
          )?.sku;

          return (
            <Field
              key={JSON.stringify([color, size])}
              label={
                [color, size].filter(Boolean).join(" / ") ||
                "Total stock"
              }
              help={
                color || size
                  ? `SKU: ${savedSku || "Generated when saved"}`
                  : `SKU: ${draft.sku || "Generated when saved"}`
              }
            >
              <input
                type="number"
                required
                min="0"
                max="1000000"
                step="1"
                inputMode="numeric"
                value={quantityFor(draft, color, size)}
                onChange={(event) =>
                  change(color, size, event.target.value)
                }
              />
            </Field>
          );
        })}
      </div>
    </div>
  );
}

function ProductEditor({
  draft,
  setDraft,
  options,
  busy,
  error,
  onSave,
  onCancel,
}) {
  const creating = !draft.id;

  function change(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function renderField([
    name,
    label,
    placeholder = "",
    kind = "text",
    required = false,
  ]) {
    const props = {
      value: draft[name],
      required,
      placeholder,
      onChange: (event) => change(name, event.target.value),
    };

    return (
      <Field
        key={name}
        label={`${label}${required ? " *" : ""}`}
        help={
          name === "specificationsText"
            ? "Write Name: Value, one per line."
            : undefined
        }
      >
        {kind === "textarea" ? (
          <textarea {...props} rows={name === "description" ? 5 : 3} />
        ) : (
          <input
            {...props}
            type={kind}
            min={kind === "number" ? 0 : undefined}
            max={name === "discount" ? 100 : undefined}
            step={kind === "number" ? "0.01" : undefined}
          />
        )}
      </Field>
    );
  }

  const subcategoryOptions =
    options.subcategories[draft.category] || [];

  return (
    <section className="ap-editor panel">
      <div className="ap-heading">
        <div>
          <p className="eyebrow">PRODUCT EDITOR</p>
          <h2>{creating ? "Add a new product" : "Edit product"}</h2>
          <p>Fields marked * are required.</p>
        </div>

        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Close editor
        </button>
      </div>

      <nav className="ap-section-links" aria-label="Product form sections">
        <a href="#ap-basic">1. Basic details</a>
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#ap-${section.id}`}>
            {section.title}
          </a>
        ))}
        <a href="#ap-review">7. Review and save</a>
      </nav>

      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <fieldset className="ap-form-fields" disabled={busy}>
          <legend className="sr-only">Product information</legend>

          <section className="ap-section" id="ap-basic">
            <h3>1. Basic details</h3>

            <div className="ap-grid">
              {renderField(["name", "Product name", "Training T-shirt", "text", true])}

              <Field
                label="Automatic product code"
                help="Generated by the server. It stays the same when the product is edited."
              >
                <input
                  readOnly
                  value={draft.productCode || "Generated when saved"}
                />
              </Field>

              <Field
                label="Parent SKU"
                help="Existing SKUs are preserved. New products receive an automatic SKU."
              >
                <input
                  readOnly
                  value={draft.sku || "Generated when saved"}
                />
              </Field>

              <ChoiceField
                label="Category"
                value={draft.category}
                options={options.categories}
                required
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    category: value,
                    subcategory: "",
                  }))
                }
              />

              <ChoiceField
                key={draft.category}
                label="Subcategory"
                value={draft.subcategory}
                options={subcategoryOptions}
                disabled={!draft.category.trim()}
                allowEmpty
                onChange={(value) => change("subcategory", value)}
              />

              <ChoiceField
                label="Brand"
                value={draft.brand}
                options={options.brands}
                required
                onChange={(value) => change("brand", value)}
              />

              <Field label="Who is it for?">
                <select
                  value={draft.gender}
                  onChange={(event) => change("gender", event.target.value)}
                >
                  {unique(["Unisex", "Men", "Women", "Kids", draft.gender]).map(
                    (value) => <option key={value}>{value}</option>
                  )}
                </select>
              </Field>

              {renderField(["slug", "Product URL name", "Leave blank for automatic generation"])}
              {renderField(["badge", "Product label", "Optional accurate label"])}
            </div>
          </section>

          {SECTIONS.map((section) => (
            <section
              className="ap-section"
              id={`ap-${section.id}`}
              key={section.id}
            >
              <h3>{section.title}</h3>
              <p className="ap-help">{section.help}</p>

              <div className="ap-grid">
                {section.fields.map(renderField)}
              </div>

              {section.id === "pricing" && (
                <p className="ap-price-preview">
                  Customer pays{" "}
                  <strong>{money(getDiscountedPrice(draft))}</strong>{" "}
                  per unit.
                </p>
              )}

              {section.id === "options" && (
                <InventoryEditor draft={draft} setDraft={setDraft} />
              )}

              {section.id === "delivery" && (
                <label className="ap-check">
                  <input
                    type="checkbox"
                    checked={draft.deliveryAvailable}
                    onChange={(event) =>
                      change("deliveryAvailable", event.target.checked)
                    }
                  />
                  Delivery available for this product
                </label>
              )}
            </section>
          ))}

          <section className="ap-section" id="ap-review">
            <h3>7. Review and save</h3>

            <div className="ap-preview">
              <div className="ap-preview-image">
                <ProductImage product={draft} />
              </div>

              <div>
                <p>{draft.brand || "Select the product brand"}</p>
                <h4>{draft.name || "Your product name"}</h4>
                <p>{draft.category || "Choose a category"}</p>
                <strong>{money(getDiscountedPrice(draft))}</strong>
                <p>Total stock: {totalStock(draft)}</p>
                <p>{draft.description || "Add a product description."}</p>
              </div>
            </div>

            <div className="ap-flags">
              {[
                ["isFeatured", "Feature in the store"],
                ["isBestSeller", "Mark as bestseller"],
                ["isNew", "Mark as new arrival"],
                ...(!creating
                  ? [["isActive", "Active: visible in the shop"]]
                  : []),
              ].map(([name, label]) => (
                <label key={name} className="ap-check">
                  <input
                    type="checkbox"
                    checked={draft[name]}
                    onChange={(event) => change(name, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>
        </fieldset>

        {error && (
          <p className="field-error" role="alert">{error}</p>
        )}

        <div className="ap-save-bar">
          <p role="status">
            {busy
              ? "Saving product and stock…"
              : "Review the details, then save."}
          </p>

          <div className="ap-actions">
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Saving…" : creating ? "Create product" : "Save changes"}
            </button>

            <button
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function ProductCard({ product, busy, onEdit, onVisibility }) {
  const status =
    product.isActive === false
      ? "Archived"
      : ({
          "in-stock": "In stock",
          "low-stock": "Low stock",
          "out-of-stock": "Out of stock",
        }[product.stockStatus] || "Unknown");

  const date = new Date(product.updatedAt);
  const updated = Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN");

  return (
    <article className="panel ap-product">
      <div className="ap-product-image">
        <ProductImage product={product} />
      </div>

      <div className="ap-product-content">
        <div className="ap-heading">
          <div>
            <h3>{product.name}</h3>
            <p className="muted" style={{ overflowWrap: "anywhere" }}>
              {product.productCode || product.sku} · {product.category}
            </p>
            <p className="muted">
              {product.brand}
              {product.subcategory ? ` · ${product.subcategory}` : ""}
            </p>
          </div>

          <span className="ap-status">{status}</span>
        </div>

        <dl className="ap-product-stats">
          {[
            ["Original price", money(product.price)],
            ["Selling price", money(getDiscountedPrice(product))],
            ["Discount", `${product.discount || 0}%`],
            ["Stock", product.stock || 0],
            ["Rating", Number(product.rating || 0).toFixed(1)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <p className="muted">Updated {updated}</p>

        <div className="ap-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => onEdit(product)}
          >
            Edit product
          </button>

          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => onVisibility(product)}
          >
            {product.isActive === false ? "Restore" : "Archive"}
          </button>

          {product.isActive !== false && (
            <Link
              className="button secondary"
              to={`/product/${encodeURIComponent(idFor(product))}`}
            >
              Customer view
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function AdminProductsWorkspace() {
  const { token } = useAuth();
  const catalog = useCatalog();

  const mounted = useRef(false);
  const version = useRef(0);
  const lock = useRef(false);
  const baseline = useRef("");
  const editorRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [draft, setDraft] = useState(null);
  const [editorError, setEditorError] = useState("");

  const [serverOptions, setServerOptions] = useState({
    categories: [],
    brands: [],
    subcategories: {},
  });

  const [optionsError, setOptionsError] = useState("");

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      version.current++;
    };
  }, []);

  async function loadOptions(signal) {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/products/admin/options`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal,
      });

      const data = await response.json().catch(() => null);

      if (
        !response.ok ||
        !data?.success ||
        !Array.isArray(data.categories) ||
        !Array.isArray(data.brands)
      ) {
        throw new Error(
          data?.message || "Category and brand options could not be loaded."
        );
      }

      if (!mounted.current || signal?.aborted) return;

      setServerOptions({
        categories: data.categories,
        brands: data.brands,
        subcategories: data.subcategories || {},
      });
      setOptionsError("");
    } catch (failure) {
      if (failure.name !== "AbortError" && mounted.current) {
        setOptionsError(failure.message);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadOptions(controller.signal);
    return () => controller.abort();
  }, [token]);

  async function loadProducts() {
    const request = ++version.current;

    if (!token) {
      setLoading(false);
      setError("Sign in with an admin account.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await getAdminProducts(token, {
        search,
        category,
        stockStatus,
        active,
        page,
        limit: PAGE_SIZE,
      });

      if (!mounted.current || request !== version.current) return;

      if (!Array.isArray(result.products)) {
        throw new Error("The product list could not be read.");
      }

      setProducts(result.products);
      setTotal(result.total || 0);

      const count = Math.max(1, result.pages || 1);
      setPages(count);

      if (page > count) setPage(count);
    } catch (failure) {
      if (mounted.current && request === version.current) {
        setProducts([]);
        setError(failure.message || "Unable to load products.");
      }
    } finally {
      if (mounted.current && request === version.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadProducts();
  }, [token, search, category, stockStatus, active, page]);

  function discardAllowed() {
    return (
      !draft ||
      JSON.stringify(draft) === baseline.current ||
      window.confirm("Discard your unsaved product changes?")
    );
  }

  async function refreshStorefront() {
    try {
      await catalog.refreshProducts?.();
    } catch {
      if (mounted.current) {
        setError(
          "The product was saved, but the shop refresh failed. Refresh the shop before checking it."
        );
      }
    }
  }

  async function openEditor(product = null) {
    if (lock.current || !discardAllowed()) return;

    setEditorError("");
    setSuccess("");

    if (!product) {
      const next = draftFor(null);
      baseline.current = JSON.stringify(next);
      setDraft(next);

      requestAnimationFrame(() =>
        editorRef.current?.scrollIntoView({ block: "start" })
      );

      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");

    try {
      // Load the full latest record before editing.
      const response = await getAdminProductById(token, idFor(product));
      const record = response?.product || response;

      if (!record || !idFor(record)) {
        throw new Error("The product details could not be read.");
      }

      if (!mounted.current) return;

      const next = draftFor(record);
      baseline.current = JSON.stringify(next);
      setDraft(next);

      requestAnimationFrame(() =>
        editorRef.current?.scrollIntoView({ block: "start" })
      );
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message || "Unable to open this product.");
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function closeEditor() {
    if (lock.current || !discardAllowed()) return;

    setDraft(null);
    setEditorError("");
  }

  async function saveProduct() {
    if (lock.current || !draft) return;

    const invalid = validateDraft(draft);

    if (invalid) {
      setEditorError(invalid);
      return;
    }

    const original = JSON.parse(baseline.current || "{}");
    const originalRows = optionRows(original);
    const nextKeys = new Set(
      optionRows(draft).map((row) =>
        JSON.stringify([row.color, row.size])
      )
    );

    const removedStock = originalRows.some(
      (row) =>
        (row.color || row.size) &&
        !nextKeys.has(JSON.stringify([row.color, row.size])) &&
        Number(quantityFor(original, row.color, row.size)) > 0
    );

    if (
      removedStock &&
      !window.confirm(
        "You removed or renamed an option that has stock. Its old quantity will no longer be available. Save these changes?"
      )
    ) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setEditorError("");
    setSuccess("");

    let saved = false;

    try {
      const creating = !draft.id;
      const payload = payloadFor(draft);

      // Details and inventory are saved in the same API request.
      const response = creating
        ? await createProduct(token, payload)
        : await updateProduct(token, draft.id, payload);

      const product = response?.product || response;

      if (!product || !idFor(product)) {
        throw new Error(
          "The save response is incomplete. Check the product list before creating another copy."
        );
      }

      saved = true;

      if (!mounted.current) return;

      const next = draftFor(product);
      baseline.current = JSON.stringify(next);
      setDraft(next);

      setSuccess(
        creating
          ? "Product created. Its product code, variant SKUs and stock are saved."
          : "Product details and stock updated."
      );

      await loadProducts();
      await loadOptions();
      await refreshStorefront();
    } catch (failure) {
      if (mounted.current) {
        setEditorError(
          saved
            ? `The product was saved, but refreshing failed. ${failure.message}`
            : failure.message || "Unable to save this product."
        );
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function changeVisibility(product) {
    if (lock.current) return;

    const restoring = product.isActive === false;

    if (
      !restoring &&
      !window.confirm(
        `Archive "${product.name}"? It will be hidden from customers. Existing orders are preserved.`
      )
    ) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = restoring
        ? await restoreProduct(token, idFor(product))
        : await archiveProduct(token, idFor(product));

      if (!mounted.current) return;

      setSuccess(
        response.message ||
          (restoring ? "Product restored." : "Product archived.")
      );

      await loadProducts();
      await refreshStorefront();
    } catch (failure) {
      if (mounted.current) {
        setError(failure.message || "Unable to change visibility.");
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const categoryNames = (Array.isArray(categories) ? categories : [])
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter(Boolean);

  const knownProducts = [
    ...(Array.isArray(catalog.products) ? catalog.products : []),
    ...products,
  ];

  const options = {
    categories: unique([
      ...categoryNames,
      ...serverOptions.categories,
      ...knownProducts.map((product) => product.category),
      draft?.category,
    ]).sort((a, b) => a.localeCompare(b)),
    brands: unique([
      ...serverOptions.brands,
      ...knownProducts.map((product) => product.brand),
      draft?.brand,
    ]).sort((a, b) => a.localeCompare(b)),
    subcategories: { ...serverOptions.subcategories },
  };

  for (const product of knownProducts) {
    if (!product.category || !product.subcategory) continue;

    Object.defineProperty(options.subcategories, product.category, {
      value: unique([
        ...(options.subcategories[product.category] || []),
        product.subcategory,
      ]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  const stats = [
    ["Matching products", total],
    ["Active on this page", products.filter((p) => p.isActive !== false).length],
    ["Low stock on this page", products.filter((p) => p.stockStatus === "low-stock").length],
    ["Out of stock on this page", products.filter((p) => p.stockStatus === "out-of-stock").length],
    ["Archived on this page", products.filter((p) => p.isActive === false).length],
  ];

  return (
    <div className="page ap-admin">
      <header className="ap-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Products and stock</h1>
          <p>Select categories and brands, add product details, then set stock.</p>
        </div>

        <div className="ap-actions">
          <Link className="button secondary" to="/admin/orders">Orders</Link>
          <Link className="button secondary" to="/admin/returns">Returns</Link>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => openEditor()}
          >
            + Add product
          </button>
        </div>
      </header>

      {optionsError && (
        <div className="notice" role="status">
          <p>{optionsError}</p>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => loadOptions()}
          >
            Reload dropdown options
          </button>
        </div>
      )}

      <div ref={editorRef}>
        {draft && (
          <ProductEditor
            draft={draft}
            setDraft={setDraft}
            options={options}
            busy={busy}
            error={editorError}
            onSave={saveProduct}
            onCancel={closeEditor}
          />
        )}
      </div>

      {success && <p className="notice" role="status">{success}</p>}

      {error && (
        <div className="field-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            disabled={loading || busy}
            onClick={loadProducts}
          >
            Try again
          </button>
        </div>
      )}

      <div className="ap-stats">
        {stats.map(([label, value]) => (
          <div className="panel" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section className="panel ap-filters">
        <h2>Find a product</h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <div className="ap-grid">
            <Field label="Search">
              <input
                type="search"
                value={searchInput}
                placeholder="Name, product code, SKU or brand"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </Field>

            <Field label="Category">
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All categories</option>
                {options.categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>

            <Field label="Stock">
              <select
                value={stockStatus}
                onChange={(event) => {
                  setStockStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All stock</option>
                <option value="in-stock">In stock</option>
                <option value="low-stock">Low stock</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </Field>

            <Field label="Visibility">
              <select
                value={active}
                onChange={(event) => {
                  setActive(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Active and archived</option>
                <option value="true">Active only</option>
                <option value="false">Archived only</option>
              </select>
            </Field>
          </div>

          <div className="ap-actions">
            <button className="button" type="submit">Search</button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setCategory("");
                setStockStatus("");
                setActive("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <p className="panel" role="status">Loading products…</p>
      ) : !products.length ? (
        <div className="empty-state">
          <h3>{error ? "Products could not be loaded" : "No products found"}</h3>
          <p>Change your filters or use Add product.</p>
        </div>
      ) : (
        <div className="ap-product-list">
          {products.map((product) => (
            <ProductCard
              key={idFor(product)}
              product={product}
              busy={busy}
              onEdit={openEditor}
              onVisibility={changeVisibility}
            />
          ))}
        </div>
      )}

      <nav className="ap-pagination" aria-label="Product pages">
        <button
          type="button"
          className="button secondary"
          disabled={loading || busy || page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>

        <span>Page {page} of {pages} · {total} matching products</span>

        <button
          type="button"
          className="button secondary"
          disabled={loading || busy || page >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </nav>
    </div>
  );
}

export default function AdminProductsPage() {
  const { user } = useAuth();

  return (
    <AdminProductsWorkspace
      key={user?.id || user?._id || "guest"}
    />
  );
}