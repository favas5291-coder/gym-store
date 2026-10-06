import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import {
  getAdminProducts,
  createProduct,
  updateProduct,
  updateProductInventory,
  archiveProduct,
  restoreProduct,
} from "../services/productApi.js";
import { ProductImage } from "../components/StorefrontShared.jsx";
import { money, getDiscountedPrice } from "../utils/productPricing.js";
import "./AdminProductsPage.css";
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
  estimatedDays: "3–7 business days",
  freeDeliveryAbove: "500",
};
function productId(product) {
  return product?._id || product?.id || product?.slug || "";
}
function splitComma(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function joinComma(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}
function joinLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}
function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function stockLabel(status) {
  const labels = {
    "in-stock": "In stock",
    "low-stock": "Low stock",
    "out-of-stock": "Out of stock",
  };
  return labels[status] || "Unknown";
}
function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function parseSpecifications(value) {
  const result = {};
  const lines = splitLines(value);
  for (const line of lines) {
    const index = line.indexOf(":");
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const itemValue = line.slice(index + 1).trim();
    if (key) {
      result[key] = itemValue;
    }
  }
  return result;
}
function stringifySpecifications(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  return Object.entries(value)
    .map(([key, itemValue]) => `${key}: ${String(itemValue ?? "")}`)
    .join("\n");
}
function cloneVariants(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}
function makeDraft(product) {
  if (!product) {
    return {
      ...EMPTY_DRAFT,
      variants: {},
    };
  }
  return {
    id: product.id || product._id || "",
    _id: product._id || product.id || "",
    name: product.name || "",
    slug: product.slug || "",
    sku: product.sku || "",
    category: product.category || "",
    subcategory: product.subcategory || "",
    brand: product.brand || "GymDrobe",
    gender: product.gender || "Unisex",
    price: String(product.price ?? ""),
    discount: String(product.discount ?? 0),
    badge: product.badge || "",
    description: product.description || "",
    material: product.material || "",
    whatsIncluded: product.whatsIncluded || "",
    returnPolicy: product.returnPolicy || "",
    image: product.image || "",
    imagesText: joinLines(product.images),
    tagsText: joinComma(product.tags),
    highlightsText: joinLines(product.highlights),
    careInstructionsText: joinLines(product.careInstructions),
    sizesText: joinComma(product.sizes),
    colorsText: joinComma(product.colors),
    specificationsText: stringifySpecifications(product.specifications),
    stock: String(product.stock ?? 0),
    variants: cloneVariants(product.variants),
    isFeatured: Boolean(product.isFeatured),
    isBestSeller: Boolean(product.isBestSeller),
    isNew: Boolean(product.isNew),
    isActive: product.isActive !== false,
    deliveryAvailable: product.delivery?.available !== false,
    estimatedDays: product.delivery?.estimatedDays || "",
    freeDeliveryAbove: String(product.delivery?.freeDeliveryAbove ?? 500),
  };
}
function buildVariants(draft) {
  const colors = splitComma(draft.colorsText);
  const sizes = splitComma(draft.sizesText);
  const previous =
    draft.variants && typeof draft.variants === "object" ? draft.variants : {};
  function quantity(value) {
    return Math.max(0, Math.floor(safeNumber(value, 0)));
  }
  if (colors.length === 0 && sizes.length === 0) {
    return null;
  }
  const variants = {};
  if (colors.length > 0 && sizes.length > 0) {
    for (const color of colors) {
      variants[color] = {};
      for (const size of sizes) {
        variants[color][size] = quantity(previous?.[color]?.[size]);
      }
    }
    return variants;
  }
  if (colors.length > 0) {
    for (const color of colors) {
      variants[color] = {
        default: quantity(previous?.[color]?.default),
      };
    }
    return variants;
  }
  for (const size of sizes) {
    variants[size] = quantity(previous?.[size]);
  }
  return variants;
}
function buildProductPayload(draft, { creating = false } = {}) {
  const variants = buildVariants(draft);
  const payload = {
    name: draft.name.trim(),
    sku: draft.sku.trim().toUpperCase(),
    category: draft.category.trim(),
    subcategory: draft.subcategory.trim(),
    brand: draft.brand.trim() || "GymDrobe",
    gender: draft.gender.trim() || "Unisex",
    price: safeNumber(draft.price),
    discount: safeNumber(draft.discount),
    badge: draft.badge.trim(),
    description: draft.description.trim(),
    material: draft.material.trim(),
    whatsIncluded: draft.whatsIncluded.trim(),
    returnPolicy: draft.returnPolicy.trim(),
    image: draft.image.trim(),
    images: splitLines(draft.imagesText),
    tags: splitComma(draft.tagsText),
    highlights: splitLines(draft.highlightsText),
    careInstructions: splitLines(draft.careInstructionsText),
    sizes: splitComma(draft.sizesText),
    colors: splitComma(draft.colorsText),
    specifications: parseSpecifications(draft.specificationsText),
    isFeatured: Boolean(draft.isFeatured),
    isBestSeller: Boolean(draft.isBestSeller),
    isNew: Boolean(draft.isNew),
    isActive: Boolean(draft.isActive),
    delivery: {
      available: Boolean(draft.deliveryAvailable),
      estimatedDays: draft.estimatedDays.trim() || null,
      freeDeliveryAbove: Math.max(0, safeNumber(draft.freeDeliveryAbove, 500)),
    },
  };
  if (draft.slug.trim()) {
    payload.slug = draft.slug.trim();
  }
  if (variants) {
    payload.variants = variants;
  } else {
    payload.variants = {};
    payload.stock = Math.max(0, Math.floor(safeNumber(draft.stock)));
  }
  if (creating) {
    delete payload.isActive;
    payload.isActive = true;
  }
  return payload;
}

