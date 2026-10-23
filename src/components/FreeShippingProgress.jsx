import {
  money,
} from "../utils/productPricing.js";

export function shippingProgress(quote) {
  const offer = quote?.freeShipping;

  const reasons = [
    "qualified",
    "disabled",
    "express-delivery",
    "products-excluded",
    "pincode-required",
    "pincode-excluded",
    "outside-eligible-region",
    "below-minimum",
  ];

  if (
    !offer ||
    offer.scope !==
      "ordinary-standard-basket" ||
    offer.allItemsMustQualify !== true ||
    typeof offer.enabled !== "boolean" ||
    typeof offer.qualified !== "boolean" ||
    !Number.isSafeInteger(offer.version) ||
    offer.version < 0 ||
    !Number.isSafeInteger(
      offer.minimumSubtotalPaise,
    ) ||
    offer.minimumSubtotalPaise < 0 ||
    offer.minimumSubtotalPaise > 100000000 ||
    typeof offer.additionalChargesNotice !==
      "string" ||
    offer.additionalChargesNotice.length > 500 ||
    !reasons.includes(offer.reason) ||
    offer.qualified !==
      (offer.reason === "qualified")
  ) {
    return null;
  }

  const progress = [
    "qualified",
    "below-minimum",
  ].includes(offer.reason);

  if (
    offer.enabled !==
    (offer.reason !== "disabled")
  ) {
    return null;
  }

  if (progress) {
    const merchandise = Math.round(
      quote.pricing?.totalAfterCoupon * 100,
    );

    const expected = Math.max(
      0,
      offer.minimumSubtotalPaise -
        merchandise,
    );

    const percent =
      offer.minimumSubtotalPaise === 0
        ? 100
        : Math.min(
            100,
            Math.floor(
              (
                merchandise /
                offer.minimumSubtotalPaise
              ) * 100,
            ),
          );

    if (
      !Number.isSafeInteger(merchandise) ||
      merchandise < 0 ||
      offer.qualifyingSubtotalPaise !==
        merchandise ||
      offer.remainingPaise !== expected ||
      offer.progressPercent !== percent ||
      offer.qualified !== (expected === 0) ||
      (
        offer.qualified &&
        quote.pricing?.shipping !== 0
      ) ||
      (
        quote.method &&
        quote.method !== "standard"
      )
    ) {
      return null;
    }
  } else if (
    offer.remainingPaise !== null ||
    offer.progressPercent !== null
  ) {
    return null;
  }

  return offer;
}

export default function FreeShippingProgress({
  quote,
  loading = false,
  error = "",
}) {
  const offer =
    !loading && !error
      ? shippingProgress(quote)
      : null;

  let message =
    "Delivery offers are checked with your order.";

  if (loading) {
    message =
      "Checking delivery charges and free shipping…";
  } else if (error) {
    message =
      "Delivery eligibility could not be checked. Retry before payment.";
  } else if (offer) {
    const messages = {
      qualified:
        "Your bag qualifies for free standard delivery.",

      "below-minimum":
        `Add ${money(
          offer.remainingPaise / 100,
        )} more in eligible products for free standard delivery.`,

      disabled:
        "Standard delivery charges apply. There is no active free shipping offer.",

      "express-delivery":
        "The free shipping offer applies to standard delivery. Express charges apply.",

      "products-excluded":
        "This offer does not cover every item in your bag. Standard delivery charges apply.",

      "pincode-required":
        "Save your delivery pincode to check this free shipping offer.",

      "pincode-excluded":
        "This free shipping offer is not available for your pincode.",

      "outside-eligible-region":
        "This free shipping offer is not available for your pincode.",
    };

    message = messages[offer.reason];
  }

  return (
    <section
      aria-label="Free shipping offer"
      style={{
        margin: "16px 0",
        padding: "14px",
        background: "#f7f8fa",
        borderRadius: "8px",
      }}
    >
      <p
        role="status"
        aria-live="polite"
        style={{
          margin: "0 0 8px",
        }}
      >
        {message}
      </p>

      {offer?.progressPercent != null && (
        <>
          <progress
            aria-label="Progress towards free standard delivery"
            max="100"
            value={offer.progressPercent}
            style={{
              width: "100%",
              accentColor: "#16855a",
            }}
          />

          <small>
            Minimum{" "}
            {money(
              offer.minimumSubtotalPaise / 100,
            )}{" "}
            after coupons. Every item must qualify.
          </small>
        </>
      )}

      {offer?.additionalChargesNotice && (
        <p
          className="muted"
          style={{
            margin: "8px 0 0",
          }}
        >
          {offer.additionalChargesNotice}
        </p>
      )}
    </section>
  );
}