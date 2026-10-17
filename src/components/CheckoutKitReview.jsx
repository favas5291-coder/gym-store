import { Link } from "react-router-dom";
import { money } from "../utils/productPricing.js";

function days(range) {
  return range
    ? `${range.minimum}–${range.maximum} days`
    : "Awaiting confirmation";
}

export default function CheckoutKitReview({
  quote,
  loading,
  error,
  onRefresh,
  disabled,
}) {
  const shipping = quote?.shippingReview;

  return (
    <section
      className="panel"
      aria-label="Fitness Kit prices and packages"
      aria-busy={Boolean(loading)}
    >
      <h2>KIT PRICES & DELIVERY</h2>

      {loading && (
        <p role="status">
          Checking current kit prices, stock and delivery charges…
        </p>
      )}

      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      {!quote && !loading && !error && (
        <p>
          Enter your six-digit delivery pincode to check
          kit prices and packages.
        </p>
      )}

      {quote && (
        <>
          {quote.kitSnapshots.map((kit) => (
            <article key={kit.groupId}>
              <h3>{kit.name}</h3>

              <ul>
                {quote.items
                  .filter(
                    (item) => item.kit?.groupId === kit.groupId,
                  )
                  .map((item) => (
                    <li key={item.kit.slotKey}>
                      {item.name}
                      {" · "}
                      {[
                        item.selectedColor,
                        item.selectedSize,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "Standard option"}
                      {" · "}
                      Qty {item.quantity}
                      {" · "}
                      {money(
                        item.priceAllocation.linePaidPaise / 100,
                      )}
                      {" "}
                      after allocated discounts
                    </li>
                  ))}
              </ul>
            </article>
          ))}

          {shipping?.ready ? (
            <>
              <p>
                <strong>
                  {shipping.packageCount}{" "}
                  {shipping.packageCount === 1
                    ? "package"
                    : "packages"}
                </strong>
                . These are the package contents and charges
                for your selected pincode and payment method.
              </p>

              {shipping.shipments.map((parcel) => (
                <article
                  key={parcel.key}
                  style={{
                    borderTop: "1px solid #e5e7eb",
                    paddingBlock: "14px",
                  }}
                >
                  <h3>{parcel.label}</h3>

                  <p>
                    {parcel.carrier}
                    {" · "}
                    {parcel.service}
                  </p>

                  <ul>
                    {parcel.contents.map((item, index) => (
                      <li key={`${item.itemIndex}:${index}`}>
                        {item.name}
                        {" · "}
                        Qty {item.quantity}
                        {" · "}
                        {[
                          item.selectedColor,
                          item.selectedSize,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "Standard option"}
                      </li>
                    ))}
                  </ul>

                  <p>
                    Preparation: {days(parcel.preparationDays)}.
                    {" "}
                    Courier transit: {days(parcel.transitDays)}.
                    {" "}
                    Total estimate: {days(parcel.estimatedDays)}.
                  </p>

                  <p>
                    Delivery charge: {money(parcel.shipping)}.
                    {" "}
                    Balance on delivery:{" "}
                    <strong>
                      {money(parcel.amountDueOnDelivery)}
                    </strong>
                    .
                  </p>
                </article>
              ))}

              <p className="muted">
                Review valid until{" "}
                {new Date(shipping.validUntil).toLocaleString("en-IN")}
                . Stock is checked again on payment confirmation.
              </p>
            </>
          ) : (
            <>
              <p>
                Payment is unavailable until package contents
                and delivery charges are confirmed.
              </p>

              <ul>
                {(
                  shipping?.issues ||
                  quote.fulfillment?.issues ||
                  []
                ).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="muted">
        Packed-together delivery requires a configured packing
        arrangement. Separate packages have their own contents,
        estimates and COD balances. Eligible component refunds
        use their allocated paid amount.
      </p>

      <p>
        <Link to="/help">
          Cancellation, return and refund information
        </Link>
      </p>

      <button
        className="button secondary"
        type="button"
        disabled={disabled || loading}
        onClick={onRefresh}
      >
        Refresh prices & delivery
      </button>
    </section>
  );
}