const SECTIONS = [
  {
    id: "basic",
    title: "1. Basic details",
    help: "Start with the name, category and your unique product code.",
    fields: [
      ["name", "Product name", "Training T-shirt", "text", true],
      [
        "sku",
        "Product code (SKU)",
        "GD-TSHIRT-001",
        "text",
        true,
        "Use a different code for each product.",
      ],
      ["category", "Category", "Workout Clothes", "text", true],
      ["subcategory", "Subcategory", "T-shirts"],
      ["brand", "Brand", "GymDrobe"],
      ["gender", "Who is it for?", "", "gender"],
      [
        "slug",
        "Product URL name",
        "training-t-shirt",
        "text",
        false,
        "Optional. Leave blank for automatic generation when creating.",
      ],
      [
        "badge",
        "Product label",
        "New arrival",
        "text",
        false,
        "Optional label shown on the product. Use accurate claims.",
      ],
    ],
  },
  {
    id: "pricing",
    title: "2. Price",
    help: "Enter the original price in rupees. The preview uses the same rounding as your shop.",
    fields: [
      ["price", "Original price (₹)", "999", "price", true],
      [
        "discount",
        "Discount (%)",
        "0",
        "discount",
        false,
        "Use 0 when there is no discount.",
      ],
    ],
  },
  {
    id: "photos",
    title: "3. Product photos",
    help: "Use a hosted image URL or a public image path. This form currently saves links, not uploaded files.",
    fields: [
      [
        "image",
        "Main photo",
        "https://your-image-host.com/photo.jpg",
        "text",
        false,
        "Or a public path such as /images/training-shirt.jpg.",
      ],
      [
        "imagesText",
        "Additional photos",
        "One image URL or path per line",
        "textarea",
      ],
    ],
  },
  {
    id: "options",
    title: "4. Sizes, colours and stock",
    help: "Leave sizes and colours blank for a simple product. Otherwise, enter the available options and set stock below.",
    fields: [
      [
        "sizesText",
        "Available sizes",
        "S, M, L, XL",
        "text",
        false,
        "Separate sizes with commas.",
      ],
      [
        "colorsText",
        "Available colours",
        "Black, White, Blue",
        "text",
        false,
        "Separate colours with commas. Editing option names changes the stock combinations.",
      ],
    ],
  },
  {
    id: "details",
    title: "5. Product description",
    help: "Explain what the customer receives. The extra details are optional.",
    fields: [
      [
        "description",
        "Description",
        "Describe the product, fit and intended use",
        "textarea",
      ],
      [
        "highlightsText",
        "Main benefits",
        "Write one benefit per line",
        "textarea",
      ],
      ["material", "Material", "Cotton blend"],
      ["whatsIncluded", "What's included", "1 training T-shirt"],
      [
        "tagsText",
        "Search tags",
        "training, lightweight, tshirt",
        "text",
        false,
        "Separate tags with commas.",
      ],
      [
        "specificationsText",
        "Specifications",
        "Material: Cotton\nFit: Regular",
        "textarea",
        false,
        "One Name: Value entry per line.",
      ],
      [
        "careInstructionsText",
        "Care instructions",
        "Write one instruction per line",
        "textarea",
      ],
    ],
  },
  {
    id: "delivery",
    title: "6. Delivery and returns",
    help: "Enter the delivery estimate and return information that applies to this product.",
    fields: [
      ["estimatedDays", "Delivery estimate", "3–7 business days"],
      ["freeDeliveryAbove", "Free delivery threshold (₹)", "500", "price"],
      [
        "returnPolicy",
        "Return policy",
        "Describe the applicable return conditions",
        "textarea",
        false,
        "The current request system uses a 7-day window after delivery. Keep your published policy consistent with that setup.",
      ],
    ],
  },
];

