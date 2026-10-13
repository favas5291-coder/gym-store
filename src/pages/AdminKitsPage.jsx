import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";

import {
  getAdminKits,
  createKitDrafts,
  saveKitDraft,
} from "../services/adminKitApi.js";

import {
  getPackingLocations,
} from "../services/packingLocationApi.js";

import {
  ProductImage,
} from "../components/StorefrontShared.jsx";

import {
  getDiscountedPrice,
  money,
} from "../utils/productPricing.js";

import { getVariantStock } from "../utils/cartUtils.js";

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

const identity = (value) =>
  String(value?.id || value?._id || "");

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: 6,
        margin: "12px 0",
      }}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AdminKitsPage() {
  const { user, token, authError } = useAuth();

  const allowed =
    user?.role === "admin" &&
    user?.isActive !== false &&
    !authError &&
    Boolean(token);

  return allowed ? (
    <KitManager
      key={`${identity(user)}:${token}`}
      token={token}
    />
  ) : (
    <div className="page">
      <p role="alert">
        An active admin session is required.
      </p>
    </div>
  );
}

function KitManager({ token }) {
  const {
    products,
    loading: catalogLoading,
    error: catalogError,
  } = useCatalog();

  const [kits, setKits] = useState([]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mustReload, setMustReload] = useState(false);

  const [locationData, setLocationData] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [locationPage, setLocationPage] = useState(1);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [locationRevision, setLocationRevision] = useState(0);

  const lock = useRef(false);
  const controller = useRef(null);
  const mounted = useRef(false);

  const catalog = Array.isArray(products)
    ? products
    : [];

  useEffect(() => {
    mounted.current = true;
    run("load");

    return () => {
      mounted.current = false;
      controller.current?.abort();
      lock.current = false;
    };
  }, [token]);

  useEffect(() => {
    const abort = new AbortController();

    setLocationData(null);
    setLocationError("");

    getPackingLocations(token, {
      page: locationPage,
      search: locationQuery,
      signal: abort.signal,
    })
      .then((data) => {
        if (!abort.signal.aborted) {
          setLocationData(data);
        }
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setLocationError(failure.message);
        }
      });

    return () => abort.abort();
  }, [
    token,
    locationPage,
    locationQuery,
    locationRevision,
  ]);

  useEffect(() => {
    if (!dirty) return;

    function warn(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);

  async function run(action) {
    if (lock.current) return;

    if (
      action === "load" &&
      dirty &&
      !window.confirm(
        "Discard unsaved kit changes and reload?",
      )
    ) {
      return;
    }

    lock.current = true;

    const abort = new AbortController();
    controller.current = abort;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const options = {
        signal: abort.signal,
      };

      if (action === "save") {
        const saved = await saveKitDraft(
          token,
          draft,
          options,
        );

        if (!mounted.current || abort.signal.aborted) {
          return;
        }

        setKits((previous) =>
          previous.map((row) =>
            identity(row) === identity(saved)
              ? saved
              : row,
          ),
        );

        setDraft(clone(saved));
        setDirty(false);

        setNotice(
          "Draft saved. It is not available for customers to purchase yet.",
        );
      } else {
        const rows = action === "create"
          ? await createKitDrafts(token, options)
          : await getAdminKits(token, options);

        if (!mounted.current || abort.signal.aborted) {
          return;
        }

        setKits(rows);
        setDraft(null);
        setDirty(false);
        setMustReload(false);

        if (action === "create") {
          setNotice(
            "Missing level drafts created. Existing templates were preserved.",
          );
        }
      }
    } catch (failure) {
      if (
        !mounted.current ||
        failure.name === "AbortError"
      ) {
        return;
      }

      setError(failure.message);

      if (
        action !== "load" &&
        failure.status !== 400
      ) {
        setMustReload(true);
      }

      if ([401, 403].includes(failure.status)) {
        setKits([]);
        setDraft(null);
      }
    } finally {
      if (controller.current === abort) {
        lock.current = false;

        if (mounted.current) {
          setBusy(false);
        }
      }
    }
  }

  function select(kit) {
    if (
      dirty &&
      !window.confirm(
        "Discard unsaved changes and open another kit?",
      )
    ) {
      return;
    }

    setDraft(clone(kit));
    setDirty(false);
    setError("");
    setNotice("");
  }

  function edit(change) {
    setDraft((previous) => ({
      ...previous,
      ...change,
    }));

    setDirty(true);
  }

  function updateSlot(index, change) {
    setDraft((previous) => ({
      ...previous,
      slots: previous.slots.map((row, position) =>
        position === index
          ? { ...row, ...change }
          : row,
      ),
    }));

    setDirty(true);
  }

  const readOnly =
    busy ||
    mustReload ||
    draft?.status !== "draft";

  const selectedLocation =
    locationData?.locations.find(
      (location) =>
        location.id ===
        String(draft?.fulfillment?.packingLocation),
    );

  return (
    <div className="page gd-admin-page">
      <div className="page-heading">
        <h1>Fitness Kit templates</h1>
        <Link to="/admin">Admin dashboard</Link>
      </div>

      <p>
        Configure Beginner, Intermediate and Advanced
        kits using real catalogue products.
        Supplements are optional; training level alone
        does not determine supplement needs.
      </p>

      <p className="notice">
        Draft setup only. Configure fulfillment below.
        Customer pricing, purchasing and checkout
        integration are still being built.
      </p>

      <div className="purchase-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => run("load")}
        >
          Reload kits
        </button>

        <button
          type="button"
          className="button"
          disabled={busy || dirty || mustReload}
          onClick={() => run("create")}
        >
          Create missing level drafts
        </button>
      </div>

      {busy && <p role="status">Working…</p>}

      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}

      {notice && <p role="status">{notice}</p>}

      {mustReload && (
        <p className="notice">
          Reload before another save.
          Your previous request may have completed.
        </p>
      )}

      {!busy && !kits.length && !error && (
        <p>
          No templates yet. Create the three level
          drafts to begin.
        </p>
      )}

      <div
        className="purchase-actions"
        style={{ marginBlock: 20 }}
      >
        {kits.map((kit) => (
          <button
            type="button"
            className="button secondary"
            key={identity(kit)}
            disabled={busy || mustReload}
            aria-pressed={
              identity(draft) === identity(kit)
            }
            onClick={() => select(kit)}
          >
            {kit.name} · {kit.status}
          </button>
        ))}
      </div>

      {draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault();

            if (!readOnly && dirty) {
              run("save");
            }
          }}
        >
          <h2>{draft.level} kit</h2>

          {draft.status !== "draft" && (
            <p>
              This template is read-only here.
              Published or archived records are
              preserved.
            </p>
          )}

          <fieldset
            disabled={readOnly}
            style={{ border: 0, padding: 0 }}
          >
            <Field label="Kit name">
              <input
                required
                minLength={2}
                maxLength={200}
                value={draft.name}
                onChange={(event) =>
                  edit({ name: event.target.value })
                }
              />
            </Field>

            <Field label="Who is this kit for?">
              <textarea
                maxLength={1000}
                value={draft.audience || ""}
                onChange={(event) =>
                  edit({
                    audience: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Why were these products selected?">
              <textarea
                maxLength={2000}
                value={draft.explanation || ""}
                onChange={(event) =>
                  edit({
                    explanation: event.target.value,
                  })
                }
              />
            </Field>

            {catalogLoading && (
              <p role="status">
                Loading product choices…
              </p>
            )}

            {catalogError && (
              <p role="alert">
                Product choices could not be loaded.
                Your saved selections are preserved.
              </p>
            )}

            {draft.slots.map((row, index) => {
              const eligible = catalog.filter(
                (product) =>
                  product.isActive !== false &&
                  product.kitSettings?.eligible === true &&
                  product.kitSettings.roles?.includes(
                    row.role,
                  ),
              );

              const product = catalog.find(
                (value) =>
                  identity(value) ===
                  String(row.defaultProduct),
              );

              const known = eligible.some(
                (value) =>
                  identity(value) ===
                  String(row.defaultProduct),
              );

              const stock = product
                ? getVariantStock(
                    product,
                    row.defaultSize,
                    row.defaultColor,
                  )
                : null;

              return (
                <section
                  className="panel"
                  key={row.key}
                  style={{ marginBlock: 20 }}
                >
                  <h3>{row.label}</h3>

                  {row.role === "supplements" && (
                    <p>
                      Optional. Customers will have
                      a “No supplements” choice.
                    </p>
                  )}

                  <Field label="Suggested product">
                    <select
                      value={row.defaultProduct || ""}
                      onChange={(event) => {
                        const value = event.target.value;

                        updateSlot(index, {
                          defaultProduct: value || null,
                          defaultSize: null,
                          defaultColor: null,

                          allowedProducts: value
                            ? [
                                ...new Set([
                                  ...row.allowedProducts,
                                  value,
                                ]),
                              ]
                            : row.allowedProducts,
                        });
                      }}
                    >
                      <option value="">Not selected</option>

                      {row.defaultProduct && !known && (
                        <option value={row.defaultProduct}>
                          Saved product unavailable
                          in current choices
                        </option>
                      )}

                      {eligible.map((value) => (
                        <option
                          key={identity(value)}
                          value={identity(value)}
                        >
                          {value.name} ·{" "}
                          {value.brand || "Brand not recorded"}
                          {" · "}
                          {money(getDiscountedPrice(value))}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {!catalogLoading &&
                    !catalogError &&
                    !eligible.length && (
                      <p>
                        No eligible products. Configure
                        this role in product
                        administration first.
                      </p>
                    )}

                  {product && (
                    <div>
                      <ProductImage
                        product={product}
                        className="kit-admin-image"
                      />

                      <p>
                        {product.name} ·{" "}
                        {money(getDiscountedPrice(product))}
                        {" "}each
                      </p>
                    </div>
                  )}

                  {[
                    [
                      "sizes",
                      "defaultSize",
                      product?.optionLabels?.size || "Size",
                    ],
                    [
                      "colors",
                      "defaultColor",
                      product?.optionLabels?.color || "Colour",
                    ],
                  ].map(([axis, key, label]) =>
                    product?.[axis]?.length > 0 ? (
                      <Field key={key} label={label}>
                        <select
                          value={row[key] || ""}
                          onChange={(event) =>
                            updateSlot(index, {
                              [key]:
                                event.target.value || null,
                            })
                          }
                        >
                          <option value="">
                            Choose {label.toLowerCase()}
                          </option>

                          {row[key] &&
                            !product[axis].includes(
                              row[key],
                            ) && (
                              <option value={row[key]}>
                                Saved option unavailable
                              </option>
                            )}

                          {product[axis].map((value) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {value}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null,
                  )}

                  {product && (
                    <p>
                      {stock > 0
                        ? `${stock} currently available for this selection.`
                        : "Selection incomplete or unavailable. Drafts may be saved; purchasing is not enabled."}
                    </p>
                  )}

                  <Field label="Allowed replacements — hold Ctrl on Windows to select several">
                    <select
                      multiple
                      size={Math.min(
                        6,
                        Math.max(2, eligible.length),
                      )}
                      value={row.allowedProducts || []}
                      onChange={(event) => {
                        const selected = Array.from(
                          event.target.selectedOptions,
                          (option) => option.value,
                        );

                        updateSlot(index, {
                          allowedProducts:
                            row.defaultProduct
                              ? [
                                  ...new Set([
                                    ...selected,
                                    String(row.defaultProduct),
                                  ]),
                                ]
                              : selected,
                        });
                      }}
                    >
                      {eligible.map((value) => (
                        <option
                          key={identity(value)}
                          value={identity(value)}
                        >
                          {value.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Why suggest this item?">
                    <textarea
                      maxLength={1000}
                      value={row.whySelected || ""}
                      onChange={(event) =>
                        updateSlot(index, {
                          whySelected: event.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Default quantity">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      required
                      value={row.defaultQuantity}
                      onChange={(event) =>
                        updateSlot(index, {
                          defaultQuantity:
                            Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Maximum quantity">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      required
                      value={row.maximumQuantity}
                      onChange={(event) =>
                        updateSlot(index, {
                          maximumQuantity:
                            Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Include in suggested kit">
                    <input
                      type="checkbox"
                      checked={row.defaultIncluded}
                      onChange={(event) =>
                        updateSlot(index, {
                          defaultIncluded:
                            event.target.checked,
                        })
                      }
                    />
                  </Field>

                  <Field label="Optional item">
                    <input
                      type="checkbox"
                      disabled={row.role === "supplements"}
                      checked={row.optional}
                      onChange={(event) =>
                        updateSlot(index, {
                          optional: event.target.checked,
                        })
                      }
                    />
                  </Field>

                  <Field label="Suggested essential">
                    <input
                      type="checkbox"
                      disabled={row.role === "supplements"}
                      checked={row.suggestedEssential}
                      onChange={(event) =>
                        updateSlot(index, {
                          suggestedEssential:
                            event.target.checked,
                        })
                      }
                    />
                  </Field>
                </section>
              );
            })}

            <section
              className="panel"
              style={{ marginBlock: 20 }}
            >
              <h3>Packing and delivery setup</h3>

              <Link to="/admin/packing-locations">
                Manage packing locations
              </Link>

              <Field label="Fulfillment mode">
                <select
                  value={
                    draft.fulfillment?.mode ||
                    "unconfigured"
                  }
                  onChange={(event) =>
                    edit({
                      fulfillment: {
                        ...draft.fulfillment,
                        mode: event.target.value,

                        packingLocation:
                          event.target.value === "packed-together"
                            ? draft.fulfillment?.packingLocation || null
                            : null,
                      },
                    })
                  }
                >
                  <option value="unconfigured">
                    Not configured — keep as draft
                  </option>

                  <option value="packed-together">
                    Collect and pack together at a real location
                  </option>

                  <option value="separate-shipments">
                    Separate supplier shipments
                  </option>
                </select>
              </Field>

              {draft.fulfillment?.mode === "packed-together" && (
                <>
                  <p>
                    Choose an active, ready location.
                    Each supplier also needs a confirmed
                    agreement with this exact location.
                  </p>

                  <Field label="Find packing location">
                    <input
                      maxLength={100}
                      value={locationSearch}
                      onChange={(event) =>
                        setLocationSearch(event.target.value)
                      }
                    />
                  </Field>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setLocationPage(1);
                      setLocationQuery(locationSearch.trim());
                      setLocationRevision((value) => value + 1);
                    }}
                  >
                    Search / reload locations
                  </button>

                  {locationError && (
                    <p role="alert">{locationError}</p>
                  )}

                  {!locationData && !locationError && (
                    <p role="status">
                      Loading packing locations…
                    </p>
                  )}

                  <Field label="Packing location">
                    <select
                      value={
                        draft.fulfillment.packingLocation || ""
                      }
                      onChange={(event) =>
                        edit({
                          fulfillment: {
                            ...draft.fulfillment,
                            packingLocation:
                              event.target.value || null,
                          },
                        })
                      }
                    >
                      <option value="">Not selected</option>

                      {draft.fulfillment.packingLocation &&
                        !locationData?.locations.some(
                          (location) =>
                            location.id ===
                            String(
                              draft.fulfillment.packingLocation,
                            ),
                        ) && (
                          <option
                            value={
                              draft.fulfillment.packingLocation
                            }
                          >
                            Saved location — search or reload
                            to check readiness
                          </option>
                        )}

                      {(locationData?.locations || []).map(
                        (location) => (
                          <option
                            key={location.id}
                            value={location.id}
                            disabled={!location.ready}
                          >
                            {location.name} · {location.status}
                            {location.ready
                              ? " · ready"
                              : " · setup needed"}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  {locationData && (
                    <div className="purchase-actions">
                      <button
                        type="button"
                        disabled={locationPage <= 1}
                        onClick={() =>
                          setLocationPage((value) => value - 1)
                        }
                      >
                        Previous locations
                      </button>

                      <span>
                        {locationData.page} / {locationData.pages}
                      </span>

                      <button
                        type="button"
                        disabled={
                          locationPage >= locationData.pages
                        }
                        onClick={() =>
                          setLocationPage((value) => value + 1)
                        }
                      >
                        Next locations
                      </button>
                    </div>
                  )}

                  {locationData &&
                    !locationData.locations.length && (
                      <p>
                        No matching locations. Create a real
                        packing arrangement or change
                        the search.
                      </p>
                    )}

                  {selectedLocation && (
                    <div>
                      <p>
                        {selectedLocation.ready
                          ? "This location is currently ready. Product and supplier readiness will also be checked on the backend."
                          : "This selected location needs setup before the kit can be published."}
                      </p>

                      {selectedLocation.readinessIssues.length > 0 && (
                        <ul>
                          {selectedLocation.readinessIssues.map(
                            (issue) => (
                              <li key={issue}>{issue}</li>
                            ),
                          )}
                        </ul>
                      )}

                      <p>
                        Packing:{" "}
                        {selectedLocation.packing?.packingDaysMin ?? "Unknown"}
                        –
                        {selectedLocation.packing?.packingDaysMax ?? "Unknown"}
                        {" "}days. Courier transit:{" "}
                        {selectedLocation.delivery?.transitDaysMin ?? "Unknown"}
                        –
                        {selectedLocation.delivery?.transitDaysMax ?? "Unknown"}
                        {" "}days. Supplier preparation and
                        transfer times are additional.
                      </p>
                    </div>
                  )}
                </>
              )}

              {draft.fulfillment?.mode === "separate-shipments" && (
                <p>
                  Products may arrive in different packages.
                  The later checkout integration must show
                  actual package contents, count and delivery
                  estimates before payment.
                </p>
              )}

              <Field label="Customer explanation of preparation and delivery">
                <textarea
                  maxLength={2000}
                  value={
                    draft.fulfillment?.customerNote || ""
                  }
                  onChange={(event) =>
                    edit({
                      fulfillment: {
                        ...draft.fulfillment,
                        customerNote: event.target.value,
                      },
                    })
                  }
                />
              </Field>

              <p>
                Saving this setup does not publish the kit
                or reserve stock. Combined packing depends
                on the actual location and supplier
                arrangements.
              </p>
            </section>

            <section className="panel">
              <h3>Discount rules</h3>

              <Field label="Discount type">
                <select
                  value={draft.discount.type}
                  onChange={(event) =>
                    edit({
                      discount: {
                        ...draft.discount,
                        type: event.target.value,
                        value: 0,
                      },
                    })
                  }
                >
                  <option value="none">No kit discount</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed INR amount</option>
                </select>
              </Field>

              {[
                [
                  "value",
                  "Discount value",
                  0,
                  draft.discount.type === "percentage"
                    ? 100
                    : 100000000,
                  "0.01",
                ],
                [
                  "minimumSubtotal",
                  "Minimum item subtotal (INR)",
                  0,
                  100000000,
                  "0.01",
                ],
                [
                  "minimumCategories",
                  "Minimum selected categories",
                  1,
                  7,
                  "1",
                ],
              ].map(([key, label, min, max, step]) => (
                <Field key={key} label={label}>
                  <input
                    type="number"
                    required
                    min={min}
                    max={max}
                    step={step}
                    disabled={
                      key === "value" &&
                      draft.discount.type === "none"
                    }
                    value={draft.discount[key]}
                    onChange={(event) =>
                      edit({
                        discount: {
                          ...draft.discount,
                          [key]: Number(event.target.value),
                        },
                      })
                    }
                  />
                </Field>
              ))}

              <p>Categories required for the kit discount:</p>

              {[
                ...new Map(
                  draft.slots.map((row) => [
                    row.role,
                    row.label,
                  ]),
                ).entries(),
              ].map(([role, label]) => (
                <Field key={role} label={label}>
                  <input
                    type="checkbox"
                    checked={
                      draft.discount.requiredRoles.includes(role)
                    }
                    onChange={(event) =>
                      edit({
                        discount: {
                          ...draft.discount,

                          requiredRoles: event.target.checked
                            ? [
                                ...new Set([
                                  ...draft.discount.requiredRoles,
                                  role,
                                ]),
                              ]
                            : draft.discount.requiredRoles.filter(
                                (value) => value !== role,
                              ),
                        },
                      })
                    }
                  />
                </Field>
              ))}

              <p>
                If a customer skips a required category,
                this discount will not apply.
              </p>

              <Field label="Allow an order coupon as well">
                <input
                  type="checkbox"
                  checked={
                    draft.discount.allowCouponStacking
                  }
                  onChange={(event) =>
                    edit({
                      discount: {
                        ...draft.discount,
                        allowCouponStacking:
                          event.target.checked,
                      },
                    })
                  }
                />
              </Field>

              <p>
                These rules are saved as configuration.
                Server pricing and refund allocation will
                be connected in the checkout stage.
              </p>
            </section>

            <button
              type="submit"
              className="button"
              disabled={!dirty}
            >
              Save draft
            </button>
          </fieldset>
        </form>
      )}

      <style>{`
        .kit-admin-image {
          display: block;
          width: 120px;
          height: 120px;
          object-fit: contain;
        }

        .gd-admin-page fieldset input:not([type=checkbox]),
        .gd-admin-page fieldset select,
        .gd-admin-page fieldset textarea {
          width: 100%;
          max-width: 760px;
          min-height: 44px;
          padding: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
        }

        .gd-admin-page fieldset textarea {
          min-height: 90px;
        }

        .gd-admin-page fieldset input[type=checkbox] {
          width: 22px;
          height: 22px;
        }
      `}</style>
    </div>
  );
}