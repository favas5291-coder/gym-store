import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getAdminProducts,
  getAdminProductById,
  getAdminProductOptions,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
} from "../services/productApi.js";

import categories from "../data/categories";

import {
  ProductImage,
} from "../components/StorefrontShared.jsx";

import ProductColorImagesEditor from "../components/ProductColorImagesEditor.jsx";

import { money } from "../utils/productPricing.js";

import {
  KIT_ROLES,
  unique,
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
  validateDraft,
  payloadFor,
  conflictFor,
  normalizeProductOptions,
  publicationProblems,
} from "../utils/adminProductDraft.js";

import {
  SupplyFields,
  KitFields,
  VariantLabelFields,
  DeliveryPolicyFields,
} from "../components/ProductSupplyFields.jsx";

import "./AdminProductsPage.css";

const PAGE_SIZE = 25;

const SECTIONS = [
  {
    id: "pricing",
    title: "3. Price",

    help:
      "Enter the original price in rupees and an accurate discount.",

    fields: [
      [
        "price",
        "Original price (₹)",
        "999",
        "number",
        true,
        100000000,
      ],
      [
        "discount",
        "Discount (%)",
        "0",
        "number",
        true,
        100,
      ],
    ],
  },

  {
    id: "photos",
    title: "4. Product photos",

    help:
      "Use hosted image URLs or image paths included in your website. " +
      "A link is required for each photo.",

    fields: [
      [
        "image",
        "Main photo",
        "https://your-host.com/photo.jpg",
        "text",
        false,
        2000,
      ],
      [
        "imagesText",
        "Additional photos",
        "One image URL per line",
        "textarea",
      ],
    ],
  },

  {
    id: "options",
    title: "5. Options and stock",

    help:
      "Choose labels such as Size/Colour or Pack size/Flavour. " +
      "Separate option values with commas and set stock for every combination.",

    fields: [
      [
        "sizesText",
        "Available sizes",
        "S, M, L, XL",
      ],
      [
        "colorsText",
        "Available colours",
        "Black, White, Blue",
      ],
    ],
  },

  {
    id: "details",
    title: "6. Product description",

    help:
      "Use supplier-confirmed details. Include capacity and dimensions " +
      "for bags, fabric and fit for clothing, or capacity and cleaning " +
      "instructions for bottles.",

    fields: [
      [
        "description",
        "Description",
        "Describe the product and intended use",
        "textarea",
        false,
        5000,
      ],
      [
        "highlightsText",
        "Main benefits",
        "One verified benefit per line",
        "textarea",
      ],
      [
        "material",
        "Material",
        "Supplier-confirmed material",
        "text",
        false,
        500,
      ],
      [
        "whatsIncluded",
        "What's included",
        "List everything included",
        "text",
        false,
        1000,
      ],
      [
        "tagsText",
        "Search tags",
        "training, lightweight, tshirt",
      ],
      [
        "specificationsText",
        "Specifications",
        "Capacity: 25 litres\nDimensions: 45 × 25 × 22 cm",
        "textarea",
      ],
      [
        "careInstructionsText",
        "Care instructions",
        "One instruction per line",
        "textarea",
      ],
    ],
  },

  {
    id: "delivery",
    title: "8. Delivery and returns",

    help:
      "Enter estimates and return conditions that apply to this product. " +
      "Checkout controls the final shipping charge.",

    fields: [
      [
        "estimatedDays",
        "Delivery estimate",
        "Supplier-confirmed estimate",
        "text",
        false,
        100,
      ],
      [
        "freeDeliveryAbove",
        "Product delivery threshold (₹)",
        "500",
        "number",
        true,
        100000000,
      ],
      [
        "returnPolicy",
        "Return policy",
        "Window, exclusions and applicable conditions",
        "textarea",
        false,
        2000,
      ],
    ],
  },
];

function Field({
  label,
  help,
  children,
}) {
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
      <Field
        label={`${label}${required ? " *" : ""}`}
      >
        <select
          value={adding ? "__add_new__" : value}
          required={required}
          disabled={disabled}
          onChange={(event) => {
            if (
              event.target.value === "__add_new__"
            ) {
              setAdding(true);
              onChange("");
            } else {
              setAdding(false);
              onChange(event.target.value);
            }
          }}
        >
          <option value="">
            {allowEmpty
              ? "None"
              : `Choose ${label.toLowerCase()}`}
          </option>

          {values
            .filter(
              (value) =>
                value !== "__add_new__",
            )
            .map((value) => (
              <option
                key={value}
                value={value}
              >
                {value}
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
          help="Saved with the product and then available in the dropdown options."
        >
          <input
            type="text"
            value={value}
            required
            maxLength={100}
            disabled={disabled}
            onChange={(event) =>
              onChange(event.target.value)
            }
          />
        </Field>
      )}
    </div>
  );
}

