import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getAdminOrderById,
  updateAdminKitFulfillment,
} from "../services/adminOrderApi.js";

import { money } from "../utils/productPricing.js";

import "./KitFulfillment.css";

const STAGES = [
  "collecting",
  "packed",
  "shipped",
  "out-for-delivery",
  "delivered",
];

const LABELS = {
  collecting: "Collecting items",
  packed: "Packed and checked",
  shipped: "Shipped",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
};

const dateInput = (value) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString().slice(0, 10)
    : "";

const progressDraft = (progress) => ({
  components: Object.fromEntries(
    (progress?.components || []).map((row) => [
      row.itemIndex,
      { ...row },
    ]),
  ),

  parcels: Object.fromEntries(
    (progress?.parcels || []).map((row) => [
      row.key,

      {
        ...row,
        estimatedDelivery: dateInput(row.estimatedDelivery),
        packingChecked: false,
        collectionConfirmed: false,
      },
    ]),
  ),
});

function Field({ label, children }) {
  return (
    <label className="gd-kit-progress-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AdminKitFulfillment({
  order,
  token,
  onUpdated,
  onBusyChange,
}) {
  const progress = order.kitFulfillmentAdmin;

  const [draft, setDraft] = useState(
    () => progressDraft(progress),
  );

  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const lock = useRef(false);
  const mounted = useRef(true);
  const abortRef = useRef(null);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setDraft(progressDraft(progress));
  }, [progress]);

  useEffect(() => {
    const warn = (event) => {
      if (
        lock.current ||
        JSON.stringify(draft) !==
          JSON.stringify(progressDraft(progress))
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [draft, progress]);

  const orderId = order.orderNumber || order.id;

  const frozen =
    busy ||
    blocked ||
    order.status === "cancelled" ||
    order.status === "payment-pending" ||
    !["paid", "partially-paid"].includes(
      order.payment?.status,
    );

  async function run(changes) {
    if (
      lock.current ||
      (blocked && changes !== "reload")
    ) {
      return;
    }

    lock.current = true;

    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setNotice("");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const updated =
        changes === "reload"
          ? await getAdminOrderById(
              token,
              orderId,
              { signal: abort.signal },
            )
          : await updateAdminKitFulfillment(
              token,
              orderId,

              {
                revision: progress?.revision ?? 0,
                ...changes,
              },

              { signal: abort.signal },
            );

      if (!mounted.current) {
        return;
      }

      setDraft(
        progressDraft(updated.kitFulfillmentAdmin),
      );

      setBlocked(false);

      setNotice(
        changes === "reload"
          ? "Latest saved kit progress loaded."
          : "Kit progress saved.",
      );

      onUpdated(updated);
    } catch (failure) {
      if (!mounted.current) {
        return;
      }

      setError(failure.message);

      if (
        failure.saveResultUnknown ||
        failure.status === 409 ||
        [401, 403].includes(failure.status)
      ) {
        setBlocked(true);
      }
    } finally {
      lock.current = false;
      onBusyChange?.(false);

      if (mounted.current) {
        setBusy(false);
      }
    }
  }

  function changeComponent(index, change) {
    setDraft((value) => ({
      ...value,

      components: {
        ...value.components,

        [index]: {
          ...value.components[index],
          ...change,
        },
      },
    }));
  }

  function changeParcel(key, change) {
    setDraft((value) => ({
      ...value,

      parcels: {
        ...value.parcels,

        [key]: {
          ...value.parcels[key],
          ...change,
        },
      },
    }));
  }

  return (
    <section
      className="panel gd-kit-progress"
      aria-label="Admin kit procurement and parcel controls"
    >
      <h3>Kit procurement and parcels</h3>

      <p>
        Record actual receipts and dispatches. Parcel controls
        do not buy from suppliers or collect money automatically.
      </p>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {notice && (
        <p role="status">{notice}</p>
      )}

      {blocked && (
        <p className="notice">
          Reload the saved order before another update.
          The previous save may already have reached the server.
        </p>
      )}

      <button
        type="button"
        className="button secondary compact"
        disabled={busy}
        onClick={() => run("reload")}
      >
        Reload kit progress
      </button>

      {!order.shippingSnapshot ? (
        <p className="notice">
          Purchased parcel details are missing.
          Reconcile this order before dispatch.
        </p>
      ) : progress === undefined ? (
        <p className="notice">
          Update the backend and reload the order
          to enable these controls.
        </p>
      ) : !progress ? (
        <button
          type="button"
          className="button"
          disabled={frozen}
          onClick={() =>
            run({ action: "initialize" })
          }
        >
          Initialize recorded kit fulfillment
        </button>
      ) : (
        <>
          <p className="muted">
            Saved revision: {progress.revision}.
            Save each component or parcel separately.
            The server validates received quantities
            and payment records.
          </p>

          <fieldset disabled={frozen}>
            <legend>Component procurement</legend>

            {progress.components.map((component) => {
              const item = order.items[component.itemIndex];

              const row =
                draft.components[component.itemIndex];

              if (!item || !row) {
                return (
                  <p
                    key={component.itemIndex}
                    role="alert"
                  >
                    A purchased component needs review.
                  </p>
                );
              }

              return (
                <form
                  key={component.itemIndex}
                  className="gd-kit-progress-card"
                  onSubmit={(event) => {
                    event.preventDefault();

                    run({
                      action: "component",
                      itemIndex: component.itemIndex,

                      receivedQuantity: Number(
                        row.receivedQuantity,
                      ),

                      procurementStatus: row.procurementStatus,
                      supplierReference: row.supplierReference,
                      notes: row.notes,
                    });
                  }}
                >
                  <h4>{item.name}</h4>

                  <p>
                    {[
                      item.selectedColor,
                      item.selectedSize,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "Default variant"}
                    {" · "}
                    Purchased quantity: {item.quantity}
                    {" · "}
                    SKU: {item.sku || "Not recorded"}
                  </p>

                  <div className="gd-kit-progress-grid">
                    <Field label="Procurement before receipt">
                      <select
                        value={
                          ["awaiting", "ordered"].includes(
                            row.procurementStatus,
                          )
                            ? row.procurementStatus
                            : "ordered"
                        }
                        onChange={(event) =>
                          changeComponent(
                            component.itemIndex,

                            {
                              procurementStatus:
                                event.target.value,
                            },
                          )
                        }
                      >
                        <option value="awaiting">
                          Awaiting procurement
                        </option>

                        <option value="ordered">
                          Ordered / arranged
                        </option>
                      </select>
                    </Field>

                    <Field label="Units actually received">
                      <input
                        type="number"
                        required
                        min={0}
                        max={item.quantity}
                        step={1}
                        value={row.receivedQuantity}
                        onChange={(event) =>
                          changeComponent(
                            component.itemIndex,

                            {
                              receivedQuantity:
                                event.target.value,
                            },
                          )
                        }
                      />
                    </Field>

                    <Field label="Internal supplier purchase reference">
                      <input
                        maxLength={200}
                        value={row.supplierReference}
                        onChange={(event) =>
                          changeComponent(
                            component.itemIndex,

                            {
                              supplierReference:
                                event.target.value,
                            },
                          )
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Internal procurement notes">
                    <input
                      maxLength={500}
                      value={row.notes}
                      onChange={(event) =>
                        changeComponent(
                          component.itemIndex,

                          {
                            notes: event.target.value,
                          },
                        )
                      }
                    />
                  </Field>

                  <p className="muted">
                    Recorded: {component.receivedQuantity} received
                    {" · "}
                    {component.procurementStatus.replaceAll("-", " ")}.
                    Receipt status is calculated from the quantity.
                  </p>

                  <button
                    type="submit"
                    className="button secondary compact"
                  >
                    Save component receipt
                  </button>
                </form>
              );
            })}
          </fieldset>

          <fieldset disabled={frozen}>
            <legend>Parcel dispatch and delivery</legend>

            {progress.parcels.map((parcel) => {
              const snapshot =
                order.shippingSnapshot.shipments.find(
                  (row) => row.key === parcel.key,
                );

              const row = draft.parcels[parcel.key];

              if (!snapshot || !row) {
                return (
                  <p key={parcel.key} role="alert">
                    A purchased parcel needs review.
                  </p>
                );
              }

              const index = STAGES.indexOf(parcel.status);
              const next = STAGES[index + 1];

              const balance =
                snapshot.amountDuePaise -
                parcel.codCollectedPaise;

              return (
                <article
                  className="gd-kit-progress-card"
                  key={parcel.key}
                >
                  <h4>
                    {snapshot.label}
                    {" · "}
                    {LABELS[parcel.status]}
                  </h4>

                  <ul>
                    {snapshot.contents.map((content) => (
                      <li key={content.itemIndex}>
                        {content.name}
                        {" · "}
                        {[
                          content.selectedColor,
                          content.selectedSize,
                        ]
                          .filter(Boolean)
                          .join(" / ") || "Default variant"}
                        {" · "}
                        Qty {content.quantity}
                      </li>
                    ))}
                  </ul>

                  <div className="gd-kit-progress-grid">
                    <Field label="Actual courier">
                      <input
                        maxLength={100}
                        value={row.carrier}
                        onChange={(event) =>
                          changeParcel(parcel.key, {
                            carrier: event.target.value,
                          })
                        }
                      />
                    </Field>

                    <Field label="Tracking number">
                      <input
                        maxLength={150}
                        value={row.trackingNumber}
                        onChange={(event) =>
                          changeParcel(parcel.key, {
                            trackingNumber:
                              event.target.value,
                          })
                        }
                      />
                    </Field>

                    <Field label="Estimated delivery">
                      <input
                        type="date"
                        value={row.estimatedDelivery}
                        onChange={(event) =>
                          changeParcel(parcel.key, {
                            estimatedDelivery:
                              event.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>

                  {parcel.status === "collecting" && (
                    <label className="gd-kit-progress-check">
                      <input
                        type="checkbox"
                        checked={row.packingChecked}
                        onChange={(event) =>
                          changeParcel(parcel.key, {
                            packingChecked:
                              event.target.checked,
                          })
                        }
                      />

                      Required contents are received,
                      checked and physically packed.
                    </label>
                  )}

                  <div className="purchase-actions">
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={() =>
                        run({
                          action: "parcel",
                          key: parcel.key,
                          status: parcel.status,
                          carrier: row.carrier,
                          trackingNumber: row.trackingNumber,
                          estimatedDelivery:
                            row.estimatedDelivery,
                        })
                      }
                    >
                      Save parcel tracking
                    </button>

                    {next && (
                      <button
                        type="button"
                        className="button compact"
                        disabled={
                          (
                            next === "packed" &&
                            !row.packingChecked
                          ) ||
                          (
                            next === "delivered" &&
                            balance > 0
                          )
                        }
                        onClick={() =>
                          run({
                            action: "parcel",
                            key: parcel.key,
                            status: next,
                            carrier: row.carrier,
                            trackingNumber:
                              row.trackingNumber,
                            estimatedDelivery:
                              row.estimatedDelivery,
                            packingChecked:
                              row.packingChecked,
                          })
                        }
                      >
                        Mark {LABELS[next].toLowerCase()}
                      </button>
                    )}
                  </div>

                  {order.shippingSnapshot.paymentMethod ===
                    "cod-partial" && (
                    <>
                      <p>
                        Assigned COD balance:{" "}
                        {money(snapshot.amountDuePaise / 100)}
                        {" · "}
                        Recorded collected:{" "}
                        {money(parcel.codCollectedPaise / 100)}
                        {" · "}
                        Remaining for this package:{" "}
                        <strong>
                          {money(balance / 100)}
                        </strong>
                      </p>

                      {balance > 0 &&
                        parcel.status === "out-for-delivery" && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();

                              run({
                                action: "cod",
                                key: parcel.key,
                                collectionReference:
                                  row.collectionReference,
                                collectionConfirmed:
                                  row.collectionConfirmed,
                              });
                            }}
                          >
                            <Field label="Actual collection receipt / reference">
                              <input
                                required
                                maxLength={200}
                                value={row.collectionReference}
                                onChange={(event) =>
                                  changeParcel(parcel.key, {
                                    collectionReference:
                                      event.target.value,
                                  })
                                }
                              />
                            </Field>

                            <label className="gd-kit-progress-check">
                              <input
                                type="checkbox"
                                checked={row.collectionConfirmed}
                                onChange={(event) =>
                                  changeParcel(parcel.key, {
                                    collectionConfirmed:
                                      event.target.checked,
                                  })
                                }
                              />

                              I confirm {money(balance / 100)} was
                              actually collected for this package.
                            </label>

                            <button
                              type="submit"
                              className="button secondary compact"
                              disabled={
                                !row.collectionConfirmed ||
                                !row.collectionReference.trim()
                              }
                            >
                              Record this package’s COD collection
                            </button>
                          </form>
                        )}
                    </>
                  )}
                </article>
              );
            })}
          </fieldset>

          <p className="notice">
            The complete order becomes delivered only after every
            parcel is delivered. Record COD collection once for
            each package before confirming its delivery.
          </p>
        </>
      )}
    </section>
  );
}