function Field({ label, help, children }) {
  return (
    <label className="ap-field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

function totalDraftStock(draft) {
  const variants = buildVariants(draft);
  if (!variants) return Math.max(0, Math.floor(safeNumber(draft.stock)));
  return Object.values(variants).reduce(
    (total, group) =>
      total +
      (typeof group === "number"
        ? group
        : Object.values(group).reduce((sum, value) => sum + value, 0)),
    0,
  );
}

function InventoryEditor({ draft, setDraft }) {
  const sizes = [...new Set(splitComma(draft.sizesText))];
  const colors = [...new Set(splitComma(draft.colorsText))];
  const rows = colors.length
    ? colors.flatMap((color) =>
        (sizes.length ? sizes : [null]).map((size) => ({ color, size })),
      )
    : (sizes.length ? sizes : [null]).map((size) => ({ color: null, size }));
  function quantityFor(color, size) {
    if (color && size) return draft.variants?.[color]?.[size] ?? 0;
    if (color) return draft.variants?.[color]?.default ?? 0;
    if (size) return draft.variants?.[size] ?? 0;
    return draft.stock;
  }
  function changeStock(color, size, value) {
    setDraft((current) => {
      if (!color && !size) return { ...current, stock: value };
      const variants = cloneVariants(current.variants);
      const count = value === "" ? "" : Number(value);
      if (color)
        variants[color] = {
          ...(variants[color] && typeof variants[color] === "object"
            ? variants[color]
            : {}),
          [size || "default"]: count,
        };
      else variants[size] = count;
      return { ...current, variants };
    });
  }
  return (
    <div className="ap-stock-box">
      <h4>How many units can customers buy?</h4>
      <p>
        Enter a whole number for each option. Use 0 for an unavailable option.
        Total stock: <strong>{totalDraftStock(draft)}</strong>.
      </p>
      <div className="ap-grid">
        {rows.map(({ color, size }) => (
          <Field
            key={JSON.stringify([color, size])}
            label={[color, size].filter(Boolean).join(" / ") || "Total stock"}
          >
            <input
              type="number"
              min="0"
              step="1"
              required
              inputMode="numeric"
              value={quantityFor(color, size)}
              onChange={(event) => changeStock(color, size, event.target.value)}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function ProductEditor({
  draft,
  setDraft,
  mode,
  busy,
  stage,
  error,
  onSave,
  onCancel,
}) {
  const creating = mode === "create";
  function field(name, value) {
    setDraft((current) => ({ ...current, [name]: value }));
  }
  function renderField([
    name,
    label,
    placeholder = "",
    kind = "text",
    required = false,
    help = "",
  ]) {
    const props = {
      value: draft[name],
      required,
      placeholder,
      onChange: (event) =>
        field(
          name,
          name === "sku"
            ? event.target.value.toUpperCase()
            : event.target.value,
        ),
    };
    let control;
    if (kind === "textarea")
      control = <textarea {...props} rows={name === "description" ? 5 : 3} />;
    else if (kind === "gender")
      control = (
        <select {...props}>
          {["Unisex", "Men", "Women", "Kids"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      );
    else
      control = (
        <input
          {...props}
          type={kind === "price" || kind === "discount" ? "number" : "text"}
          min={kind === "price" || kind === "discount" ? 0 : undefined}
          max={kind === "discount" ? 100 : undefined}
          step={kind === "price" || kind === "discount" ? 1 : undefined}
        />
      );
    return (
      <Field key={name} label={`${label}${required ? " *" : ""}`} help={help}>
        {control}
      </Field>
    );
  }
  return (
    <section className="ap-editor panel">
      <div className="ap-heading">
        <div>
          <p className="eyebrow">PRODUCT EDITOR</p>
          <h2>
            {creating ? "Add a new product" : `Edit ${draft.name || "product"}`}
          </h2>
          <p>
            Fields marked * are required. Work through the sections, then review
            and save.
          </p>
        </div>
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          Close editor
        </button>
      </div>
      <nav className="ap-section-links" aria-label="Product form sections">
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#ap-${section.id}`}>
            {section.title}
          </a>
        ))}
        <a href="#ap-review">7. Review and save</a>
      </nav>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
        aria-busy={busy}
      >
        <fieldset className="ap-form-fields" disabled={busy}>
          <legend className="sr-only">Product information</legend>
          {SECTIONS.map((section) => (
            <section
              className="ap-section"
              id={`ap-${section.id}`}
              key={section.id}
            >
              <h3>{section.title}</h3>
              <p className="ap-help">{section.help}</p>
              <div className="ap-grid">{section.fields.map(renderField)}</div>
              {section.id === "pricing" && (
                <p className="ap-price-preview">
                  Customer pays{" "}
                  <strong>{money(getDiscountedPrice(draft))}</strong> per unit
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
                      field("deliveryAvailable", event.target.checked)
                    }
                  />
                  Delivery available for this product
                </label>
              )}
            </section>
          ))}
          <section className="ap-section" id="ap-review">
            <h3>7. Review and save</h3>
            <p className="ap-help">
              Check the price, photos and quantities before saving. A new
              product becomes active in the shop after creation.
            </p>
            <div className="ap-preview">
              <div className="ap-preview-image">
                <ProductImage product={draft} />
              </div>
              <div>
                <p>{draft.brand || "GymDrobe"}</p>
                <h4>{draft.name || "Your product name"}</h4>
                <p>{draft.category || "Choose a category"}</p>
                <strong>{money(getDiscountedPrice(draft))}</strong>
                <p>Total stock: {totalDraftStock(draft)}</p>
                <p>
                  {draft.description ||
                    "Add a description so customers understand the product."}
                </p>
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
                    onChange={(event) => field(name, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>
        </fieldset>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="ap-save-bar">
          <p role="status">
            {busy
              ? stage || "Saving product…"
              : "Check the details above, then save."}
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

function validateDraft(draft) {
  if (draft.name.trim().length < 2)
    return "Enter a product name with at least two characters.";
  if (!draft.sku.trim()) return "Enter a unique product code (SKU).";
  if (!draft.category.trim()) return "Enter the product category.";
  if (
    draft.price === "" ||
    !Number.isFinite(Number(draft.price)) ||
    Number(draft.price) < 0
  )
    return "Enter a valid original price.";
  if (
    !Number.isFinite(Number(draft.discount)) ||
    Number(draft.discount) < 0 ||
    Number(draft.discount) > 100
  )
    return "Discount must be between 0 and 100%.";
  const options = [
    ...splitComma(draft.sizesText),
    ...splitComma(draft.colorsText),
  ];
  if (
    options.some((value) =>
      ["__proto__", "constructor", "prototype"].includes(value),
    )
  )
    return "Choose a different size or colour name.";
  const lines = splitLines(draft.specificationsText);
  if (lines.some((line) => !line.includes(":") || !line.split(":")[0].trim()))
    return "Write specifications as Name: Value, one per line.";
  if (
    !Number.isFinite(Number(draft.freeDeliveryAbove)) ||
    Number(draft.freeDeliveryAbove) < 0
  )
    return "Enter a valid free delivery threshold.";
  return "";
}

function ProductCard({ product, busy, onEdit, onArchive, onRestore }) {
  const id = productId(product);
  return (
    <article className="panel ap-product">
      <div className="ap-product-image">
        <ProductImage product={product} />
      </div>
      <div className="ap-product-content">
        <div className="ap-heading">
          <div>
            <h3>{product.name}</h3>
            <p className="muted">
              {product.sku || "No SKU"} · {product.category || "No category"}
            </p>
          </div>
          <span className="ap-status">
            {product.isActive === false
              ? "Archived"
              : stockLabel(product.stockStatus)}
          </span>
        </div>
        <dl className="ap-product-stats">
          {[
            ["Original price", money(product.price)],
            ["Selling price", money(getDiscountedPrice(product))],
            ["Discount", `${safeNumber(product.discount)}%`],
            ["Stock", safeNumber(product.stock)],
            ["Rating", safeNumber(product.rating).toFixed(1)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">Updated {formatDate(product.updatedAt) || "—"}</p>
        <div className="ap-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => onEdit(product)}
          >
            Edit product
          </button>
          {product.isActive === false ? (
            <button
              className="button"
              disabled={busy}
              onClick={() => onRestore(product)}
            >
              Restore
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => onArchive(product)}
            >
              Archive
            </button>
          )}
          {product.isActive !== false && (
            <Link
              className="button secondary"
              to={`/product/${encodeURIComponent(id)}`}
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
  const editorRef = useRef(null);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const mutationLock = useRef(false);
  const baseline = useRef("");
  const savedIdentity = useRef("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editorMode, setEditorMode] = useState(null);
  const [draft, setDraft] = useState(() => makeDraft(null));
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState("");
  const [busyId, setBusyId] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current++;
    };
  }, []);
  async function loadProducts() {
    const version = ++requestVersion.current;
    if (!token) {
      setLoading(false);
      setError("Sign in with an admin account to load products.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await getAdminProducts(token, {
        search,
        stockStatus,
        active,
        page,
        limit: PAGE_SIZE,
      });
      if (!mounted.current || version !== requestVersion.current) return;
      setProducts(result.products);
      setTotal(result.total);
      const count = Math.max(1, result.pages || 1);
      setPages(count);
      if (page > count) setPage(count);
    } catch (failure) {
      if (mounted.current && version === requestVersion.current) {
        setProducts([]);
        setError(failure.message || "Unable to load products.");
      }
    } finally {
      if (mounted.current && version === requestVersion.current)
        setLoading(false);
    }
  }
  useEffect(() => {
    loadProducts();
  }, [token, search, stockStatus, active, page]);
  async function refreshStorefront() {
    try {
      await catalog.refreshProducts?.();
    } catch (failure) {
      console.error("Catalog refresh failed", failure);
    }
  }
  function canDiscard() {
    return (
      !editorMode ||
      JSON.stringify(draft) === baseline.current ||
      window.confirm("Discard the unsaved product changes?")
    );
  }
  function openEditor(product = null) {
    if (mutationLock.current || !canDiscard()) return;
    const next = makeDraft(product);
    setDraft(next);
    baseline.current = JSON.stringify(next);
    savedIdentity.current = productId(product);
    setEditorMode(product ? "edit" : "create");
    setEditorError("");
    setSuccess("");
    requestAnimationFrame(() =>
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function closeEditor() {
    if (mutationLock.current || !canDiscard()) return;
    setEditorMode(null);
    setEditorError("");
  }
  async function saveProduct() {
    if (mutationLock.current) return;
    if (!token) {
      setEditorError("Admin login is required.");
      return;
    }
    const invalid = validateDraft(draft);
    if (invalid) {
      setEditorError(invalid);
      return;
    }
    mutationLock.current = true;
    setSaving(true);
    setEditorError("");
    setSuccess("");
    let metadataSaved = false;
    const creating = editorMode === "create" && !savedIdentity.current;
    try {
      setStage("Saving product details…");
      const payload = buildProductPayload(draft, { creating });
      const response = creating
        ? await createProduct(token, payload)
        : await updateProduct(
            token,
            savedIdentity.current || draft._id || draft.id,
            payload,
          );
      const id =
        productId(response.product) ||
        (!creating ? savedIdentity.current || draft._id || draft.id : "");
      if (!id)
        throw new Error(
          "The save response did not include a product ID. Check the product list by SKU before creating it again.",
        );
      metadataSaved = true;
      savedIdentity.current = id;
      if (!mounted.current) return;
      setEditorMode("edit");
      setDraft((current) => ({ ...current, id, _id: id }));
      setStage("Saving stock quantities…");
      const variants = buildVariants(draft);
      await updateProductInventory(
        token,
        id,
        variants
          ? { variants }
          : { stock: Math.max(0, Math.floor(safeNumber(draft.stock))) },
      );
      if (!mounted.current) return;
      await loadProducts();
      await refreshStorefront();
      if (!mounted.current) return;
      setEditorMode(null);
      setSuccess(
        creating
          ? "Product created and stock saved."
          : "Product details and stock updated.",
      );
    } catch (failure) {
      if (mounted.current)
        setEditorError(
          metadataSaved
            ? `Product details were saved, but the stock update failed. ${failure.message || "Try again."} Retry Save changes to update the same product.`
            : failure.message || "Unable to save product.",
        );
    } finally {
      mutationLock.current = false;
      if (mounted.current) {
        setSaving(false);
        setStage("");
      }
    }
  }
  async function changeVisibility(product, archive) {
    if (mutationLock.current) return;
    const id = productId(product);
    if (!id || !token) return;
    if (
      archive &&
      !window.confirm(
        `Archive "${product.name}"? Customers will no longer see it. Existing order records remain available.`,
      )
    )
      return;
    mutationLock.current = true;
    setBusyId(id);
    setError("");
    setSuccess("");
    try {
      const response = archive
        ? await archiveProduct(token, id)
        : await restoreProduct(token, id);
      if (!mounted.current) return;
      setSuccess(
        response.message ||
          (archive ? "Product archived." : "Product restored."),
      );
      await loadProducts();
      await refreshStorefront();
    } catch (failure) {
      if (mounted.current)
        setError(failure.message || "Unable to change visibility.");
    } finally {
      mutationLock.current = false;
      if (mounted.current) setBusyId("");
    }
  }
  const busy = saving || Boolean(busyId);
  const stats = [
    ["Matching products", total],
    [
      "Active on this page",
      products.filter((p) => p.isActive !== false).length,
    ],
    [
      "Low stock on this page",
      products.filter((p) => p.stockStatus === "low-stock").length,
    ],
    [
      "Out of stock on this page",
      products.filter((p) => p.stockStatus === "out-of-stock").length,
    ],
    [
      "Archived on this page",
      products.filter((p) => p.isActive === false).length,
    ],
  ];
  return (
    <div className="page ap-admin">
      <header className="ap-heading">
        <div>
          <p className="eyebrow">GYMDROBE ADMIN</p>
          <h1>Products and stock</h1>
          <p>
            Add a product, check its photos and price, then enter the quantities
            you can sell.
          </p>
        </div>
        <div className="ap-actions">
          <Link className="button secondary" to="/admin/orders">
            Orders
          </Link>
          <Link className="button secondary" to="/admin/returns">
            Returns
          </Link>
          <button
            className="button"
            disabled={busy}
            onClick={() => openEditor()}
          >
            + Add product
          </button>
        </div>
      </header>
      <div ref={editorRef}>
        {editorMode && (
          <ProductEditor
            draft={draft}
            setDraft={setDraft}
            mode={editorMode}
            busy={saving}
            stage={stage}
            error={editorError}
            onSave={saveProduct}
            onCancel={closeEditor}
          />
        )}
      </div>
      {success && (
        <p className="notice" role="status">
          {success}
        </p>
      )}
      {error && (
        <div role="alert" className="field-error">
          <p>{error}</p>
          <button
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
                placeholder="Name, SKU, brand or category"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
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
            <button className="button" type="submit">
              Search
            </button>
            {(search || stockStatus || active) && (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setSearch("");
                  setSearchInput("");
                  setStockStatus("");
                  setActive("");
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </form>
      </section>
      {loading ? (
        <p className="panel" role="status">
          Loading products…
        </p>
      ) : !products.length ? (
        <div className="empty-state">
          <h3>
            {error ? "Products could not be loaded" : "No products found"}
          </h3>
          <p>
            {search || stockStatus || active
              ? "Try changing or clearing your filters."
              : "Use Add product to create your first product."}
          </p>
        </div>
      ) : (
        <div className="ap-product-list">
          {products.map((product) => (
            <ProductCard
              key={productId(product)}
              product={product}
              busy={busy}
              onEdit={openEditor}
              onArchive={(p) => changeVisibility(p, true)}
              onRestore={(p) => changeVisibility(p, false)}
            />
          ))}
        </div>
      )}
      <nav className="ap-pagination" aria-label="Product pages">
        <button
          className="button secondary"
          disabled={loading || page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} of {pages} · {total} matching products
        </span>
        <button
          className="button secondary"
          disabled={loading || page >= pages}
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
  return <AdminProductsWorkspace key={user?.id || user?._id || "guest"} />;
}
