import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";

import {
  getCheckoutQuote,
} from "../services/checkoutQuoteApi.js";

import {
  bagEditSignature,
} from "../utils/bagVariantEditing.js";

import { reviewCart } from "../utils/cartReview.js";
import { rankCartAddons } from "../utils/commerce.js";

import {
  getKitGroup,
  getVariantStock,
  normalizeCartItem,
} from "../utils/cartUtils.js";

import {
  savedPincode,
  validPincode,
} from "../utils/deliveryPincode.js";

import {
  resolveCoupon,
} from "../utils/orderCalculations.js";

import {
  selectedProductImage,
} from "../utils/productImages.js";

import {
  optionLabels,
} from "../utils/productInformation.js";

import {
  getDiscountedPrice,
  money,
} from "../utils/productPricing.js";

import {
  latestPurchaseProduct,
  productReference,
  purchaseOptions,
  purchaseState,
} from "../utils/productPurchase.js";

import {
  ProductImage,
  productPath,
} from "./StorefrontShared.jsx";

const STYLES = `
.gd-cart-addons {
  margin-top: 20px;
  min-width: 0;
}

.gd-cart-addons h2 {
  margin: 0 0 8px;
  font-size: 19px;
}

.gd-cart-addon-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, 200px), 1fr)
  );
  gap: 12px;
}

.gd-cart-addon {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--gd-border, #e5e7eb);
  border-radius: 8px;
  background: #fff;
  overflow-wrap: anywhere;
}

.gd-cart-addon-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gd-cart-addon-photo {
  display: block;
  width: 64px;
  height: 76px;
  flex: 0 0 64px;
  background: #f5f5f6;
  overflow: hidden;
  border-radius: 6px;
}

.gd-cart-addon-photo > * {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.gd-cart-addon h3 {
  margin: 0 0 6px;
  font-size: 14px;
  line-height: 1.45;
}

.gd-cart-addon p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.gd-cart-addon label {
  display: grid;
  gap: 5px;
  font-size: 13px;
}

.gd-cart-addon select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 8px;
  border: 1px solid var(--gd-border, #d1d5db);
  border-radius: 6px;
  background: #fff;
  color: inherit;
  font: inherit;
  font-size: 16px;
}

.gd-cart-addon .button {
  width: 100%;
  min-height: 44px;
  margin-top: auto;
}

.gd-cart-addon a:focus-visible,
.gd-cart-addon select:focus-visible,
.gd-cart-addon button:focus-visible {
  outline: 3px solid #c2410c;
  outline-offset: 3px;
}

.gd-cart-addon-status {
  min-height: 24px;
  margin: 10px 0 0;
  font-size: 13px;
}
`;

function quoteSelection(
  row,
  id,
  price,
  group,
) {
  return JSON.stringify([
    String(id),
    row.quantity,
    row.selectedSize ?? null,
    row.selectedColor ?? null,
    group?.id ?? null,
    group?.slotKey ?? null,
    Math.round(price * 100),
  ]);
}

function matchesQuote(
  quote,
  rows,
  products,
) {
  if (
    !Array.isArray(quote?.items) ||
    quote.items.length !== rows.length
  ) {
    return false;
  }

  const expected = rows
    .map((row) => {
      const product = latestPurchaseProduct(
        products,
        row,
      );

      if (!product) {
        return "missing-product";
      }

      return quoteSelection(
        row,
        product._id || productReference(product),
        getDiscountedPrice(product),
        getKitGroup(row),
      );
    })
    .sort();

  const actual = quote.items
    .map((row) =>
      quoteSelection(
        row,
        row.product,
        row.price,
        row.kit
          ? {
              id: row.kit.groupId,
              slotKey: row.kit.slotKey,
            }
          : null,
      ),
    )
    .sort();

  return expected.every(
    (value, index) => value === actual[index],
  );
}

export default function CartAddons({
  configuredPairs = [],
}) {
  const { shoppingKey } = useStore();

  const scope = shoppingKey(
    "gymdrobe-cart",
  );

  return (
    <ScopedCartAddons
      key={scope}
      configuredPairs={configuredPairs}
    />
  );
}