function InventoryEditor({
  draft,
  setDraft,
}) {
  function change(color, size, value) {
    setDraft((current) => {
      if (!color && !size) {
        return {
          ...current,
          stock: value,
          confirmSupplierStock: false,
        };
      }

      const variants = JSON.parse(
        JSON.stringify(
          current.variants || {},
        ),
      );

      if (color) {
        const previous =
          own(variants, color) &&
          variants[color] &&
          typeof variants[color] === "object"
            ? variants[color]
            : {};

        const group = { ...previous };

        Object.defineProperty(
          group,
          size || "default",
          {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
          },
        );

        Object.defineProperty(
          variants,
          color,
          {
            value: group,
            writable: true,
            enumerable: true,
            configurable: true,
          },
        );
      } else {
        Object.defineProperty(
          variants,
          size,
          {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
          },
        );
      }

      return {
        ...current,
        variants,
        confirmSupplierStock: false,
      };
    });
  }

  return (
    <div className="ap-stock-box">
      <h4>Stock and variant SKUs</h4>

      <p>
        Use 0 for an unavailable combination.
        Total stock:{" "}
        <strong>{totalStock(draft)}</strong>.
      </p>

      <p>
        Renaming an option creates a different
        combination. Stock is not automatically
        transferred to a new name.
      </p>

      <div className="ap-grid">
        {optionRows(draft).map(
          ({ color, size }) => {
            const sku = draft.variantSkus.find(
              (row) =>
                row &&
                (row.color || "") === color &&
                (row.size || "") === size,
            )?.sku;

            const saved =
              color || size
                ? sku
                : draft.sku;

            return (
              <Field
                key={JSON.stringify([
                  color,
                  size,
                ])}
                label={
                  [color, size]
                    .filter(Boolean)
                    .join(" / ") ||
                  "Total stock"
                }
                help={
                  `SKU: ${
                    saved ||
                    (
                      draft.id
                        ? "Not recorded — check the backend"
                        : "Generated when saved"
                    )
                  }`
                }
              >
                <input
                  type="number"
                  required
                  min="0"
                  max="1000000"
                  step="1"
                  inputMode="numeric"
                  value={quantityFor(
                    draft,
                    color,
                    size,
                  )}
                  onChange={(event) =>
                    change(
                      color,
                      size,
                      event.target.value,
                    )
                  }
                />
              </Field>
            );
          },
        )}
      </div>
    </div>
  );
}

