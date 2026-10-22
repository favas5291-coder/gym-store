import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getCheckoutQuote,
} from "../services/checkoutQuoteApi.js";

import {
  resolveCoupon,
} from "../utils/orderCalculations.js";

import {
  savedPincode,
  savePincode,
  validPincode,
} from "../utils/deliveryPincode.js";

import {
  money,
} from "../utils/productPricing.js";

import FreeShippingProgress from "./FreeShippingProgress.jsx";

export default function CartShippingReview({
  items,
  coupon,
  enabled,
  storageKey,
  expectedPricing,
  onRefresh,
}) {
  const [pincode, setPincode] = useState(
    () => savedPincode(storageKey),
  );

  const [input, setInput] = useState(
    () => savedPincode(storageKey),
  );

  const [pinError, setPinError] =
    useState("");

  const [revision, setRevision] =
    useState(0);

  const [result, setResult] =
    useState(null);

  const latest = useRef(null);

  const requestKey = JSON.stringify({
    items: (
      Array.isArray(items) ? items : []
    ).map((item) => ({
      id:
        item.id ??
        item.productId ??
        item.product,

      quantity: item.quantity,
      selectedSize:
        item.selectedSize ?? null,

      selectedColor:
        item.selectedColor ?? null,
    })),

    coupon:
      resolveCoupon(coupon)?.code || "",

    pincode,
    storageKey,
    revision,
  });

  latest.current = {
    items,
    coupon:
      resolveCoupon(coupon)?.code || "",
    pincode,
  };

  const quote =
    enabled &&
    result?.key === requestKey &&
    result.quote &&
    Date.parse(
      result.quote.deliveryReview?.validUntil,
    ) > Date.now()
      ? result.quote
      : null;

  const error =
    enabled && result?.key === requestKey
      ? result.error
      : "";

  const loading =
    enabled && !quote && !error;

  useEffect(() => {
    function changed(event) {
      if (
        event?.type ===
          "gymdrobe-delivery-changed" &&
        event.detail?.key !== storageKey
      ) {
        return;
      }

      if (
        event?.type === "storage" &&
        event.key &&
        ![
          storageKey,
          "gymdrobe-shipping-offer-revision",
        ].includes(event.key)
      ) {
        return;
      }

      if (
        event?.type ===
          "gymdrobe-delivery-changed" ||
        (
          event?.type === "storage" &&
          event.key === storageKey
        )
      ) {
        let saved =
          event.detail?.pincode || "";

        if (event.type === "storage") {
          try {
            saved = JSON.parse(
              event.newValue || "null",
            );
          } catch {
            saved = "";
          }
        }

        const value = validPincode(saved)
          ? String(saved).trim()
          : "";

        setPincode(value);
        setInput(value);
      }

      setRevision((value) => value + 1);
    }

    function focus() {
      if (
        document.visibilityState !==
        "hidden"
      ) {
        setRevision((value) => value + 1);
      }
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

    window.addEventListener(
      "focus",
      focus,
    );

    window.addEventListener(
      "online",
      focus,
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

      window.removeEventListener(
        "focus",
        focus,
      );

      window.removeEventListener(
        "online",
        focus,
      );
    };
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }

    const controller =
      new AbortController();

    const payload = latest.current;

    let active = true;
    let expiry;

    const timer = setTimeout(() => {
      getCheckoutQuote(
        null,
        {
          ...payload,
          deliveryMethod: "standard",
          paymentMethod: "razorpay",
        },
        {
          signal: controller.signal,
        },
      )
        .then((quote) => {
          if (!active) return;

          const remaining =
            Date.parse(
              quote.deliveryReview?.validUntil,
            ) - Date.now();

          if (
            !Number.isFinite(remaining) ||
            remaining <= 0
          ) {
            throw new Error(
              "Delivery review expired. Retry the check.",
            );
          }

          setResult({
            key: requestKey,
            quote,
            error: "",
          });

          expiry = setTimeout(
            () => {
              if (active) {
                setRevision(
                  (value) => value + 1,
                );
              }
            },
            Math.min(
              remaining,
              2147483647,
            ),
          );
        })
        .catch((failure) => {
          if (active) {
            setResult({
              key: requestKey,
              quote: null,

              error:
                failure.message ||
                "Delivery could not be checked.",
            });
          }
        });
    }, 350);

    return () => {
      active = false;

      clearTimeout(timer);
      clearTimeout(expiry);

      controller.abort();
    };
  }, [enabled, requestKey]);

  function save(event) {
    event.preventDefault();

    const code = input.trim();

    if (!validPincode(code)) {
      setPinError(
        "Enter a valid six-digit Indian pincode.",
      );

      return;
    }

    savePincode(storageKey, code);

    setPincode(code);
    setPinError("");

    setRevision((value) => value + 1);
  }

  const amountsMatch =
    quote &&
    [
      "subtotal",
      "couponDiscount",
      "totalAfterCoupon",
    ].every(
      (key) =>
        Math.round(
          quote.pricing[key] * 100,
        ) ===
        Math.round(
          expectedPricing[key] * 100,
        ),
    );

  return (
    <div>
      <form
        onSubmit={save}
        noValidate
      >
        <label
          style={{
            display: "block",
            marginBottom: "8px",
          }}
        >
          Delivery pincode

          <input
            value={input}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            disabled={!enabled}
            aria-invalid={Boolean(pinError)}
            onChange={(event) => {
              setInput(
                event.target.value.replace(
                  /\D/g,
                  "",
                ),
              );

              setPinError("");
            }}
            style={{
              display: "block",
              width: "100%",
              marginTop: "6px",
            }}
          />
        </label>

        <button
          type="submit"
          className="button secondary compact"
          disabled={!enabled}
        >
          Save pincode
        </button>

        {pinError && (
          <p
            className="field-error"
            role="alert"
          >
            {pinError}
          </p>
        )}
      </form>

      {!enabled ? (
        <p className="muted">
          Check the highlighted items to review
          delivery charges.
        </p>
      ) : quote && !amountsMatch ? (
        <div role="status">
          <p>
            Product prices changed. Refresh your
            bag before reviewing delivery.
          </p>

          <button
            type="button"
            className="text-link"
            onClick={onRefresh}
          >
            Refresh products
          </button>
        </div>
      ) : (
        <>
          <FreeShippingProgress
            quote={quote}
            loading={loading}
            error={error}
          />

          {error && (
            <>
              <p
                className="field-error"
                role="alert"
              >
                {error}
              </p>

              <button
                type="button"
                className="text-link"
                onClick={() =>
                  setRevision(
                    (value) => value + 1,
                  )
                }
              >
                Retry delivery check
              </button>
            </>
          )}

          {amountsMatch && (
            <dl>
              <div>
                <dt>
                  Estimated standard delivery
                </dt>

                <dd>
                  {quote.pricing.shipping === 0
                    ? "Free"
                    : money(
                        quote.pricing.shipping,
                      )}
                </dd>
              </div>

              <div className="total">
                <dt>Estimated total</dt>

                <dd>
                  {money(
                    quote.pricing.finalTotal,
                  )}
                </dd>
              </div>
            </dl>
          )}
        </>
      )}

      <p className="muted">
        Checkout checks current prices, delivery
        charges and eligibility again before
        payment.
      </p>
    </div>
  );
}