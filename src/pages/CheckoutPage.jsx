import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CheckoutPaymentPage from "./CheckoutPaymentPage.jsx";

import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";

import { selectedBag } from "../utils/commerce.js";

import {
  getCartItemKey,
  getKitGroup,
  groupCartItems,
} from "../utils/cartUtils.js";

import { readSession } from "../utils/shopperStorage.js";
import { money } from "../utils/productPricing.js";

import {
  getCheckoutQuote,
} from "../services/checkoutQuoteApi.js";

export default function CheckoutPage() {
  const auth = useAuth();
  const store = useStore();
  const tools = useShoppingTools();

  const [params] = useSearchParams();
  const requested = params.get("mode");

  const mode = ["buy-now", "selection"].includes(requested)
    ? requested
    : "cart";

  const items =
    mode === "buy-now"
      ? store.buyNowItem
        ? [store.buyNowItem]
        : []
      : mode === "selection"
        ? selectedBag(store.cart, tools.checkoutKeys)
        : store.cart;

  const hasKits = items.some(
    (item) =>
      item &&
      Object.prototype.hasOwnProperty.call(
        item,
        "kitGroup",
      ),
  );

  const pending =
    readSession(
      store.shoppingKey("gymdrobe-active-checkout-v2"),
      null,
    ) ||
    readSession(
      store.shoppingKey(
        `gymdrobe-payment-confirmation-${mode}`,
      ),
      null,
    );

  if (auth.loading || pending || !hasKits) {
    return <CheckoutPaymentPage />;
  }

  const selectedKeys = new Set(
    items.map(getCartItemKey),
  );

  const partialKit =
    mode === "buy-now" ||
    groupCartItems(store.cart).some(
      (group) =>
        group.type === "kit" &&
        group.items.some(
          (item) => selectedKeys.has(getCartItemKey(item)),
        ) &&
        group.items.some(
          (item) => !selectedKeys.has(getCartItemKey(item)),
        ),
    );

  return (
    <KitCheckoutPreview
      key={`${store.shoppingKey("gymdrobe-cart")}:${mode}:${
        auth.token || ""
      }`}
      auth={auth}
      items={items}
      partialKit={partialKit}
      mode={mode}
      initialCoupon={store.coupon?.code || ""}
    />
  );
}