function ProductEditor({
  draft,
  setDraft,
  options,
  busy,
  saveBlocked,
  error,
  onSave,
  onCancel,
}) {
  const creating = !draft.id;
  const errorRef = useRef(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  function change(name, value) {
    setDraft((current) => ({
      ...current,
      [name]: value,

      ...(
        ["sizesText", "colorsText"].includes(name)
          ? { confirmSupplierStock: false }
          : {}
      ),
    }));
  }

  function renderField([
    name,
    label,
    placeholder = "",
    kind = "text",
    required = false,
    maximum,
  ]) {
    if (name === "sizesText") {
      label =
        `Available ${draft.sizeLabel.toLowerCase()} values`;
    }

    if (name === "colorsText") {
      label =
        `Available ${draft.colorLabel.toLowerCase()} values`;
    }

    const props = {
      name,
      value: draft[name],
      required,
      placeholder,

      onChange: (event) =>
        change(name, event.target.value),
    };

    return (
      <Field
        key={name}
        label={`${label}${required ? " *" : ""}`}
        help={
          name === "specificationsText"
            ? "Write Name: Value, one per line. Use each name once."
            : undefined
        }
      >
        {kind === "textarea" ? (
          <textarea
            {...props}
            maxLength={maximum}
            rows={
              name === "description"
                ? 5
                : 3
            }
          />
        ) : (
          <input
            {...props}
            type={kind}
            maxLength={
              kind !== "number"
                ? maximum
                : undefined
            }
            min={
              kind === "number"
                ? 0
                : undefined
            }
            max={
              kind === "number"
                ? maximum
                : undefined
            }
            step={
              kind === "number"
                ? "0.01"
                : undefined
            }
          />
        )}
      </Field>
    );
  }

  const subcategories = own(
    options.subcategories,
    draft.category,
  )
    ? options.subcategories[draft.category]
    : [];

  const images = unique([
    draft.image,
    ...lines(draft.imagesText),
  ]);

  const problems = publicationProblems(
    draft,
    options,
  );

  return (
    <section className="ap-editor panel">
      <div className="ap-heading">
        <div>
          <p className="eyebrow">
            PRODUCT EDITOR
          </p>

          <h2>
            {creating
              ? "Add a new product"
              : "Edit product"}
          </h2>

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

      <nav
        className="ap-section-links"
        aria-label="Product form sections"
      >
        <a href="#ap-basic">
          1. Basic details
        </a>

        <a href="#ap-supply">
          2. Supplier
        </a>

        {SECTIONS.map((section) =>
          section.id === "delivery"
            ? [
                <a
                  key="kit"
                  href="#ap-kit"
                >
                  7. Fitness Kits
                </a>,

                <a
                  key={section.id}
                  href={`#ap-${section.id}`}
                >
                  {section.title}
                </a>,
              ]
            : (
                <a
                  key={section.id}
                  href={`#ap-${section.id}`}
                >
                  {section.title}
                </a>
              ),
        )}

        <a href="#ap-review">
          9. Review and save
        </a>
      </nav>

      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <fieldset
          className="ap-form-fields"
          disabled={busy}
        >
          <legend className="sr-only">
            Product information
          </legend>

          <section
            className="ap-section"
            id="ap-basic"
          >
            <h3>1. Basic details</h3>

            <div className="ap-grid">
              {renderField([
                "name",
                "Product name",
                "Training T-shirt",
                "text",
                true,
                200,
              ])}

              <Field
                label="Automatic product code"
                help="Generated by the backend and retained when editing."
              >
                <input
                  readOnly
                  value={
                    draft.productCode ||
                    (
                      creating
                        ? "Generated when saved"
                        : "Not recorded"
                    )
                  }
                />
              </Field>

              <Field
                label="Parent SKU"
                help="Identifies the product. Each option combination has its own SKU."
              >
                <input
                  readOnly
                  value={
                    draft.sku ||
                    (
                      creating
                        ? "Generated when saved"
                        : "Not recorded"
                    )
                  }
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
                options={subcategories}
                disabled={
                  !draft.category.trim()
                }
                allowEmpty
                onChange={(value) =>
                  change(
                    "subcategory",
                    value,
                  )
                }
              />

              <ChoiceField
                label="Brand"
                value={draft.brand}
                options={options.brands}
                required
                onChange={(value) =>
                  change("brand", value)
                }
              />

              <Field label="Who is it for?">
                <select
                  value={draft.gender}
                  onChange={(event) =>
                    change(
                      "gender",
                      event.target.value,
                    )
                  }
                >
                  {unique([
                    "Unisex",
                    "Men",
                    "Women",
                    "Kids",
                    draft.gender,
                  ]).map((value) => (
                    <option key={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>

              {renderField([
                "slug",
                "Product URL name",
                "Leave blank for automatic generation",
              ])}

              {renderField([
                "badge",
                "Product label",
                "Optional accurate label",
                "text",
                false,
                80,
              ])}
            </div>
          </section>

          <section className="ap-section">
            <h3>Private sourcing link</h3>

            <Field
              label="Meesho Product Link"
              help="Paste the original Meesho listing link. Visible only to admins for sourcing orders."
            >
              <input
                type="url"
                name="meeshoProductLink"
                maxLength={2000}
                value={draft.meeshoProductLink}
                placeholder="https://www.meesho.com/product-name/p/example"
                onChange={(event) =>
                  change(
                    "meeshoProductLink",
                    event.target.value,
                  )
                }
              />
            </Field>

            <p className="ap-help">
              Optional. Clear the field to remove it.
              This supports manual purchasing; Meesho
              stock and prices are not synchronised.
            </p>
          </section>

          <SupplyFields
            draft={draft}
            setDraft={setDraft}
            options={options}
          />

          {SECTIONS.map((section) => (
            <div key={section.id}>
              {section.id === "delivery" && (
                <KitFields
                  draft={draft}
                  setDraft={setDraft}
                  options={options}
                />
              )}

              <section
                className="ap-section"
                id={`ap-${section.id}`}
              >
                <h3>{section.title}</h3>

                <p className="ap-help">
                  {section.help}
                </p>

                {section.id === "options" && (
                  <VariantLabelFields
                    draft={draft}
                    setDraft={setDraft}
                    options={options}
                  />
                )}

                <div className="ap-grid">
                  {section.fields.map(
                    renderField,
                  )}
                </div>

                {section.id === "pricing" && (
                  <p className="ap-price-preview">
                    Selling price per unit:{" "}

                    <strong>
                      {sellingPrice(draft)}
                    </strong>
                  </p>
                )}

                {section.id === "options" && (
                  <InventoryEditor
                    draft={draft}
                    setDraft={setDraft}
                  />
                )}

                {section.id === "photos" && (
                  <ProductColorImagesEditor
                    draft={draft}
                    setDraft={setDraft}
                    disabled={busy}
                  />
                )}

                {section.id === "photos" &&
                  images.length > 0 && (
                    <div
                      className="ap-grid"
                      style={{ marginTop: 16 }}
                    >
                      {images
                        .slice(0, 20)
                        .map((source) => (
                          <div
                            className="ap-preview-image"
                            key={source}
                          >
                            <ProductImage
                              product={{
                                name:
                                  draft.name ||
                                  "Product photo",
                                image: source,
                              }}
                            />
                          </div>
                        ))}
                    </div>
                  )}

                {section.id === "delivery" && (
                  <>
                    <DeliveryPolicyFields
                      draft={draft}
                      setDraft={setDraft}
                      options={options}
                    />

                    <label className="ap-check">
                      <input
                        type="checkbox"
                        checked={
                          draft.deliveryAvailable
                        }
                        onChange={(event) =>
                          change(
                            "deliveryAvailable",
                            event.target.checked,
                          )
                        }
                      />

                      Delivery available for this product
                    </label>
                  </>
                )}
              </section>
            </div>
          ))}

          <section
            className="ap-section"
            id="ap-review"
          >
            <h3>9. Review and save</h3>

            <div className="ap-preview">
              <div className="ap-preview-image">
                <ProductImage
                  product={{
                    ...draft,
                    images,
                  }}
                />
              </div>

              <div>
                <p>
                  {draft.brand ||
                    "Select the product brand"}
                </p>

                <h4>
                  {draft.name ||
                    "Your product name"}
                </h4>

                <p>
                  [
                  {[
                    draft.category,
                    draft.subcategory,
                  ]
                    .filter(Boolean)
                    .join(" / ") ||
                    "Choose a category"}
                  ]
                </p>

                <strong>
                  {sellingPrice(draft)}
                </strong>

                <p>
                  Total stock: {totalStock(draft)}
                  {" "}·{" "}
                  {optionRows(draft).length}
                  {" "}stock combinations
                </p>

                <p>
                  {draft.description ||
                    "Add a product description."}
                </p>
              </div>
            </div>

            {(
              !images.length ||
              !draft.description.trim() ||
              !draft.returnPolicy.trim()
            ) && (
              <p className="notice">
                Before publishing, check that photos,
                product details and return conditions
                are complete.
              </p>
            )}

            {problems.length > 0 && (
              <div className="notice">
                <strong>
                  Supply details to complete before publishing
                </strong>

                <ul>
                  {problems.map((message) => (
                    <li key={message}>
                      {message}
                    </li>
                  ))}
                </ul>

                <p>
                  Keep new or unconfigured supplier
                  products as drafts.
                </p>
              </div>
            )}

            <p className="ap-help">
              Kit status:{" "}

              {draft.kitEligible
                ? "Eligible for template selection"
                : "Not kit eligible"}

              .

              {draft.kitEligible &&
                " Categories: " +
                  draft.kitRoles
                    .map(
                      (role) =>
                        KIT_ROLES[role] || role,
                    )
                    .join(", ")}
            </p>

            <div className="ap-flags">
              {[
                [
                  "isFeatured",
                  "Feature in the store",
                ],
                [
                  "isNew",
                  "Mark as new arrival",
                ],
                [
                  "isActive",
                  "Published: visible in the shop (untick to keep as draft)",
                ],
              ].map(([name, label]) => (
                <label
                  key={name}
                  className="ap-check"
                >
                  <input
                    type="checkbox"
                    checked={draft[name]}
                    onChange={(event) =>
                      change(
                        name,
                        event.target.checked,
                      )
                    }
                  />

                  {label}
                </label>
              ))}
            </div>

            {draft.isBestSeller && (
              <label className="ap-check">
                <input
                  type="checkbox"
                  checked
                  onChange={() =>
                    change(
                      "isBestSeller",
                      false,
                    )
                  }
                />

                Existing bestseller label — remove
                unless verified sales support it
              </label>
            )}

            <p className="ap-help">
              Bestseller labels require verified sales
              data. New bestseller labels are not
              enabled from this form.
            </p>
          </section>
        </fieldset>

        {error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            className="field-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="ap-save-bar">
          <p role="status">
            {busy
              ? "Working on the product…"
              : "Review the details, then save."}
          </p>

          <div className="ap-actions">
            <button
              className="button"
              type="submit"
              disabled={busy || saveBlocked}
            >
              {busy
                ? "Please wait…"
                : creating
                  ? draft.isActive
                    ? "Create and publish product"
                    : "Create draft product"
                  : "Save changes"}
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

function ProductCard({
  product,
  supplierName,
  busy,
  visibilityBlocked,
  onEdit,
  onVisibility,
}) {
  const status =
    product.isActive === false
      ? "Draft / archived"
      : {
          "in-stock": "In stock",
          "low-stock": "Low stock",
          "out-of-stock": "Out of stock",
        }[product.stockStatus] ||
        "Not recorded";

  const updated = product.updatedAt
    ? new Date(product.updatedAt)
    : null;

  return (
    <article className="panel ap-product">
      <div className="ap-product-image">
        <ProductImage product={product} />
      </div>

      <div className="ap-product-content">
        <div className="ap-heading">
          <div>
            <h3>{product.name}</h3>

            <p
              className="muted"
              style={{
                overflowWrap: "anywhere",
              }}
            >
              {product.productCode ||
                product.sku ||
                "Code not recorded"}
              {" "}· {product.category}
            </p>

            <p className="muted">
              {product.brand}

              {product.subcategory
                ? ` · ${product.subcategory}`
                : ""}
            </p>
          </div>

          <span className="ap-status">
            {status}
          </span>
        </div>

        <dl className="ap-product-stats">
          {[
            [
              "Original price",
              validNumber(
                product.price,
                100000000,
              )
                ? money(product.price)
                : "Not recorded",
            ],
            [
              "Selling price",
              sellingPrice(product),
            ],
            [
              "Discount",
              `${product.discount ?? 0}%`,
            ],
            [
              "Stock",
              product.stock ?? "Not recorded",
            ],
            [
              "Purchase cost",
              product.purchaseCost == null
                ? "Not recorded"
                : money(product.purchaseCost),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <p className="muted">
          Supplier:{" "}

          {product.supplier
            ? supplierName ||
              "Linked supplier unavailable"
            : "Not linked"}

          . Fitness Kit:{" "}

          {product.kitSettings?.eligible
            ? "Eligible · " +
              list(product.kitSettings.roles)
                .map(
                  (role) =>
                    KIT_ROLES[role] || role,
                )
                .join(", ")
            : "Not eligible"}

          .
        </p>

        <p className="muted">
          Updated{" "}

          {updated &&
          !Number.isNaN(updated.getTime())
            ? updated.toLocaleString(
                "en-IN",
                {
                  timeZone: "Asia/Kolkata",
                },
              )
            : "Not recorded"}
        </p>

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
            disabled={
              busy || visibilityBlocked
            }
            onClick={() =>
              onVisibility(product)
            }
          >
            {product.isActive === false
              ? "Restore"
              : "Archive"}
          </button>

          {product.isActive !== false && (
            <Link
              className="button secondary"
              to={
                `/product/${encodeURIComponent(
                  product.id ??
                  product._id ??
                  product.slug,
                )}`
              }
            >
              Customer view
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function AdminProductsWorkspace({
  token,
}) {
  const catalog = useCatalog();

  const {
    logout,
  } = useAuth();

  const mounted = useRef(false);
  const version = useRef(0);
  const optionVersion = useRef(0);
  const lock = useRef(false);
  const baseline = useRef(null);
  const editorRef = useRef(null);

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [searchInput, setSearchInput] =
    useState("");

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    stockStatus: "",
    active: "",
    page: 1,
  });

  const [pages, setPages] =
    useState(1);

  const [total, setTotal] =
    useState(0);

  const [draft, setDraft] =
    useState(null);

  const [editorError, setEditorError] =
    useState("");

  const [serverOptions, setServerOptions] =
    useState({
      categories: [],
      brands: [],
      subcategories: {},
      suppliers: [],
      ready: false,
    });

  const [optionsLoading, setOptionsLoading] =
    useState(true);

  const [optionsError, setOptionsError] =
    useState("");

  const [reloadProductId, setReloadProductId] =
    useState("");

  const [sessionExpired, setSessionExpired] =
    useState(false);

  const [createUncertain, setCreateUncertain] =
    useState(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      version.current += 1;
      optionVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    function warn(event) {
      if (
        lock.current ||
        (
          draft &&
          JSON.stringify(draft) !==
            JSON.stringify(baseline.current)
        )
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    }

    window.addEventListener(
      "beforeunload",
      warn,
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        warn,
      );
    };
  }, [draft]);

  const loadOptions = useCallback(
    async () => {
      const request =
        ++optionVersion.current;

      setOptionsLoading(true);

      try {
        const data =
          await getAdminProductOptions(
            token,
            {
              timeoutMs: 30000,
            },
          );

        const normalized =
          normalizeProductOptions(data);

        if (
          !mounted.current ||
          request !== optionVersion.current
        ) {
          return;
        }

        setServerOptions(normalized);
        setOptionsError("");
      } catch (failure) {
        if (
          mounted.current &&
          request === optionVersion.current
        ) {
          setServerOptions((current) => ({
            ...current,
            ready: false,
          }));

          setOptionsError(
            failure.message ||
            "Dropdown options could not be loaded.",
          );

          if (failure.status === 401) {
            setSessionExpired(true);
          }
        }
      } finally {
        if (
          mounted.current &&
          request === optionVersion.current
        ) {
          setOptionsLoading(false);
        }
      }
    },
    [token],
  );

  const loadProducts = useCallback(
    async () => {
      const request = ++version.current;

      setLoading(true);
      setError("");
      setProducts([]);
      setTotal(0);

      try {
        const result = await getAdminProducts(
          token,
          {
            ...filters,
            limit: PAGE_SIZE,
          },
        );

        if (
          !mounted.current ||
          request !== version.current
        ) {
          return;
        }

        if (
          !Array.isArray(result?.products)
        ) {
          throw new Error(
            "The product list could not be read.",
          );
        }

        const lastPage =
          Number.isSafeInteger(
            Number(result.pages),
          ) &&
          Number(result.pages) > 0
            ? Number(result.pages)
            : 1;

        setProducts(
          result.products.filter(
            (product) =>
              product && idFor(product),
          ),
        );

        setTotal(
          Number.isSafeInteger(
            Number(result.total),
          ) &&
          Number(result.total) >= 0
            ? Number(result.total)
            : 0,
        );

        setPages(lastPage);

        if (filters.page > lastPage) {
          setFilters((current) => ({
            ...current,
            page: lastPage,
          }));
        }
      } catch (failure) {
        if (
          mounted.current &&
          request === version.current
        ) {
          setError(
            failure.message ||
            "Unable to load products.",
          );

          if (failure.status === 401) {
            setSessionExpired(true);
          }
        }
      } finally {
        if (
          mounted.current &&
          request === version.current
        ) {
          setLoading(false);
        }
      }
    },
    [token, filters],
  );

  useEffect(() => {
    loadOptions();

    return () => {
      optionVersion.current += 1;
    };
  }, [loadOptions]);

  useEffect(() => {
    loadProducts();

    return () => {
      version.current += 1;
    };
  }, [loadProducts]);

  function discardAllowed() {
    return (
      !draft ||
      JSON.stringify(draft) ===
        JSON.stringify(baseline.current) ||
      window.confirm(
        "Discard your unsaved product changes?",
      )
    );
  }

  function setEditor(product) {
    const next = draftFor(product);

    baseline.current = next;

    setDraft(next);
    setEditorError("");

    requestAnimationFrame(() =>
      editorRef.current?.scrollIntoView({
        block: "start",
      }),
    );
  }

  async function refreshStorefront() {
    try {
      await catalog.refreshProducts?.();
    } catch {
      if (mounted.current) {
        setError(
          "The change was saved, but the shop refresh failed. Refresh the shop before checking it.",
        );
      }
    }
  }

  async function openEditor(
    product = null,
  ) {
    if (
      lock.current ||
      !discardAllowed()
    ) {
      return;
    }

    setSuccess("");
    setEditorError("");

    if (!product) {
      if (!createUncertain) {
        setEditor(null);
      }

      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");

    try {
      const response =
        await getAdminProductById(
          token,
          idFor(product),
        );

      const record =
        response?.product || response;

      if (
        !record ||
        !idFor(record)
      ) {
        throw new Error(
          "The product details could not be read.",
        );
      }

      if (mounted.current) {
        setEditor(record);

        if (
          String(idFor(record)) ===
          reloadProductId
        ) {
          setReloadProductId("");
        }
      }
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure.message ||
          "Unable to open this product.",
        );

        if (failure.status === 401) {
          setSessionExpired(true);
        }
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  function closeEditor() {
    if (
      !lock.current &&
      discardAllowed()
    ) {
      setDraft(null);
      setEditorError("");

      baseline.current = null;
    }
  }

  async function saveProduct() {
    if (
      lock.current ||
      !draft ||
      (!draft.id && createUncertain) ||
      (
        reloadProductId &&
        draft.id === reloadProductId
      ) ||
      sessionExpired
    ) {
      return;
    }

    const invalid = validateDraft(
      draft,
      baseline.current,
      options,
    );

    if (invalid) {
      setEditorError(invalid);
      return;
    }

    const original = baseline.current;
    const creating = !draft.id;

    const nextKeys = new Set(
      optionRows(draft).map((row) =>
        JSON.stringify([
          row.color,
          row.size,
        ]),
      ),
    );

    const removedStock =
      !creating &&
      optionRows(original).some(
        (row) =>
          !nextKeys.has(
            JSON.stringify([
              row.color,
              row.size,
            ]),
          ) &&
          Number(
            quantityFor(
              original,
              row.color,
              row.size,
            ),
          ) > 0,
      );

    if (
      removedStock &&
      !window.confirm(
        "You removed or renamed a stocked combination. Its old quantity will no longer be available. Save these changes?",
      )
    ) {
      return;
    }

    const payload = payloadFor(
      draft,
      creating ? null : original,
    );

    if (
      !Object.keys(payload).length
    ) {
      setSuccess(
        "There are no product changes to save.",
      );
      return;
    }

    lock.current = true;

    setBusy(true);
    setEditorError("");
    setSuccess("");

    let sent = false;

    try {
      // Check edited fields while preserving
      // unrelated stock changes.
      if (!creating) {
        const fresh =
          await getAdminProductById(
            token,
            draft.id,
          );

        const conflict = conflictFor(
          draft,
          original,
          fresh,
        );

        if (conflict) {
          if (mounted.current) {
            setReloadProductId(
              draft.id,
            );
          }

          throw new Error(
            `${conflict} Your draft remains here to copy.`,
          );
        }
      }

      if (!mounted.current) {
        return;
      }

      sent = true;

      const response = creating
        ? await createProduct(
            token,
            payload,
          )
        : await updateProduct(
            token,
            draft.id,
            payload,
          );

      const product =
        response?.product || response;

      if (
        response?.success === false ||
        !product ||
        !idFor(product)
      ) {
        throw new Error(
          "The save response is incomplete. Check the product list before creating another copy.",
        );
      }

      if (!mounted.current) {
        return;
      }

      setEditor(product);
      setCreateUncertain(false);

      setSuccess(
        creating
          ? "Product created. Check its saved code and variant SKUs below."
          : "Product changes saved.",
      );

      await loadProducts();
      await loadOptions();
      await refreshStorefront();
    } catch (failure) {
      if (mounted.current) {
        setEditorError(
          failure.message ||
          "Unable to save the product.",
        );

        if (failure.status === 401) {
          setSessionExpired(true);
        }

        if (
          sent &&
          (
            !failure.status ||
            failure.status >= 500 ||
            failure.status === 408
          )
        ) {
          if (creating) {
            setCreateUncertain(true);
          } else {
            setReloadProductId(
              draft.id,
            );
          }
        }

        if (
          failure.code === "PRODUCT_CHANGED" &&
          !creating
        ) {
          setReloadProductId(
            draft.id,
          );
        }
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  async function changeVisibility(
    product,
  ) {
    if (
      lock.current ||
      sessionExpired ||
      String(idFor(product)) ===
        reloadProductId
    ) {
      return;
    }

    const sameProduct =
      draft &&
      String(draft.id) ===
        String(idFor(product));

    if (
      sameProduct &&
      !discardAllowed()
    ) {
      return;
    }

    const restoring =
      product.isActive === false;

    if (restoring) {
      const problems =
        publicationProblems(
          draftFor(product),
          options,
        );

      if (problems.length) {
        setError(
          `Edit this product before restoring: ${problems[0]}`,
        );
        return;
      }
    }

    if (
      !restoring &&
      !window.confirm(
        `Archive "${product.name}"? It will be hidden from customers. Existing orders are preserved.`,
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
        ? await restoreProduct(
            token,
            idFor(product),
          )
        : await archiveProduct(
            token,
            idFor(product),
          );

      if (
        response?.success === false
      ) {
        throw new Error(
          response.message ||
          "The visibility change was not confirmed.",
        );
      }

      if (!mounted.current) {
        return;
      }

      if (sameProduct) {
        setDraft(null);
        baseline.current = null;
        setEditorError("");
      }

      setSuccess(
        response.message ||
        (
          restoring
            ? "Product restored."
            : "Product archived."
        ),
      );

      await loadProducts();
      await refreshStorefront();
    } catch (failure) {
      if (mounted.current) {
        setError(
          failure.message ||
          "Unable to change visibility. Refresh the product list before retrying.",
        );

        if (failure.status === 401) {
          setSessionExpired(true);
        }

        if (
          !failure.status ||
          failure.status >= 500 ||
          failure.status === 408 ||
          failure.code === "PRODUCT_CHANGED"
        ) {
          setReloadProductId(
            String(idFor(product)),
          );
        }
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  const known = [
    ...list(catalog.products),
    ...products,
  ].filter(Boolean);

  const options = {
    ...serverOptions,

    categories: unique([
      ...list(categories).map(
        (item) =>
          typeof item === "string"
            ? item
            : item?.name,
      ),

      ...serverOptions.categories,

      ...known.map(
        (product) => product.category,
      ),

      draft?.category,
    ]).sort(
      (a, b) => a.localeCompare(b),
    ),

    brands: unique([
      ...serverOptions.brands,

      ...known.map(
        (product) => product.brand,
      ),

      draft?.brand,
    ]).sort(
      (a, b) => a.localeCompare(b),
    ),

    subcategories: Object.assign(
      Object.create(null),
      serverOptions.subcategories,
    ),
  };

  for (const product of known) {
    if (
      product.category &&
      product.subcategory
    ) {
      options.subcategories[
        product.category
      ] = unique([
        ...list(
          options.subcategories[
            product.category
          ],
        ),

        product.subcategory,
      ]);
    }
  }

  const stats = [
    [
      "Matching products",
      total,
    ],
    [
      "Active on this page",

      products.filter(
        (product) =>
          product.isActive !== false,
      ).length,
    ],
    [
      "Low stock on this page",

      products.filter(
        (product) =>
          product.stockStatus === "low-stock",
      ).length,
    ],
    [
      "Out of stock on this page",

      products.filter(
        (product) =>
          product.stockStatus ===
          "out-of-stock",
      ).length,
    ],
    [
      "Archived on this page",

      products.filter(
        (product) =>
          product.isActive === false,
      ).length,
    ],
  ];

  function changeFilter(
    name,
    value,
  ) {
    setFilters((current) => ({
      ...current,
      [name]: value,
      page: 1,
    }));
  }

  return (
    <div className="page ap-admin">
      <header className="ap-heading">
        <div>
          <p className="eyebrow">
            GYMDROBE ADMIN
          </p>

          <h1>Products and stock</h1>

          <p>
            Add accurate product details, check the
            photos and set stock for each option.
          </p>
        </div>

        <div className="ap-actions">
          <Link
            className="button secondary"
            to="/admin"
          >
            Overview
          </Link>

          <Link
            className="button secondary"
            to="/admin/orders"
          >
            Orders
          </Link>

          <Link
            className="button secondary"
            to="/admin/returns"
          >
            Returns
          </Link>

          <Link
            className="button secondary"
            to="/admin/suppliers"
          >
            Suppliers
          </Link>

          <button
            type="button"
            className="button"
            disabled={
              busy || createUncertain
            }
            onClick={() => openEditor()}
          >
            + Add product
          </button>
        </div>
      </header>

      {sessionExpired && (
        <div
          className="notice"
          role="alert"
        >
          <p>
            Your admin session expired.
            Sign in again to continue.
          </p>

          <Link
            className="button"
            to="/login?next=%2Fadmin%2Fproducts"
            onClick={logout}
          >
            Sign in again
          </Link>
        </div>
      )}

      {optionsLoading && (
        <p role="status">
          Loading supplier and kit settings…
        </p>
      )}

      {reloadProductId && (
        <div
          className="notice"
          role="alert"
        >
          <p>
            A product changed, or its last save
            could not be confirmed. Copy any
            unsaved changes, then reload the
            product before making another change.
          </p>

          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() =>
              openEditor({
                id: reloadProductId,
              })
            }
          >
            Reload latest product
          </button>
        </div>
      )}

      {optionsError && (
        <div
          className="notice"
          role="status"
        >
          <p>{optionsError}</p>

          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={loadOptions}
          >
            Reload dropdown options
          </button>
        </div>
      )}

      {createUncertain && (
        <div
          className="notice"
          role="alert"
        >
          <p>
            The create request could not be confirmed.
            Search the list for this product before
            retrying. Clear filters and refresh to
            check recent products.
          </p>

          <div className="ap-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy || loading}
              onClick={loadProducts}
            >
              Refresh product list
            </button>

            <button
              type="button"
              className="button secondary"
              disabled={busy || loading}
              onClick={() =>
                setCreateUncertain(false)
              }
            >
              I checked the list — allow another attempt
            </button>
          </div>
        </div>
      )}

      <div ref={editorRef}>
        {draft && (
          <ProductEditor
            key={draft.id || "new"}
            draft={draft}
            setDraft={setDraft}
            options={options}
            busy={busy}
            saveBlocked={
              sessionExpired ||
              (
                !draft.id &&
                createUncertain
              ) ||
              Boolean(
                reloadProductId &&
                draft.id === reloadProductId,
              )
            }
            error={editorError}
            onSave={saveProduct}
            onCancel={closeEditor}
          />
        )}
      </div>

      {success && (
        <p
          className="notice"
          role="status"
        >
          {success}
        </p>
      )}

      {error && (
        <div
          className="field-error"
          role="alert"
        >
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
          <div
            className="panel"
            key={label}
          >
            <small>{label}</small>

            <strong>
              {loading ? "…" : value}
            </strong>
          </div>
        ))}
      </div>

      <section className="panel ap-filters">
        <h2>Find a product</h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (!busy) {
              changeFilter(
                "search",
                searchInput.trim(),
              );
            }
          }}
        >
          <fieldset
            className="ap-form-fields"
            disabled={busy}
          >
            <legend className="sr-only">
              Product filters
            </legend>

            <div className="ap-grid">
              <Field label="Search">
                <input
                  type="search"
                  maxLength={100}
                  value={searchInput}
                  placeholder="Name, product code, SKU or brand"
                  onChange={(event) =>
                    setSearchInput(
                      event.target.value,
                    )
                  }
                />
              </Field>

              <Field label="Category">
                <select
                  value={filters.category}
                  onChange={(event) =>
                    changeFilter(
                      "category",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    All categories
                  </option>

                  {options.categories.map(
                    (value) => (
                      <option key={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Stock">
                <select
                  value={filters.stockStatus}
                  onChange={(event) =>
                    changeFilter(
                      "stockStatus",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    All stock
                  </option>

                  <option value="in-stock">
                    In stock
                  </option>

                  <option value="low-stock">
                    Low stock
                  </option>

                  <option value="out-of-stock">
                    Out of stock
                  </option>
                </select>
              </Field>

              <Field label="Visibility">
                <select
                  value={filters.active}
                  onChange={(event) =>
                    changeFilter(
                      "active",
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Active and archived
                  </option>

                  <option value="true">
                    Active only
                  </option>

                  <option value="false">
                    Archived only
                  </option>
                </select>
              </Field>
            </div>

            <div className="ap-actions">
              <button
                className="button"
                type="submit"
              >
                Search
              </button>

              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setSearchInput("");

                  setFilters({
                    search: "",
                    category: "",
                    stockStatus: "",
                    active: "",
                    page: 1,
                  });
                }}
              >
                Clear filters
              </button>

              <button
                type="button"
                className="button secondary"
                disabled={loading}
                onClick={loadProducts}
              >
                Refresh products
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      {loading ? (
        <p
          className="panel"
          role="status"
        >
          Loading products…
        </p>
      ) : !products.length ? (
        <div className="empty-state">
          <h3>
            {error
              ? "Products could not be loaded"
              : "No products found"}
          </h3>

          <p>
            {error
              ? "Retry after checking the connection."
              : "Change your filters or add a product."}
          </p>
        </div>
      ) : (
        <div className="ap-product-list">
          {products.map((product) => (
            <ProductCard
              key={idFor(product)}
              product={product}
              supplierName={
                options.suppliers.find(
                  (row) =>
                    row.id === product.supplier,
                )?.name
              }
              visibilityBlocked={
                String(idFor(product)) ===
                  reloadProductId ||
                sessionExpired
              }
              busy={busy || loading}
              onEdit={openEditor}
              onVisibility={changeVisibility}
            />
          ))}
        </div>
      )}

      <nav
        className="ap-pagination"
        aria-label="Product pages"
      >
        <button
          type="button"
          className="button secondary"
          disabled={
            loading ||
            busy ||
            filters.page <= 1
          }
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page: current.page - 1,
            }))
          }
        >
          Previous
        </button>

        <span>
          Page {filters.page} of {pages}
          {" "}·{" "}
          {loading ? "Loading" : total}
          {" "}matching products
        </span>

        <button
          type="button"
          className="button secondary"
          disabled={
            loading ||
            busy ||
            filters.page >= pages
          }
          onClick={() =>
            setFilters((current) => ({
              ...current,
              page: current.page + 1,
            }))
          }
        >
          Next
        </button>
      </nav>
    </div>
  );
}

export default function AdminProductsPage() {
  const {
    user,
    token,
    loading,
    authError,
    retrySession,
  } = useAuth();

  if (loading) {
    return (
      <div
        className="page panel"
        role="status"
      >
        Checking admin access…
      </div>
    );
  }

  if (authError) {
    return (
      <div className="page panel">
        <h1>Unable to check your account</h1>

        <p
          className="field-error"
          role="alert"
        >
          {authError}
        </p>

        <button
          type="button"
          className="button"
          onClick={retrySession}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="page panel">
        <h1>Sign in to manage products</h1>

        <p>
          An administrator account is required.
        </p>

        <Link
          className="button"
          to="/login?next=%2Fadmin%2Fproducts"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (
    user.role !== "admin" ||
    user.isActive === false
  ) {
    return (
      <div className="page panel">
        <h1>Admin access required</h1>

        <p>
          Your account does not have permission
          to manage products.
        </p>

        <Link
          className="button"
          to="/account"
        >
          My account
        </Link>
      </div>
    );
  }

  return (
    <AdminProductsWorkspace
      key={`${user.id || user._id}:${token}`}
      token={token}
    />
  );
}