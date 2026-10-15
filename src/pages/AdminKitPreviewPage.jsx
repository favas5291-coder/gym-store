import {
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext.jsx";

import {
  getAdminKits,
} from "../services/adminKitApi.js";

import {
  previewKitQuote,
} from "../services/kitQuoteApi.js";

import {
  money,
} from "../utils/productPricing.js";

const identity = (value) =>
  String(
    value?.id || value?._id || "",
  );

export default function AdminKitPreviewPage() {
  const {
    user,
    token,
    authError,
  } = useAuth();

  if (
    !user ||
    user.role !== "admin" ||
    user.isActive === false ||
    authError ||
    !token
  ) {
    return (
      <div className="page">
        <p role="alert">
          An active admin session is required.
        </p>
      </div>
    );
  }

  return (
    <Preview
      key={`${identity(user)}:${token}`}
      token={token}
    />
  );
}

function Preview({ token }) {
  const [kits, setKits] =
    useState([]);

  const [selected, setSelected] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [denied, setDenied] =
    useState(false);

  const [
    reloadRequired,
    setReloadRequired,
  ] = useState(false);

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

  const [revision, setRevision] =
    useState(0);

  const [result, setResult] =
    useState(null);

  const mounted = useRef(false);
  const pending = useRef(null);
  const lock = useRef(false);

  const kit = kits.find(
    (value) =>
      identity(value) === selected,
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      pending.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller =
      new AbortController();

    pending.current?.abort();

    lock.current = false;

    setBusy(false);
    setLoading(true);
    setResult(null);
    setError("");
    setKits([]);

    getAdminKits(
      token,
      {
        signal: controller.signal,
      },
    )
      .then((rows) => {
        if (controller.signal.aborted) {
          return;
        }

        setKits(rows);
        setReloadRequired(false);

        setSelected((previous) =>
          rows.some(
            (value) =>
              identity(value) === previous &&
              value.status !== "archived",
          )
            ? previous
            : identity(
                rows.find(
                  (value) =>
                    value.status !== "archived",
                ),
              ),
        );
      })
      .catch((failure) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(failure.message);

        if (
          [401, 403].includes(
            failure.status,
          )
        ) {
          setDenied(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, revision]);

  function change(update) {
    setResult(null);
    setError("");
    update();
  }

  async function calculate(event) {
    event.preventDefault();

    if (
      lock.current ||
      loading ||
      !kit ||
      reloadRequired
    ) {
      return;
    }

    lock.current = true;

    setBusy(true);
    setResult(null);
    setError("");

    const controller =
      new AbortController();

    pending.current = controller;

    try {
      const quote = await previewKitQuote(
        token,
        kit,
        {
          coupon,
          deliveryMethod,
          paymentMethod,
          signal: controller.signal,
        },
      );

      if (
        mounted.current &&
        !controller.signal.aborted
      ) {
        setResult({
          quote,

          checkedAt:
            new Date().toLocaleString(
              "en-IN",
            ),
        });
      }
    } catch (failure) {
      if (
        !mounted.current ||
        controller.signal.aborted
      ) {
        return;
      }

      setError(failure.message);

      if (
        failure.code ===
        "KIT_VERSION_CHANGED"
      ) {
        setReloadRequired(true);
      }

      if (
        [401, 403].includes(
          failure.status,
        )
      ) {
        setDenied(true);
        setKits([]);
      }
    } finally {
      if (
        pending.current === controller
      ) {
        lock.current = false;

        if (mounted.current) {
          setBusy(false);
        }
      }
    }
  }

  if (denied) {
    return (
      <div className="page">
        <p role="alert">
          Your admin session is no longer
          authorized. Sign in again.
        </p>

        <Link to="/login?next=%2Fadmin%2Fkits%2Fpreview">
          Sign in
        </Link>
      </div>
    );
  }

  const quote = result?.quote;

  return (
    <div className="page gd-admin-page kit-preview">
      <div className="page-heading">
        <h1>Fitness Kit price preview</h1>

        <Link to="/admin/kits">
          Edit kit templates
        </Link>
      </div>

      <p className="notice">
        Admin preview only. No order or payment
        is created, and no stock is reserved.
        This checks the kit&apos;s saved
        suggested products.
      </p>

      <button
        className="button secondary"
        type="button"
        disabled={busy || loading}
        onClick={() =>
          setRevision(
            (value) => value + 1,
          )
        }
      >
        Reload kit templates
      </button>

      {loading && (
        <p role="status">
          Loading kits…
        </p>
      )}

      {!loading &&
        !kits.length &&
        !error && (
          <p>
            No templates yet.{" "}

            <Link to="/admin/kits">
              Create kit drafts
            </Link>

            {" "}first.
          </p>
        )}

      <form onSubmit={calculate}>
        <fieldset
          disabled={loading || busy}
          style={{
            border: 0,
            padding: 0,
          }}
        >
          <div className="kit-preview-controls">
            <label>
              Kit

              <select
                value={selected}
                onChange={(event) =>
                  change(() =>
                    setSelected(
                      event.target.value,
                    ),
                  )
                }
              >
                <option value="">
                  Choose a kit
                </option>

                {kits.map((value) => (
                  <option
                    key={identity(value)}
                    value={identity(value)}
                    disabled={
                      value.status === "archived"
                    }
                  >
                    {value.name} · {value.status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Coupon code

              <input
                maxLength={50}
                value={coupon}
                placeholder="Optional"
                onChange={(event) =>
                  change(() =>
                    setCoupon(
                      event.target.value
                        .toUpperCase(),
                    ),
                  )
                }
              />
            </label>

            <label>
              Delivery

              <select
                value={deliveryMethod}
                onChange={(event) =>
                  change(() =>
                    setDeliveryMethod(
                      event.target.value,
                    ),
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
              Payment

              <select
                value={paymentMethod}
                onChange={(event) =>
                  change(() =>
                    setPaymentMethod(
                      event.target.value,
                    ),
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
          </div>

          <button
            className="button"
            type="submit"
            disabled={
              !kit || reloadRequired
            }
          >
            {busy
              ? "Calculating…"
              : "Calculate saved kit"}
          </button>
        </fieldset>
      </form>

      {kit && (
        <p>
          Fulfillment setup:{" "}
          {kit.fulfillment?.mode ||
            "unconfigured"}.

          {" "}This price preview does not
          verify supplier agreements, pincode
          coverage or packing readiness.
        </p>
      )}

      {error && (
        <p
          className="error-box"
          role="alert"
        >
          {error}
        </p>
      )}

      {reloadRequired && (
        <p>
          Reload the kit templates before
          requesting another preview.
        </p>
      )}

      {quote && (
        <section
          className="panel"
          aria-label="Kit price preview"
        >
          <h2>{quote.name}</h2>

          <p>
            Calculated: {result.checkedAt}.
            Stock and prices can change after
            this preview.
          </p>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table className="data-table">
              <caption>
                Prices calculated by the backend
                in INR
              </caption>

              <thead>
                <tr>
                  <th scope="col">
                    Item / variant
                  </th>

                  <th scope="col">
                    Qty
                  </th>

                  <th scope="col">
                    Unit price
                  </th>

                  <th scope="col">
                    Item subtotal
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
                {quote.items.map((item) => (
                  <tr key={item.slotKey}>
                    <td>
                      {item.name}

                      <small
                        style={{
                          display: "block",
                        }}
                      >
                        {[
                          item.brand,
                          item.sku,
                          item.selectedSize,
                          item.selectedColor,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </td>

                    <td>
                      {item.quantity}
                    </td>

                    <td>
                      {money(item.unitPrice)}
                    </td>

                    <td>
                      {money(item.lineSubtotal)}
                    </td>

                    <td>
                      {money(item.kitDiscount)}
                    </td>

                    <td>
                      {money(item.couponDiscount)}
                    </td>

                    <td>
                      {money(item.linePaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="receipt-totals">
            {[
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
                "Items after discounts",
                quote.pricing.totalAfterCoupon,
              ],
              [
                "Shipping estimate",
                quote.pricing.shipping,
              ],
              [
                "Estimated order total",
                quote.pricing.finalTotal,
              ],
              [
                "Payable now",
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
            ))}
          </dl>

          {quote.payment.method ===
            "cod-partial" && (
              <p>
                The advance is 10% of items after
                discounts. Shipping is included
                in the remaining delivery balance.
              </p>
            )}

          {quote.discountEligibility
            ?.reasons?.length > 0 && (
            <div>
              <h3>
                Why the kit discount does not apply
              </h3>

              <ul>
                {quote.discountEligibility
                  .reasons.map((reason) => (
                    <li key={reason}>
                      {reason}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {quote.skippedCategories?.length >
            0 && (
              <p>
                Categories not included:{" "}
                {quote.skippedCategories.join(", ")}.
                Supplements remain optional.
              </p>
            )}

          <p className="notice">
            {quote.notice}
          </p>

          <p>
            Item totals include their allocated
            discounts. Refund eligibility,
            returned quantities and shipping
            refunds still require the order and
            return rules; this preview does not
            authorize a refund.
          </p>
        </section>
      )}

      <style>{`
        .kit-preview-controls {
          display: grid;
          grid-template-columns:
            repeat(
              auto-fit,
              minmax(min(100%, 220px), 1fr)
            );
          gap: 16px;
          margin: 20px 0;
        }

        .kit-preview-controls label {
          display: grid;
          gap: 6px;
        }

        .kit-preview-controls input,
        .kit-preview-controls select {
          width: 100%;
          min-height: 44px;
          padding: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
        }

        .kit-preview .panel {
          margin: 24px 0;
          padding: 20px;
        }

        .kit-preview table {
          min-width: 850px;
          width: 100%;
        }
      `}</style>
    </div>
  );
}