function KitCheckoutPreview({
  auth,
  items,
  partialKit,
  mode,
  initialCoupon,
}) {
  const [coupon, setCoupon] = useState(initialCoupon);
  const [pincode, setPincode] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const signature = JSON.stringify({
    items: items.map((item) => [
      item.id,
      item.quantity,
      item.selectedSize ?? null,
      item.selectedColor ?? null,
      getKitGroup(item),
    ]),
    coupon,
    deliveryMethod,
    paymentMethod,
    pincode,
  });

  useEffect(() => {
    const abort = new AbortController();

    setResult(null);
    setFailure(null);
    setLoading(false);

    if (!auth.token || !auth.user || partialKit || (pincode && !/^[1-9]\d{5}$/.test(pincode))) {
      return () => abort.abort();
    }

    setLoading(true);

    const timer = setTimeout(() => {
      getCheckoutQuote(
        auth.token,
        {
          items,
          coupon,
          deliveryMethod,
          paymentMethod,
          pincode,
        },
        { signal: abort.signal },
      )
        .then((quote) => {
          if (!abort.signal.aborted) {
            setResult({ signature, quote });
          }
        })
        .catch((error) => {
          if (!abort.signal.aborted) {
            setFailure({
              signature,
              message: error.message,
              status: error.status,
              code: error.code,
            });
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) {
            setLoading(false);
          }
        });
    }, 500);

    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [
    signature,
    revision,
    auth.token,
    auth.user,
    partialKit,
  ]);

  const quote =
    result?.signature === signature ? result.quote : null;

  const error =
    failure?.signature === signature ? failure : null;

  const loginPath =
    `/login?next=${encodeURIComponent(
      `/checkout?mode=${mode}`,
    )}`;

  const pricingRows = quote
    ? [
        ["Item subtotal", quote.pricing.subtotal],
        ["Kit savings", -quote.pricing.kitDiscount],
        ["Coupon savings", -quote.pricing.couponDiscount],
        [quote.shippingIsEstimate ? "Shipping estimate" : "Confirmed shipping", quote.pricing.shipping],
        [quote.shippingIsEstimate ? "Estimated order total" : "Reviewed order total", quote.pricing.finalTotal],
        ["Payable now estimate", quote.payment.amountToPayNow],
        [
          paymentMethod === "cod-partial"
            ? "Balance due on delivery"
            : "Remaining balance",
          quote.payment.amountDue,
        ],
      ]
    : [];

  return (
    <div className="page narrow kit-checkout-preview">
      <div className="page-heading">
        <h1>Review kit pricing</h1>
        <Link to="/cart">← Return to bag</Link>
      </div>

      <p className="notice">
        This is a pricing preview. Kit payment is not enabled
        yet. No order is placed and no stock is reserved.
      </p>

      {partialKit ? (
        <section className="panel">
          <h2>Select the complete kit</h2>
          <p>
            Kit components cannot be checked out individually.
            Return to your bag and review the whole kit.
          </p>
          <Link className="button" to="/cart">
            Review bag
          </Link>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Review your kit and delivery</h2>
            <label htmlFor="kit-delivery-pincode">
              Delivery pincode
              <input id="kit-delivery-pincode" inputMode="numeric" maxLength={6}
                value={pincode} placeholder="Enter six-digit pincode"
                onChange={event => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </label>
            {pincode && !/^[1-9]\d{5}$/.test(pincode) && <p className="field-error">Enter a valid six-digit pincode.</p>}

            <label>
              Coupon code
              <input
                value={coupon}
                maxLength={50}
                placeholder="Optional"
                onChange={(event) =>
                  setCoupon(event.target.value.toUpperCase())
                }
              />
            </label>

            <label>
              Delivery
              <select
                value={deliveryMethod}
                onChange={(event) =>
                  setDeliveryMethod(event.target.value)
                }
              >
                <option value="standard">Standard</option>
                <option value="express">Express</option>
              </select>
            </label>

            <label>
              Payment
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value)
                }
              >
                <option value="razorpay">Online payment</option>
                <option value="cod-partial">
                  COD with 10% advance
                </option>
              </select>
            </label>

            <p className="muted">
              These choices update this preview only.
              Final delivery coverage, preparation time,
              package contents and shipping charges must
              be confirmed before payment.
            </p>
          </section>

          {!auth.user || !auth.token ? (
            <section className="panel">
              <p>
                Sign in to check the complete bag against
                current server prices and stock.
              </p>
              <Link className="button" to={loginPath}>
                Continue with Google
              </Link>
            </section>
          ) : (
            <>
              {loading && (
                <p role="status">
                  Checking current prices, kit discounts
                  and stock…
                </p>
              )}

              {error && (
                <section className="panel">
                  <p className="field-error" role="alert">
                    {error.message}
                  </p>

                  {error.status === 401 ? (
                    <Link className="button" to={loginPath}>
                      Sign in again
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setRevision((value) => value + 1)
                      }
                    >
                      Retry pricing check
                    </button>
                  )}

                  {error.code === "KIT_VERSION_CHANGED" && (
                    <p>
                      Return to the bag, open Edit kit and
                      reload its latest template before saving.
                    </p>
                  )}
                </section>
              )}

              {quote && (
                <>
                  <FulfillmentReadiness value={quote.fulfillment} />
                  <ShippingReview value={quote.shippingReview} />

                  {quote.kitSnapshots.map((kit) => (
                    <section className="panel" key={kit.groupId}>
                      <h2>{kit.name}</h2>

                      <p className="muted">
                        {kit.level} ·{" "}
                        {kit.fulfillmentMode === "packed-together"
                          ? "Configured for packing together"
                          : "Configured for separate shipments"}
                      </p>

                      <p>{kit.customerNote}</p>

                      <ComponentTable
                        items={quote.items.filter(
                          (item) =>
                            item.kit?.groupId === kit.groupId,
                        )}
                      />

                      <p>
                        Kit item amount after allocated discounts:{" "}
                        <strong>
                          {money(kit.linePaidPaise / 100)}
                        </strong>
                      </p>
                    </section>
                  ))}

                  {quote.items.some((item) => !item.kit) && (
                    <section className="panel">
                      <h2>Individual products</h2>
                      <ComponentTable
                        items={quote.items.filter(
                          (item) => !item.kit,
                        )}
                      />
                    </section>
                  )}

                  <section className="panel">
                    <h2>{quote.shippingIsEstimate ? "Server pricing estimate" : "Reviewed prices and shipping"}</h2>

                    <dl className="receipt-totals">
                      {pricingRows.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{money(value)}</dd>
                        </div>
                      ))}
                    </dl>

                    {paymentMethod === "cod-partial" && (
                      <p>
                        The 10% advance is calculated on products
                        after kit and coupon discounts.
                        Delivery charges are included in the
                        remaining balance.
                      </p>
                    )}

                    <p className="notice">
                      {quote.shippingIsEstimate
                        ? "Shipping remains an estimate. Complete the highlighted package and courier checks before payment."
                        : "The package plan and courier charges are confirmed for your selection and pincode. Delivery days are estimates. Payment integration is still pending; no payment has started."}
                    </p>
                  </section>
                </>
              )}

              <button
                type="button"
                className="button secondary"
                disabled={loading}
                onClick={() =>
                  setRevision((value) => value + 1)
                }
              >
                Refresh server estimate
              </button>
            </>
          )}
        </>
      )}

      <p>
        <Link className="text-link" to="/cart">
          Edit or remove kits in your bag
        </Link>
      </p>

      <button type="button" className="button full" disabled>
        Kit payment is not enabled yet
      </button>

      <style>{`
        .kit-checkout-preview .panel {
          padding: 20px;
          margin: 18px 0;
        }

        .kit-checkout-preview label {
          display: grid;
          gap: 6px;
          margin: 14px 0;
        }

        .kit-checkout-preview input,
        .kit-checkout-preview select {
          min-height: 44px;
          width: 100%;
          padding: 10px;
          font: inherit;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          color: #171717;
        }

        .kit-checkout-preview .kit-component-scroll {
          overflow-x: auto;
        }

        .kit-checkout-preview table {
          width: 100%;
          min-width: 500px;
          border-collapse: collapse;
        }

        .kit-checkout-preview th,
        .kit-checkout-preview td {
          text-align: left;
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .kit-checkout-preview td small {
          display: block;
          margin-top: 5px;
        }
      `}</style>
    </div>
  );
}

