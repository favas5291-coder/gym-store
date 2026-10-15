import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import {
  getFitnessKits,
  getFitnessKit,
  quoteFitnessKit,
} from "../services/kitApi.js";

import {
  defaultKitSelections,
  restoreKitSelections,
  inspectKitSelections,
  productId,
} from "../utils/kitBuilder.js";

import {
  kitGroupSignature,
} from "../utils/kitCart.js";

import {
  readStorage,
  writeStorage,
} from "../utils/storage.js";

import {
  getVariantStock,
} from "../utils/cartUtils.js";

import {
  getDiscountedPrice,
  money,
} from "../utils/productPricing.js";

import {
  ProductImage,
} from "../components/StorefrontShared.jsx";

export default function FitnessKitsPage() {
  const { kitId } = useParams();

  const {
    shoppingKey,
    kitGroups = [],
  } = useStore();

  const [params] = useSearchParams();

  const groupId =
    params.get("group") || "";

  const group = kitGroups.find(
    (value) =>
      value.id === groupId &&
      value.kitId === kitId,
  );

  const editingMissing = Boolean(
    groupId && !group,
  );

  const storageKey = shoppingKey(
    `gymdrobe-kit-builder:${kitId || "levels"}${
      groupId
        ? `:edit:${groupId}`
        : ""
    }`,
  );

  return (
    <div className="page fitness-kits">
      <div className="page-heading">
        <h1>Build your Fitness Kit</h1>

        <Link to="/shop">
          Shop individual products
        </Link>
      </div>

      <p>
        Everything You Need for Every Workout.
        Choose useful gear for your routine and
        skip what you already own.
      </p>

      {editingMissing ? (
        <section className="panel">
          <h2>
            This kit is no longer in your bag
          </h2>

          <p>
            Return to your bag to check the current
            items. No selections were replaced.
          </p>

          <Link
            className="button"
            to="/cart"
          >
            Return to bag
          </Link>
        </section>
      ) : kitId ? (
        <LoadKit
          key={storageKey}
          kitId={kitId}
          storageKey={storageKey}
          group={group}
        />
      ) : (
        <Levels />
      )}

      <style>{`
        .kit-builder-fields {
          border: 0;
          padding: 0;
          margin: 0;
          min-width: 0;
        }

        .kit-level-grid,
        .kit-builder-layout {
          display: grid;
          gap: 20px;
        }

        .kit-level-grid {
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(min(100%, 260px), 1fr)
            );
        }

        .fitness-kits .panel {
          padding: 20px;
          margin: 16px 0;
        }

        .fitness-kits label {
          display: grid;
          gap: 6px;
          margin: 12px 0;
        }

        .fitness-kits input:not([type=checkbox]),
        .fitness-kits select {
          width: 100%;
          min-height: 44px;
          padding: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
        }

        .fitness-kits input[type=checkbox] {
          width: 22px;
          height: 22px;
        }

        .kit-builder-photo {
          display: block;
          width: 160px;
          height: 160px;
          object-fit: contain;
        }

        .kit-builder-summary {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 10px;
        }

        .kit-builder-summary summary {
          cursor: pointer;
          min-height: 44px;
          padding: 12px;
          font-weight: 700;
        }

        .kit-builder-summary ul {
          padding-left: 20px;
        }

        .kit-builder-summary dd {
          margin: 0;
        }

        .kit-builder-summary dl > div {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          margin: 12px 0;
        }

        @media (min-width: 900px) {
          .kit-builder-layout {
            grid-template-columns:
              minmax(0, 1fr) 330px;
          }

          .kit-builder-summary {
            position: sticky;
            top: 20px;
            align-self: start;
          }

          .kit-builder-summary summary {
            display: none;
          }

          .kit-builder-summary:not([open]) > div {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}

function Levels() {
  const [kits, setKits] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const abort = new AbortController();

    setKits(null);
    setError("");

    getFitnessKits({
      signal: abort.signal,
    })
      .then((rows) => {
        if (!abort.signal.aborted) {
          setKits(rows);
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setError(failure.message);
        }
      });

    return () => abort.abort();
  }, [revision]);

  if (error) {
    return (
      <section>
        <p role="alert">{error}</p>

        <button
          type="button"
          className="button"
          onClick={() =>
            setRevision(
              (value) => value + 1,
            )
          }
        >
          Retry
        </button>
      </section>
    );
  }

  if (!kits) {
    return (
      <p role="status">
        Loading Fitness Kits…
      </p>
    );
  }

  if (!kits.length) {
    return (
      <section className="panel">
        <h2>
          Fitness Kits are being prepared
        </h2>

        <p>
          Our kit selections will appear here
          when their products and arrangements
          are configured. You can shop
          individual products now.
        </p>

        <Link
          className="button"
          to="/shop"
        >
          Browse products
        </Link>
      </section>
    );
  }

  return (
    <div className="kit-level-grid">
      {kits.map((kit) => (
        <article
          className="panel"
          key={kit.id}
        >
          <h2>{kit.name}</h2>
          <p>{kit.audience}</p>
          <p>{kit.explanation}</p>
          <p>{kit.supplementNote}</p>

          <Link
            className="button"
            to={
              `/kits/${encodeURIComponent(
                kit.id,
              )}`
            }
          >
            Customize kit
          </Link>
        </article>
      ))}
    </div>
  );
}

function LoadKit({
  kitId,
  storageKey,
  group,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const abort = new AbortController();

    setData(null);
    setError("");

    getFitnessKit(
      kitId,
      {
        signal: abort.signal,
      },
    )
      .then((value) => {
        if (!abort.signal.aborted) {
          setData(value);
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setError(failure.message);
        }
      });

    return () => abort.abort();
  }, [kitId, revision]);

  return (
    <>
      <Link to="/kits">
        ← Choose kit level
      </Link>

      {error ? (
        <section>
          <p role="alert">{error}</p>

          <button
            className="button secondary"
            type="button"
            onClick={() =>
              setRevision(
                (value) => value + 1,
              )
            }
          >
            Retry
          </button>
        </section>
      ) : !data ? (
        <p role="status">
          Loading kit choices…
        </p>
      ) : (
        <Builder
          key={`${data.kit.id}:${revision}`}
          data={data}
          storageKey={storageKey}
          group={group}
          reload={() =>
            setRevision(
              (value) => value + 1,
            )
          }
        />
      )}
    </>
  );
}

function Builder({
  data,
  storageKey,
  reload,
  group,
}) {
  const {
    kit,
    products,
  } = data;

  const {
    saveFitnessKit,
    catalogReady,
  } = useStore();

  const {
    loading: authLoading,
  } = useAuth();

  const navigate = useNavigate();

  const [expectedGroupSignature] =
    useState(() =>
      group
        ? kitGroupSignature(
            group.items,
            group.id,
          )
        : "",
    );

  const [saving, setSaving] =
    useState(false);

  const [saveError, setSaveError] =
    useState("");

  const saveLock = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  const [restored] = useState(() =>
    restoreKitSelections(
      kit,

      readStorage(storageKey, null) ||
        (
          group
            ? {
                version: group.version,

                selections: [
                  ...group.items.map(
                    (item) => ({
                      slotKey:
                        item.kitGroup.slotKey,

                      included: true,
                      productId: productId(item),

                      selectedSize:
                        item.selectedSize ?? null,

                      selectedColor:
                        item.selectedColor ?? null,

                      quantity: item.quantity,
                    }),
                  ),

                  ...defaultKitSelections(kit)
                    .filter(
                      (row) =>
                        !group.items.some(
                          (item) =>
                            item.kitGroup.slotKey ===
                            row.slotKey,
                        ),
                    )
                    .map((row) => ({
                      ...row,
                      included: false,
                    })),
                ],
              }
            : null
        ),
    ),
  );

  const [
    selections,
    setSelections,
  ] = useState(restored.selections);

  const [coupon, setCoupon] =
    useState("");

  const [
    deliveryMethod,
    setDeliveryMethod,
  ] = useState("standard");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("razorpay");

  const [result, setResult] =
    useState(null);

  const [
    quoteError,
    setQuoteError,
  ] = useState("");

  const [quoting, setQuoting] =
    useState(false);

  const [
    storageError,
    setStorageError,
  ] = useState(false);

  const [retry, setRetry] =
    useState(0);

  const [
    templateChanged,
    setTemplateChanged,
  ] = useState(restored.changed);

  const initial = useRef(true);

  const checked = inspectKitSelections(
    kit,
    products,
    selections,
  );

  const signature = JSON.stringify({
    selections,
    coupon,
    deliveryMethod,
    paymentMethod,
    version: kit.version,
  });

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }

    setStorageError(
      !writeStorage(
        storageKey,
        {
          version: kit.version,
          selections,
        },
      ),
    );
  }, [
    storageKey,
    kit.version,
    selections,
  ]);

  useEffect(() => {
    const abort = new AbortController();

    setResult(null);
    setQuoteError("");

    if (checked.errors.length) {
      setQuoting(false);

      return () => abort.abort();
    }

    setQuoting(true);

    const timer = setTimeout(() => {
      quoteFitnessKit(
        kit,
        checked.selections,
        {
          coupon,
          deliveryMethod,
          paymentMethod,
          signal: abort.signal,
        },
      )
        .then((quote) => {
          if (!abort.signal.aborted) {
            setResult({
              signature,
              quote,
            });
          }
        })
        .catch((failure) => {
          if (!abort.signal.aborted) {
            setQuoteError(failure.message);

            if (
              failure.code ===
              "KIT_VERSION_CHANGED"
            ) {
              setTemplateChanged(true);
            }
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) {
            setQuoting(false);
          }
        });
    }, 600);

    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [signature, retry]);

  async function saveKit() {
    if (
      saveLock.current ||
      authLoading ||
      !catalogReady
    ) {
      return;
    }

    setSaveError("");

    if (checked.errors.length) {
      setSaveError(
        "Complete the highlighted kit choices before saving.",
      );
      return;
    }

    if (
      typeof saveFitnessKit !== "function"
    ) {
      setSaveError(
        "Update StoreContext.jsx with the kit-saving code first.",
      );
      return;
    }

    saveLock.current = true;
    setSaving(true);

    try {
      const saved = await saveFitnessKit({
        kitId: kit.id,
        version: kit.version,
        selections,
        groupId: group?.id || "",
        expectedGroupSignature,
      });

      if (!saved?.groupId) {
        throw new Error(
          "Kit saving could not be confirmed. Check your bag before retrying.",
        );
      }

      if (alive.current) {
        navigate("/cart");
      }
    } catch (failure) {
      if (alive.current) {
        setSaveError(
          failure.message ||
          "The kit could not be saved. Please retry.",
        );
      }
    } finally {
      saveLock.current = false;

      if (alive.current) {
        setSaving(false);
      }
    }
  }

  function update(slotKey, change) {
    if (saveLock.current) {
      return;
    }

    setSaveError("");

    setSelections((previous) =>
      previous.map((row) =>
        row.slotKey === slotKey
          ? {
              ...row,
              ...change,
            }
          : row,
      ),
    );
  }

  const quote =
    result?.signature === signature
      ? result.quote
      : null;

  return (
    <>
      <h2>{kit.name}</h2>
      <p>{kit.audience}</p>
      <p>{kit.explanation}</p>
      <p>{kit.supplementNote}</p>

      <p className="notice">
        Kit customization and estimates are available.
        Save your kit to the bag, then review current
        prices, package contents and delivery charges
        at checkout.
      </p>

      {group && (
        <p className="notice">
          Editing {group.name} from your bag.
          Changes are saved as a separate draft
          until you choose Save kit changes.
          Saving replaces the complete kit.{" "}

          <Link to="/cart">
            Return to bag
          </Link>
        </p>
      )}

      {restored.restored && (
        <p>
          {group
            ? "Your kit choices or saved editing draft were restored."
            : "Your saved choices were restored on this device."}
        </p>
      )}

      {storageError && (
        <p role="alert">
          Your browser could not save these choices.
          Keep this page open; refreshing may lose
          your changes.
        </p>
      )}

      {templateChanged && (
        <p className="notice">
          The template changed. Review saved choices
          or reload the latest kit.{" "}

          <button
            type="button"
            disabled={saving}
            onClick={reload}
          >
            Reload kit
          </button>
        </p>
      )}

      <button
        type="button"
        className="button secondary"
        disabled={saving}
        onClick={() => {
          if (
            window.confirm(
              "Reset all choices to the suggested kit?",
            )
          ) {
            setSelections(
              defaultKitSelections(kit),
            );

            setCoupon("");
          }
        }}
      >
        Reset to suggested kit
      </button>

      <fieldset
        className="kit-builder-fields"
        disabled={saving}
      >
        <div className="kit-builder-layout">
          <div>
            {kit.slots.map((slot) => {
              const row = selections.find(
                (value) =>
                  value.slotKey === slot.key,
              );

              const product = products.find(
                (value) =>
                  productId(value) ===
                  row?.productId,
              );

              const choices = products.filter(
                (value) =>
                  slot.allowedProducts.includes(
                    productId(value),
                  ),
              );

              const available = product
                ? getVariantStock(
                    product,
                    row?.selectedSize,
                    row?.selectedColor,
                  )
                : 0;

              const otherQuantity = selections
                .filter(
                  (value) =>
                    value.included &&
                    value.slotKey !== slot.key &&
                    value.productId ===
                      row?.productId &&
                    value.selectedSize ===
                      row?.selectedSize &&
                    value.selectedColor ===
                      row?.selectedColor,
                )
                .reduce(
                  (sum, value) =>
                    sum + value.quantity,
                  0,
                );

              const maximum = Math.min(
                slot.maximumQuantity,

                Math.max(
                  0,
                  available - otherQuantity,
                ),
              );

              return (
                <section
                  className="panel"
                  key={slot.key}
                >
                  <h3>{slot.label}</h3>
                  <p>{slot.whySelected}</p>

                  <p>
                    {slot.optional
                      ? "Optional item"
                      : slot.suggestedEssential
                        ? "Suggested essential — skip if you already own it"
                        : "Suggested item"}
                  </p>

                  <label>
                    <span>
                      {slot.role === "supplements"
                        ? "Include this supplement — leave unchecked for No supplements"
                        : "Include this category"}
                    </span>

                    <input
                      type="checkbox"
                      checked={
                        row?.included || false
                      }
                      onChange={(event) =>
                        update(
                          slot.key,
                          {
                            included:
                              event.target.checked,
                          },
                        )
                      }
                    />
                  </label>

                  {row?.included && (
                    <>
                      <label>
                        Choose product

                        <select
                          value={row.productId}
                          onChange={(event) =>
                            update(
                              slot.key,
                              {
                                productId:
                                  event.target.value,

                                selectedSize: null,
                                selectedColor: null,
                                quantity: 1,
                              },
                            )
                          }
                        >
                          <option value="">
                            Choose a product
                          </option>

                          {row.productId &&
                            !choices.some(
                              (value) =>
                                productId(value) ===
                                row.productId,
                            ) && (
                              <option
                                value={row.productId}
                              >
                                Saved product unavailable
                                — choose another
                              </option>
                            )}

                          {choices.map((value) => (
                            <option
                              value={productId(value)}
                              key={productId(value)}
                            >
                              {value.name} ·{" "}

                              {value.brand ||
                                "Brand not recorded"}

                              {" · "}

                              {money(
                                getDiscountedPrice(
                                  value,
                                ),
                              )}
                            </option>
                          ))}
                        </select>
                      </label>

                      {!choices.length && (
                        <p>
                          No eligible products are
                          currently available. Skip
                          this category or try again
                          later.
                        </p>
                      )}

                      {product && (
                        <>
                          <ProductImage
                            product={{
                              ...product,

                              selectedColor:
                                row?.selectedColor,
                            }}
                            className="kit-builder-photo"
                          />

                          <p>
                            {product.name} ·{" "}

                            {product.brand ||
                              "Brand not recorded"}

                            {" · "}

                            {money(
                              getDiscountedPrice(
                                product,
                              ),
                            )} each
                          </p>

                          <Link
                            to={
                              `/product/${encodeURIComponent(
                                productId(product),
                              )}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View product details
                          </Link>

                          {[
                            [
                              "sizes",
                              "selectedSize",
                              product.optionLabels
                                ?.size || "Size",
                            ],
                            [
                              "colors",
                              "selectedColor",
                              product.optionLabels
                                ?.color || "Colour",
                            ],
                          ].map(
                            ([axis, key, label]) =>
                              product[axis]?.length >
                              0 ? (
                                <label key={key}>
                                  {label}

                                  <select
                                    value={
                                      row[key] || ""
                                    }
                                    onChange={(event) =>
                                      update(
                                        slot.key,
                                        {
                                          [key]:
                                            event.target
                                              .value ||
                                            null,
                                        },
                                      )
                                    }
                                  >
                                    <option value="">
                                      Choose{" "}
                                      {label.toLowerCase()}
                                    </option>

                                    {row[key] &&
                                      !product[
                                        axis
                                      ].includes(
                                        row[key],
                                      ) && (
                                        <option
                                          value={
                                            row[key]
                                          }
                                        >
                                          Saved option
                                          unavailable
                                        </option>
                                      )}

                                    {product[
                                      axis
                                    ].map((value) => (
                                      <option
                                        key={value}
                                        value={value}
                                      >
                                        {value}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null,
                          )}

                          <label>
                            Quantity

                            <input
                              type="number"
                              min={1}
                              max={Math.max(
                                1,
                                maximum,
                              )}
                              step={1}
                              value={row.quantity}
                              onChange={(event) =>
                                update(
                                  slot.key,
                                  {
                                    quantity: Number(
                                      event.target.value,
                                    ),
                                  },
                                )
                              }
                            />
                          </label>

                          <p>
                            {available > 0
                              ? `${available} currently in stock for this variant. Up to ${maximum} available for this section after your other kit choices.`
                              : "Choose all variants, or replace or skip this unavailable item."}
                          </p>

                          <p>
                            Item estimate:{" "}

                            {money(
                              getDiscountedPrice(
                                product,
                              ) * row.quantity,
                            )}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </section>
              );
            })}
          </div>

          <details className="kit-builder-summary">
            <summary>
              Kit summary ·{" "}

              {money(
                quote?.pricing.finalTotal ??
                checked.subtotal,
              )}

              {" "}

              {quote
                ? "estimated total"
                : "items before discounts"}
            </summary>

            <div>
              <h3>Your kit</h3>

              {checked.rows.length ? (
                <ul>
                  {checked.rows.map((row) => (
                    <li key={row.slotKey}>
                      {row.name} × {row.quantity}
                      {" "}·{" "}
                      {money(row.linePrice)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No items selected yet.</p>
              )}

              <label>
                Coupon code

                <input
                  maxLength={50}
                  value={coupon}
                  onChange={(event) =>
                    setCoupon(
                      event.target.value
                        .toUpperCase(),
                    )
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Delivery estimate

                <select
                  value={deliveryMethod}
                  onChange={(event) =>
                    setDeliveryMethod(
                      event.target.value,
                    )
                  }
                >
                  <option value="standard">
                    Standard
                  </option>

                  <option value="express">
                    Express
                  </option>
                </select>
              </label>

              <label>
                Payment estimate

                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value,
                    )
                  }
                >
                  <option value="razorpay">
                    Online payment
                  </option>

                  <option value="cod-partial">
                    COD with 10% advance
                  </option>
                </select>
              </label>

              {checked.errors.length > 0 && (
                <div role="alert">
                  <h4>Complete your choices</h4>

                  <ul>
                    {checked.errors.map((error) => (
                      <li key={error}>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {quoting && (
                <p role="status">
                  Updating your estimate…
                </p>
              )}

              {quoteError && (
                <p role="alert">
                  {quoteError}
                </p>
              )}

              <dl>
                {quote ? (
                  [
                    [
                      "Item subtotal",
                      quote.pricing.subtotal,
                    ],
                    [
                      "Kit savings",
                      quote.pricing.kitDiscount,
                    ],
                    [
                      "Coupon savings",
                      quote.pricing.couponDiscount,
                    ],
                    [
                      "Shipping estimate",
                      quote.pricing.shipping,
                    ],
                    [
                      "Estimated total",
                      quote.pricing.finalTotal,
                    ],
                    [
                      "Payable now estimate",
                      quote.payment.amountToPayNow,
                    ],
                    [
                      "Remaining balance",
                      quote.payment.amountDue,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{money(value)}</dd>
                    </div>
                  ))
                ) : (
                  <div>
                    <dt>
                      Items before discounts
                    </dt>

                    <dd>
                      {money(checked.subtotal)}
                    </dd>
                  </div>
                )}
              </dl>

              {quote?.discountEligibility
                ?.reasons?.length > 0 && (
                <ul>
                  {quote.discountEligibility
                    .reasons.map((reason) => (
                      <li key={reason}>
                        {reason}
                      </li>
                    ))}
                </ul>
              )}

              <button
                type="button"
                className="button secondary"
                disabled={
                  checked.errors.length > 0 ||
                  quoting
                }
                onClick={() =>
                  setRetry(
                    (value) => value + 1,
                  )
                }
              >
                Refresh estimate
              </button>

              <button
                type="button"
                className="button"
                disabled={
                  saving ||
                  authLoading ||
                  !catalogReady ||
                  checked.errors.length > 0
                }
                onClick={saveKit}
              >
                {saving
                  ? "Checking prices and saving…"
                  : authLoading
                    ? "Checking your account…"
                    : !catalogReady
                      ? "Waiting for catalogue…"
                      : group
                        ? "Save kit changes"
                        : "Add kit to bag"}
              </button>

              {saveError && (
                <p
                  className="field-error"
                  role="alert"
                >
                  {saveError}
                </p>
              )}

              <p>
                Adding to your bag does not place
                an order or reserve stock. Checkout
                confirms prices, stock and delivery
                arrangements before payment.
              </p>

              <p>
                Coupon, delivery and payment choices
                above are estimates only. They are
                not applied when saving the kit to
                your bag.
              </p>

              <p>
                Stock is not reserved. Delivery coverage,
                packing arrangements and final shipping
                charges must be checked before payment.
              </p>

              <p>
                {kit.fulfillment?.customerNote}
              </p>

              {kit.fulfillment?.mode ===
                "separate-shipments" && (
                  <p>
                    This setup uses separate shipments.
                    Package contents and estimates
                    must be confirmed before purchase.
                  </p>
                )}
            </div>
          </details>
        </div>
      </fieldset>
    </>
  );
}