function ScopedCartAddons({
  configuredPairs,
}) {
  const {
    loading: authLoading,
  } = useAuth();

  const {
    products,
    loading,
    error: catalogError,
    refreshProducts,
    getLatestProducts,
  } = useCatalog();

  const {
    cart,
    latestCart,
    addToCart,
    coupon,
    catalogReady,
    shoppingKey,
    notify,
  } = useStore();

  const storageKey = shoppingKey(
    "gymdrobe-delivery-pincode",
  );

  const ready =
    catalogReady &&
    !loading &&
    !catalogError &&
    !authLoading;

  const couponCode =
    resolveCoupon(coupon)?.code || "";

  const [pincode, setPincode] = useState(
    () => savedPincode(storageKey),
  );

  const [busy, setBusy] = useState("");

  const [notice, setNotice] = useState({
    message: "",
    error: false,
  });

  const mounted = useRef(false);
  const lock = useRef(false);
  const request = useRef(null);
  const live = useRef(null);

  const destination = useRef(pincode);

  destination.current = pincode;

  live.current = {
    ready,
    couponCode,
    configuredPairs,
  };

  const review = useMemo(
    () =>
      reviewCart(
        cart,
        products,
        ready,
        {
          allowKitReview: true,
        },
      ),
    [cart, products, ready],
  );

  const suggestions = useMemo(
    () =>
      ready && review.canCheckout
        ? rankCartAddons(
            cart,
            products,
            {
              configuredPairs,
            },
          )
        : [],
    [
      ready,
      review.canCheckout,
      cart,
      products,
      configuredPairs,
    ],
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  useEffect(() => {
    function changed(event) {
      let value;

      if (
        event.type ===
        "gymdrobe-delivery-changed"
      ) {
        if (
          event.detail?.key !== storageKey
        ) {
          return;
        }

        value = event.detail.pincode;
      } else if (
        event.type === "storage"
      ) {
        if (
          event.key !== storageKey &&
          event.key !== null
        ) {
          return;
        }

        try {
          value = JSON.parse(
            event.newValue || "null",
          );
        } catch {
          value = "";
        }
      } else {
        request.current?.abort();
        return;
      }

      const next = validPincode(value)
        ? String(value).trim()
        : "";

      destination.current = next;

      setPincode(next);
      request.current?.abort();
    }

    window.addEventListener(
      "gymdrobe-delivery-changed",
      changed,
    );

    window.addEventListener(
      "gymdrobe-shipping-settings-changed",
      changed,
    );

    window.addEventListener(
      "storage",
      changed,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-delivery-changed",
        changed,
      );

      window.removeEventListener(
        "gymdrobe-shipping-settings-changed",
        changed,
      );

      window.removeEventListener(
        "storage",
        changed,
      );
    };
  }, [storageKey]);

  async function add(
    suggestion,
    size,
    color,
  ) {
    if (
      lock.current ||
      !mounted.current
    ) {
      return;
    }

    const selection = purchaseState(
      suggestion.product,
      size,
      color,
      1,
      ready,
    );

    if (!selection.canBuy) {
      setNotice({
        message: selection.message,
        error: true,
      });

      return;
    }

    lock.current = true;

    const controller =
      new AbortController();

    request.current = controller;

    const id = String(
      productReference(
        suggestion.product,
      ),
    );

    const before = bagEditSignature(
      latestCart(),
    );

    const startingCoupon = couponCode;

    const startingPincode =
      destination.current;

    const startingRules =
      JSON.stringify(configuredPairs);

    setBusy(id);

    setNotice({
      message:
        "Checking current price, stock and delivery…",
      error: false,
    });

    function unchanged() {
      return (
        mounted.current &&
        !controller.signal.aborted &&
        live.current.ready &&
        live.current.couponCode ===
          startingCoupon &&
        destination.current ===
          startingPincode &&
        JSON.stringify(
          live.current.configuredPairs,
        ) === startingRules &&
        bagEditSignature(
          latestCart(),
        ) === before
      );
    }

    try {
      const fresh =
        await refreshProducts();

      if (!mounted.current) return;

      if (!unchanged()) {
        throw new Error(
          "Your bag or delivery details changed. Review them and try adding again.",
        );
      }

      const current =
        latestPurchaseProduct(
          fresh,
          suggestion.product,
        );

      const stillSuggested =
        rankCartAddons(
          latestCart(),
          fresh,
          {
            configuredPairs:
              live.current.configuredPairs,
          },
        ).some(
          (row) =>
            String(
              productReference(
                row.product,
              ),
            ) === id,
        );

      if (
        !current ||
        !stillSuggested
      ) {
        throw new Error(
          "This suggestion changed or is already in your bag. Review the current items.",
        );
      }

      if (
        Math.round(
          getDiscountedPrice(
            current,
          ) * 100,
        ) !== suggestion.pricePaise
      ) {
        throw new Error(
          "This product's price changed. Review its updated price before adding.",
        );
      }

      const state = purchaseState(
        current,
        size,
        color,
        1,
        true,
      );

      if (!state.canBuy) {
        throw new Error(
          state.message,
        );
      }

      const proposed = [
        ...latestCart(),

        normalizeCartItem(
          current,
          1,
          size,
          color,
        ),
      ];

      const checked = reviewCart(
        proposed,
        fresh,
        true,
        {
          allowKitReview: true,
        },
      );

      if (!checked.canCheckout) {
        throw new Error(
          checked.rows.find(
            (row) => !row.available,
          )?.message ||
            "Review your bag before adding this item.",
        );
      }

      const quote =
        await getCheckoutQuote(
          null,
          {
            items: proposed,
            coupon: startingCoupon,
            pincode: startingPincode,
            deliveryMethod: "standard",
            paymentMethod: "razorpay",
          },
          {
            signal:
              controller.signal,
          },
        );

      if (!mounted.current) return;

      if (!unchanged()) {
        throw new Error(
          "Your bag or delivery details changed. Review them and try adding again.",
        );
      }

      const expires = Date.parse(
        quote.deliveryReview?.validUntil ||
          quote.shippingReview?.validUntil,
      );

      if (
        !Number.isFinite(expires) ||
        expires <= Date.now()
      ) {
        throw new Error(
          "Delivery could not be reviewed for this bag. Check your pincode and any kit delivery details, then retry.",
        );
      }

      if (
        quote.deliveryReview?.available ===
          false ||
        !matchesQuote(
          quote,
          proposed,
          fresh,
        )
      ) {
        throw new Error(
          "The server returned different prices, selections or delivery availability. Refresh your bag before adding.",
        );
      }

      const latest =
        getLatestProducts();

      const latestProduct =
        latestPurchaseProduct(
          latest,
          current,
        );

      const finalState =
        purchaseState(
          latestProduct,
          size,
          color,
          1,
          live.current.ready,
        );

      const remainsSuggested =
        rankCartAddons(
          latestCart(),
          latest,
          {
            configuredPairs:
              live.current.configuredPairs,
          },
        ).some(
          (row) =>
            String(
              productReference(
                row.product,
              ),
            ) === id,
        );

      if (
        !finalState.canBuy ||
        !remainsSuggested ||
        Math.round(
          getDiscountedPrice(
            latestProduct,
          ) * 100,
        ) !== suggestion.pricePaise
      ) {
        throw new Error(
          finalState.message ||
            "This product changed. Review the latest suggestion before adding.",
        );
      }

      if (
        addToCart(
          latestProduct,
          1,
          size,
          color,
        ) !== true
      ) {
        throw new Error(
          "This item could not be added. Your existing bag is unchanged; review it before retrying.",
        );
      }

      setNotice({
        message:
          `${latestProduct.name} added to your bag.`,
        error: false,
      });
    } catch (error) {
      if (mounted.current) {
        const message =
          controller.signal.aborted
            ? "The check was stopped because your delivery settings changed. Review your bag and retry."
            : error.message ||
              "This extra could not be checked. Please retry.";

        setNotice({
          message,
          error: true,
        });

        notify(
          message,
          "error",
        );
      }
    } finally {
      lock.current = false;

      if (
        request.current === controller
      ) {
        request.current = null;
      }

      if (mounted.current) {
        setBusy("");
      }
    }
  }

  if (
    !suggestions.length &&
    !busy
  ) {
    return null;
  }

  return (
    <section
      className="panel gd-cart-addons"
      aria-label="Complete your workout essentials"
    >
      <style>{STYLES}</style>

      <h2>
        Complete your workout essentials
      </h2>

      <p
        className="muted"
        style={{
          margin: "0 0 14px",
        }}
      >
        Optional extras to explore with your
        bag. Choose only what you need.
      </p>

      <div className="gd-cart-addon-grid">
        {suggestions.map((row) => (
          <AddonCard
            key={String(
              productReference(
                row.product,
              ),
            )}
            row={row}
            disabled={
              Boolean(busy) ||
              !ready
            }
            busy={
              busy ===
              String(
                productReference(
                  row.product,
                ),
              )
            }
            onAdd={add}
          />
        ))}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={
          `gd-cart-addon-status ${
            notice.error
              ? "field-error"
              : "muted"
          }`
        }
      >
        {notice.message}
      </p>

      <p
        className="muted"
        style={{
          fontSize: "12px",
          margin: "4px 0 0",
        }}
      >
        Delivery charges and free-shipping
        progress update with your bag.

        {pincode
          ? ""
          : " Save a pincode to review delivery eligibility."}

        {" "}

        Checkout confirms final charges.
        Items from different suppliers may
        arrive separately.
      </p>
    </section>
  );
}