function ComponentTable({ items }) {
  return (
    <div className="kit-component-scroll">
      <table>
        <caption>
          Component amounts after allocated discounts, in INR
        </caption>

        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Qty</th>
            <th scope="col">Item amount</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => (
            <tr
              key={`${item.product}:${
                item.kit?.groupId || "ordinary"
              }:${item.kit?.slotKey || index}`}
            >
              <td>
                {item.name}
                <small>
                  {[
                    item.selectedColor,
                    item.selectedSize,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "Standard option"}
                </small>
              </td>

              <td>{item.quantity}</td>
              <td>
                {money(
                  item.priceAllocation.linePaidPaise / 100,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function daysRange(value) {
  if (
    !value ||
    !Number.isSafeInteger(value.minimum) ||
    !Number.isSafeInteger(value.maximum) ||
    value.minimum < 0 ||
    value.maximum < value.minimum
  ) {
    return "Not recorded";
  }

  return value.minimum === value.maximum
    ? `${value.minimum} days`
    : `${value.minimum}–${value.maximum} days`;
}

function FulfillmentReadiness({ value }) {
  if (!value || !Array.isArray(value.groups)) {
    return (
      <section className="panel">
        <h2>Preparation and delivery checks</h2>
        <p className="notice">
          Fulfillment checks are not available yet.
          Update the backend before enabling kit payments.
        </p>
      </section>
    );
  }

  const shown = new Set(
    value.groups.flatMap(
      (group) => group.issues || [],
    ),
  );

  return (
    <section className="panel">
      <h2>Preparation and delivery checks</h2>

      <p>
        {value.configurationReady
          ? value.finalShippingConfirmed
            ? "Recorded arrangements, package contents and shipping charges are confirmed for this selection."
            : "The recorded fulfillment arrangements are complete. Delivery coverage and final shipping still need confirmation."
          : "Some fulfillment arrangements need setup before this kit can be purchased."}
      </p>

      {value.groups.map((group, index) => (
        <article
          key={group.groupId || `item-${index}`}
          style={{
            margin: "20px 0",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "14px",
          }}
        >
          <h3>{group.name}</h3>

          <p className="muted">
            {group.configurationReady
              ? "Recorded configuration complete"
              : "Setup needs review"}
          </p>

          <p>{group.packagePlan}</p>

          {group.estimates && (
            <dl className="receipt-totals">
              <div>
                <dt>Collecting and packing estimate</dt>
                <dd>
                  {daysRange(
                    group.estimates.preparationDays,
                  )}
                </dd>
              </div>

              <div>
                <dt>Courier transit estimate</dt>
                <dd>
                  {daysRange(
                    group.estimates.transitDays,
                  )}
                </dd>
              </div>

              <div>
                <dt>Recorded total estimate</dt>
                <dd>
                  {daysRange(
                    group.estimates.totalDays,
                  )}
                </dd>
              </div>
            </dl>
          )}

          {group.mode === "separate-shipments" &&
            (group.components || []).map(
              (component, position) => (
                <p
                  key={`${component.productId}:${position}`}
                >
                  <strong>{component.name}:</strong>{" "}
                  preparation{" "}
                  {daysRange(component.preparationDays)};
                  courier transit{" "}
                  {daysRange(component.transitDays)}.
                  {component.configurationReady &&
                  component.estimatedDays
                    ? ` Recorded total estimate: ${daysRange(
                        component.estimatedDays,
                      )}.`
                    : ""}
                </p>
              ),
            )}

          {group.issues?.length > 0 && (
            <ul className="field-error">
              {group.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </article>
      ))}

      <ul>
        {(value.issues || [])
          .filter((issue) => !shown.has(issue))
          .map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
      </ul>

      <p className="notice">
        Preparation and delivery days are estimates. Check the package breakdown and shipping review below. Software does not physically combine parcels.
      </p>
    </section>
  );
}

function ShippingReview({ value }) {
  if (!value) return null;
  return <section className="panel">
    <h2>Packages and shipping</h2>
    {value.ready ? <>
      <p>{value.packageCount} {value.packageCount === 1 ? "package" : "packages"}. Review the contents and delivery estimates for each package.</p>
      {value.shipments.map(shipment => <article key={shipment.key}>
        <h3>{shipment.label}</h3>
        <p>{shipment.carrier} · {shipment.service}</p>
        <ul>{shipment.contents.map((item, index) => <li key={`${item.itemIndex}-${index}`}>
          {item.name} · Qty {item.quantity}{item.selectedSize ? ` · ${item.selectedSize}` : ""}{item.selectedColor ? ` · ${item.selectedColor}` : ""}
        </li>)}</ul>
        <p>Preparation: {daysRange(shipment.preparationDays)}. Courier transit: {daysRange(shipment.transitDays)}. Total estimate: {daysRange(shipment.estimatedDays)}.</p>
        <p>Shipping: {money(shipment.shipping)}. Balance on delivery: {money(shipment.amountDueOnDelivery)}.</p>
      </article>)}
      <p className="muted">Shipping review expires: {new Date(value.validUntil).toLocaleString("en-IN")}.</p>
    </> : <><p>The package plan or courier charges need confirmation.</p><ul>{value.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></>}
  </section>;
}
