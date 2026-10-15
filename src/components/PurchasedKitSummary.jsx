import { money } from "../utils/productPricing.js";

const paise = (value) =>
  Number.isSafeInteger(value) && value >= 0
    ? money(value / 100)
    : "Not recorded";

const options = (item) =>
  [item.selectedColor, item.selectedSize]
    .filter(Boolean)
    .join(" / ") || "Default variant";

export default function PurchasedKitSummary({ order }) {
  const kits = Array.isArray(order?.kitSnapshots)
    ? order.kitSnapshots
    : [];

  const shipping = order?.shippingSnapshot;

  if (!kits.length && !shipping) {
    return null;
  }

  return (
    <section
      className="panel"
      aria-label="Purchased Fitness Kits and delivery terms"
    >
      <h2>Your Fitness Kits</h2>

      <p className="muted">
        These selections and discounts were recorded with this order.
        Eligible item refunds use each component’s allocated total.
        Amounts here describe merchandise costs; payment details show
        what has been collected.
      </p>

      {kits.map((kit) => (
        <article
          key={kit.groupId}
          style={{ marginBlock: "20px" }}
        >
          <h3>{kit.name}</h3>

          {kit.customerNote && (
            <p>{kit.customerNote}</p>
          )}

          <p>
            Kit savings:{" "}
            <strong>
              {paise(kit.kitDiscountPaise)}
            </strong>
            {" · "}
            Coupon savings:{" "}
            <strong>
              {paise(kit.couponDiscountPaise)}
            </strong>
            {" · "}
            Allocated kit total:{" "}
            <strong>
              {paise(kit.linePaidPaise)}
            </strong>
          </p>

          <div
            className="comparison-scroll"
            style={{ overflowX: "auto" }}
          >
            <table
              className="data-table"
              style={{
                minWidth: "600px",
                width: "100%",
              }}
            >
              <caption>
                Recorded components of {kit.name}, in INR
              </caption>

              <thead>
                <tr>
                  <th scope="col">
                    Item and options
                  </th>

                  <th scope="col">
                    Qty
                  </th>

                  <th scope="col">
                    Before order savings
                  </th>

                  <th scope="col">
                    Kit savings
                  </th>

                  <th scope="col">
                    Coupon savings
                  </th>

                  <th scope="col">
                    Allocated item total
                  </th>
                </tr>
              </thead>

              <tbody>
                {(order.items || [])
                  .filter(
                    (item) =>
                      item.kit?.groupId === kit.groupId,
                  )
                  .map((item, index) => (
                    <tr
                      key={`${item.kit.slotKey}-${index}`}
                    >
                      <th scope="row">
                        {item.name}

                        <small
                          style={{ display: "block" }}
                        >
                          {options(item)}
                        </small>
                      </th>

                      <td>{item.quantity}</td>

                      <td>
                        {paise(
                          item.priceAllocation?.lineSubtotalPaise,
                        )}
                      </td>

                      <td>
                        {paise(
                          item.priceAllocation?.kitDiscountPaise,
                        )}
                      </td>

                      <td>
                        {paise(
                          item.priceAllocation?.couponDiscountPaise,
                        )}
                      </td>

                      <td>
                        <strong>
                          {paise(
                            item.priceAllocation?.linePaidPaise,
                          )}
                        </strong>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}

      {shipping && (
        <details style={{ marginBlock: "20px" }}>
          <summary
            style={{
              minHeight: "44px",
              cursor: "pointer",
              alignContent: "center",
            }}
          >
            Delivery terms recorded at checkout
            {" · "}
            {shipping.packageCount} package(s)
          </summary>

          <p className="muted">
            Package contents, charges and estimates are recorded here.
            Check order tracking for current delivery progress.
          </p>

          {(shipping.shipments || []).map((parcel) => (
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
                {(parcel.contents || []).map((row) => (
                  <li key={row.itemIndex}>
                    {row.name}
                    {" · "}
                    {options(row)}
                    {" · "}
                    Qty {row.quantity}
                  </li>
                ))}
              </ul>

              <p>
                Recorded delivery charge:{" "}
                <strong>
                  {paise(parcel.shippingPaise)}
                </strong>
              </p>

              {shipping.paymentMethod === "cod-partial" && (
                <p>
                  Original balance assigned to this package:{" "}
                  <strong>
                    {paise(parcel.amountDuePaise)}
                  </strong>
                  . See payment details for the current remaining
                  balance.
                </p>
              )}

              {parcel.estimatedDays && (
                <p>
                  Estimated preparation and delivery:{" "}
                  {parcel.estimatedDays.minimum}
                  –
                  {parcel.estimatedDays.maximum} days.
                </p>
              )}
            </article>
          ))}
        </details>
      )}
    </section>
  );
}