function AddonCard({
  row,
  disabled,
  busy,
  onAdd,
}) {
  const product = row.product;

  const sizes = purchaseOptions(
    product.sizes,
  );

  const colors = purchaseOptions(
    product.colors,
  );

  const labels = optionLabels(
    product,
  );

  const [size, setSize] =
    useState("");

  const [color, setColor] =
    useState("");

  const [error, setError] =
    useState("");

  const sizeRef = useRef(null);
  const colorRef = useRef(null);

  const path = productPath(
    productReference(product),
  );

  function submit(event) {
    event.preventDefault();

    if (disabled) return;

    const state = purchaseState(
      product,
      size || null,
      color || null,
      1,
      true,
    );

    if (!state.canBuy) {
      setError(
        state.message,
      );

      if (
        sizes.length &&
        !sizes.includes(size)
      ) {
        sizeRef.current?.focus();
      } else if (
        colors.length &&
        !colors.includes(color)
      ) {
        colorRef.current?.focus();
      }

      return;
    }

    setError("");

    void onAdd(
      row,
      size || null,
      color || null,
    );
  }

  function changeColor(value) {
    setColor(value);
    setError("");

    if (
      size &&
      getVariantStock(
        product,
        size,
        value || null,
      ) < 1
    ) {
      setSize("");

      setError(
        `Choose an available ${labels.size.toLowerCase()} for this ${labels.color.toLowerCase()}.`,
      );
    }
  }

  return (
    <form
      className="gd-cart-addon"
      onSubmit={submit}
      noValidate
      aria-label={`Add ${product.name} to your bag`}
      aria-busy={busy}
    >
      <div className="gd-cart-addon-head">
        <Link
          to={path}
          className="gd-cart-addon-photo"
          aria-label={`View ${product.name}`}
        >
          <ProductImage
            product={{
              ...product,

              image:
                selectedProductImage(
                  product,
                  color || null,
                ),

              selectedColor:
                color || null,
            }}
            sizes="64px"
          />
        </Link>

        <div
          style={{
            minWidth: 0,
          }}
        >
          <h3>
            <Link to={path}>
              {product.name}
            </Link>
          </h3>

          <strong>
            {money(
              row.pricePaise / 100,
            )}
          </strong>
        </div>
      </div>

      <p className="muted">
        {row.reason}
      </p>

      {colors.length > 0 && (
        <label>
          {labels.color} (required)

          <select
            ref={colorRef}
            value={color}
            disabled={disabled}
            aria-label={`${labels.color} for ${product.name}`}
            aria-invalid={Boolean(
              error &&
              !colors.includes(color),
            )}
            onChange={(event) =>
              changeColor(
                event.target.value,
              )
            }
          >
            <option value="">
              Choose{" "}
              {labels.color.toLowerCase()}
            </option>

            {colors.map((value) => (
              <option
                key={value}
                value={value}
                disabled={
                  !(
                    sizes.length
                      ? sizes
                      : [null]
                  ).some(
                    (option) =>
                      getVariantStock(
                        product,
                        option,
                        value,
                      ) > 0,
                  )
                }
              >
                {value}
              </option>
            ))}
          </select>
        </label>
      )}

      {sizes.length > 0 && (
        <label>
          {labels.size} (required)

          <select
            ref={sizeRef}
            value={size}
            disabled={disabled}
            aria-label={`${labels.size} for ${product.name}`}
            aria-invalid={Boolean(
              error &&
              !sizes.includes(size),
            )}
            onChange={(event) => {
              setSize(
                event.target.value,
              );

              setError("");
            }}
          >
            <option value="">
              Choose{" "}
              {labels.size.toLowerCase()}
            </option>

            {sizes.map((value) => (
              <option
                key={value}
                value={value}
                disabled={
                  !(
                    color
                      ? [color]
                      : colors.length
                        ? colors
                        : [null]
                  ).some(
                    (option) =>
                      getVariantStock(
                        product,
                        value,
                        option,
                      ) > 0,
                  )
                }
              >
                {value}
              </option>
            ))}
          </select>
        </label>
      )}

      <p
        className="field-error"
        role="status"
        aria-live="polite"
        style={{
          minHeight: "20px",
        }}
      >
        {error}
      </p>

      <button
        type="submit"
        className="button secondary compact"
        disabled={disabled}
      >
        {busy
          ? "Checking…"
          : "Add to bag"}
      </button>
    </form>
  );
}