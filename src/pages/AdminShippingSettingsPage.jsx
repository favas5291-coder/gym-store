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
  getAdminProducts,
  getAdminProductOptions,
} from "../services/productApi.js";

import {
  getShippingSettings,
  saveShippingSettings,
  rupeesToShippingPaise,
  validateShippingSettings,
} from "../services/shippingSettingsApi.js";

const panel = {
  padding: "20px",
  marginBottom: "20px",
  border: "1px solid #dedee3",
  borderRadius: "10px",
};

const columns = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",

  gap: "20px",
};

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

const pins = (input) =>
  input.trim()
    ? input.trim().split(/[\s,;]+/)
    : [];

function ProductChoices({
  token,
  title,
  selected,
  excluded,
  onChange,
  disabled,
}) {
  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [data, setData] =
    useState(null);

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(true);

  const names = useRef(new Map());

  useEffect(() => {
    const controller =
      new AbortController();

    let active = true;

    setBusy(true);
    setError("");
    setData(null);

    const timer = setTimeout(() => {
      getAdminProducts(
        token,
        {
          search,
          page,
          limit: 20,
          signal: controller.signal,
        },
      )
        .then((result) => {
          if (!active) return;

          for (
            const product of result.products
          ) {
            names.current.set(
              String(
                product._id || product.id,
              ).toLowerCase(),
              product.name,
            );
          }

          setData(result);
        })
        .catch((failure) => {
          if (active) {
            setError(
              failure.message ||
                "Products could not be loaded.",
            );
          }
        })
        .finally(() => {
          if (active) {
            setBusy(false);
          }
        });
    }, 300);

    return () => {
      active = false;

      clearTimeout(timer);
      controller.abort();
    };
  }, [token, search, page]);

  return (
    <div>
      <h3>{title}</h3>

      <label>
        Search products

        <input
          type="search"
          value={search}
          maxLength={150}
          disabled={disabled}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          style={{
            display: "block",
            width: "100%",
          }}
        />
      </label>

      <p>{selected.length} selected</p>

      {selected.length > 0 && (
        <ul
          style={{
            maxHeight: "180px",
            overflow: "auto",
            paddingLeft: "20px",
          }}
        >
          {selected.map((id) => (
            <li key={id}>
              {names.current.get(id) ||
                `Saved product ${id}`}{" "}

              <button
                type="button"
                className="text-link"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    selected.filter(
                      (value) =>
                        value !== id,
                    ),
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && (
        <p role="status">
          Loading products…
        </p>
      )}

      {error && (
        <p
          className="field-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div
        style={{
          maxHeight: "260px",
          overflow: "auto",
        }}
      >
        {data?.products.map((product) => {
          const id = String(
            product._id ||
              product.id ||
              "",
          ).toLowerCase();

          if (!/^[a-f0-9]{24}$/.test(id)) {
            return null;
          }

          const checked =
            selected.includes(id);

          return (
            <label
              className="check"
              key={id}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={
                  disabled ||
                  (
                    !checked &&
                    (
                      excluded.includes(id) ||
                      selected.length >= 500
                    )
                  )
                }
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter(
                          (value) =>
                            value !== id,
                        )
                      : [...selected, id],
                  )
                }
              />

              <span>
                {product.name}

                {product.category
                  ? ` · ${product.category}`
                  : ""}
              </span>
            </label>
          );
        })}
      </div>

      {!busy &&
        data?.products.length === 0 && (
          <p>
            No products match this search.
          </p>
        )}

      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginTop: "10px",
        }}
      >
        <button
          type="button"
          className="text-link"
          disabled={
            disabled ||
            busy ||
            page === 1
          }
          onClick={() =>
            setPage(
              (value) => value - 1,
            )
          }
        >
          Previous
        </button>

        <span>
          Page {page}
          {data
            ? ` of ${data.pages}`
            : ""}
        </span>

        <button
          type="button"
          className="text-link"
          disabled={
            disabled ||
            busy ||
            !data ||
            page >= data.pages
          }
          onClick={() =>
            setPage(
              (value) => value + 1,
            )
          }
        >
          Next
        </button>
      </div>
    </div>
  );
}

function CategoryChoices({
  title,
  choices,
  selected,
  excluded,
  onChange,
  disabled,
}) {
  const all = [
    ...new Map(
      [...choices, ...selected].map(
        (value) => [
          value.toLowerCase(),
          value,
        ],
      ),
    ).values(),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h3>{title}</h3>

      <div
        style={{
          maxHeight: "240px",
          overflow: "auto",
        }}
      >
        {all.map((category) => {
          const checked = selected.some(
            (value) =>
              value.toLowerCase() ===
              category.toLowerCase(),
          );

          const blocked = excluded.some(
            (value) =>
              value.toLowerCase() ===
              category.toLowerCase(),
          );

          return (
            <label
              className="check"
              key={category}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={
                  disabled ||
                  (
                    !checked &&
                    (
                      blocked ||
                      selected.length >= 100
                    )
                  )
                }
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter(
                          (value) =>
                            value.toLowerCase() !==
                            category.toLowerCase(),
                        )
                      : [
                          ...selected,
                          category,
                        ],
                  )
                }
              />

              <span>{category}</span>
            </label>
          );
        })}
      </div>

      {!all.length && (
        <p>
          No saved product categories are
          available.
        </p>
      )}
    </div>
  );
}

export default function AdminShippingSettingsPage() {
  const { token } = useAuth();

  const [saved, setSaved] =
    useState(null);

  const [draft, setDraft] =
    useState(null);

  const [amount, setAmount] =
    useState("");

  const [eligiblePins, setEligiblePins] =
    useState("");

  const [excludedPins, setExcludedPins] =
    useState("");

  const [categories, setCategories] =
    useState([]);

  const [categoryError, setCategoryError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [reloadRequired, setReloadRequired] =
    useState(false);

  const [revision, setRevision] =
    useState(0);

  const lock = useRef(false);
  const controller = useRef(null);
  const session = useRef(token);

  session.current = token;

  function install(value) {
    setSaved(value);

    setDraft(
      clone(value.freeShipping),
    );

    setAmount(
      (
        value.freeShipping
          .minimumSubtotalPaise / 100
      ).toFixed(2),
    );

    setEligiblePins(
      value.freeShipping
        .eligiblePincodes.join("\n"),
    );

    setExcludedPins(
      value.freeShipping
        .excludedPincodes.join("\n"),
    );

    setReloadRequired(false);
  }

  useEffect(() => {
    const request =
      new AbortController();

    let active = true;

    controller.current = null;
    lock.current = false;

    setBusy(false);
    setLoading(true);
    setError("");
    setNotice("");

    getShippingSettings(
      token,
      {
        signal: request.signal,
      },
    )
      .then((value) => {
        if (active) {
          install(value);
        }
      })
      .catch((failure) => {
        if (active) {
          setError(
            failure.message ||
              "Settings could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    getAdminProductOptions(
      token,
      {
        signal: request.signal,
      },
    )
      .then((value) => {
        if (active) {
          setCategories(
            value.categories.filter(
              (item) =>
                typeof item === "string" &&
                item.trim(),
            ),
          );

          setCategoryError("");
        }
      })
      .catch(() => {
        if (active) {
          setCategoryError(
            "Category choices could not be refreshed. Existing selections are preserved. Reload to retry.",
          );
        }
      });

    return () => {
      active = false;

      request.abort();
      controller.current?.abort();
    };
  }, [token, revision]);

  function edit(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));

    setNotice("");
  }

  async function submit(event) {
    event.preventDefault();

    if (
      lock.current ||
      !saved ||
      !draft ||
      reloadRequired ||
      loading
    ) {
      return;
    }

    let body;

    try {
      body = validateShippingSettings({
        version: saved.version,

        freeShipping: {
          ...draft,

          minimumSubtotalPaise:
            rupeesToShippingPaise(amount),

          eligiblePincodes:
            pins(eligiblePins),

          excludedPincodes:
            pins(excludedPins),
        },
      });
    } catch (failure) {
      setError(failure.message);
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");
    setNotice("");

    const startedFor = token;

    const request =
      new AbortController();

    controller.current = request;

    try {
      const result =
        await saveShippingSettings(
          token,
          body,
          {
            signal: request.signal,
          },
        );

      if (
        request.signal.aborted ||
        session.current !== startedFor
      ) {
        return;
      }

      install(result);

      setNotice(
        "Free shipping settings saved.",
      );

      window.dispatchEvent(
        new Event(
          "gymdrobe-shipping-settings-changed",
        ),
      );

      try {
        localStorage.setItem(
          "gymdrobe-shipping-offer-revision",
          `${result.version}:${Date.now()}`,
        );
      } catch {
        // Other tabs refresh their review on focus.
      }
    } catch (failure) {
      if (
        request.signal.aborted ||
        session.current !== startedFor
      ) {
        return;
      }

      setError(failure.message);

      setReloadRequired(
        Boolean(
          failure.reloadRequired ||
            failure.resultUnknown,
        ),
      );
    } finally {
      if (
        controller.current === request
      ) {
        lock.current = false;

        if (
          !request.signal.aborted &&
          session.current === startedFor
        ) {
          setBusy(false);
        }
      }
    }
  }

  const disabled =
    busy ||
    loading ||
    reloadRequired;

  const offer = draft;

  return (
    <div
      className="page"
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div className="page-heading">
        <h1>Free shipping offer</h1>

        <Link
          className="text-link"
          to="/admin"
        >
          Admin dashboard
        </Link>
      </div>

      <p>
        The offer waives standard delivery for
        ordinary product baskets when every
        item qualifies. The minimum uses the
        product total after coupons. Express
        delivery and measured kit parcel
        charges are calculated separately.
      </p>

      {error && (
        <p
          className="error-box"
          role="alert"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          className="positive"
          role="status"
        >
          {notice}
        </p>
      )}

      <button
        type="button"
        className="button secondary compact"
        disabled={busy || loading}
        onClick={() =>
          setRevision(
            (value) => value + 1,
          )
        }
      >
        {draft
          ? "Discard draft and reload saved settings"
          : "Reload settings"}
      </button>

      {loading && (
        <p role="status">
          Loading saved shipping settings…
        </p>
      )}

      {offer && saved && (
        <form
          onSubmit={submit}
          style={{
            marginTop: "20px",
          }}
        >
          <fieldset
            disabled={disabled}
            style={panel}
          >
            <legend>Offer</legend>

            <label className="check">
              <input
                type="checkbox"
                checked={offer.enabled}
                onChange={(event) =>
                  edit(
                    "enabled",
                    event.target.checked,
                  )
                }
              />

              <span>
                Enable free standard delivery
              </span>
            </label>

            <label>
              Minimum qualifying purchase (₹)

              <input
                type="text"
                inputMode="decimal"
                value={amount}
                maxLength={10}
                onChange={(event) => {
                  setAmount(
                    event.target.value,
                  );

                  setNotice("");
                }}
                style={{
                  display: "block",
                  maxWidth: "260px",
                }}
              />
            </label>

            <p className="muted">
              Use 0 to remove the purchase
              minimum. Product and pincode
              restrictions still apply.
            </p>
          </fieldset>

          <fieldset
            disabled={disabled}
            style={panel}
          >
            <legend>
              Eligible products and categories
            </legend>

            <p>
              Leave both lists empty to include
              all products. Otherwise, an item
              must be selected here or belong
              to a selected category. Every
              item in the basket must qualify.
            </p>

            <div style={columns}>
              <ProductChoices
                token={token}
                title="Eligible products"
                selected={
                  offer.eligibleProductIds
                }
                excluded={
                  offer.excludedProductIds
                }
                disabled={disabled}
                onChange={(value) =>
                  edit(
                    "eligibleProductIds",
                    value,
                  )
                }
              />

              <CategoryChoices
                title="Eligible categories"
                choices={categories}
                selected={
                  offer.eligibleCategories
                }
                excluded={
                  offer.excludedCategories
                }
                disabled={disabled}
                onChange={(value) =>
                  edit(
                    "eligibleCategories",
                    value,
                  )
                }
              />
            </div>
          </fieldset>

          <fieldset
            disabled={disabled}
            style={panel}
          >
            <legend>
              Excluded products and categories
            </legend>

            <p>
              Exclusions take priority over
              eligibility.
            </p>

            <div style={columns}>
              <ProductChoices
                token={token}
                title="Excluded products"
                selected={
                  offer.excludedProductIds
                }
                excluded={
                  offer.eligibleProductIds
                }
                disabled={disabled}
                onChange={(value) =>
                  edit(
                    "excludedProductIds",
                    value,
                  )
                }
              />

              <CategoryChoices
                title="Excluded categories"
                choices={categories}
                selected={
                  offer.excludedCategories
                }
                excluded={
                  offer.eligibleCategories
                }
                disabled={disabled}
                onChange={(value) =>
                  edit(
                    "excludedCategories",
                    value,
                  )
                }
              />
            </div>

            {categoryError && (
              <p role="status">
                {categoryError}
              </p>
            )}
          </fieldset>

          <fieldset
            disabled={disabled}
            style={panel}
          >
            <legend>Delivery regions</legend>

            <p>
              Enter six-digit Indian pincodes,
              one per line or separated by
              commas. An empty eligible list
              covers all pincodes except
              exclusions. These offer rules
              do not establish courier
              serviceability.
            </p>

            <div style={columns}>
              <label>
                Eligible pincodes

                <textarea
                  rows={6}
                  maxLength={80000}
                  value={eligiblePins}
                  onChange={(event) => {
                    setEligiblePins(
                      event.target.value,
                    );

                    setNotice("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                  }}
                />
              </label>

              <label>
                Excluded pincodes

                <textarea
                  rows={6}
                  maxLength={80000}
                  value={excludedPins}
                  onChange={(event) => {
                    setExcludedPins(
                      event.target.value,
                    );

                    setNotice("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                  }}
                />
              </label>
            </div>
          </fieldset>

          <fieldset
            disabled={disabled}
            style={panel}
          >
            <legend>
              Additional charges notice
            </legend>

            <label>
              Customer-facing explanation

              <input
                type="text"
                maxLength={500}
                value={
                  offer.additionalChargesNotice
                }
                onChange={(event) =>
                  edit(
                    "additionalChargesNotice",
                    event.target.value,
                  )
                }
                style={{
                  display: "block",
                  width: "100%",
                }}
              />
            </label>

            <p className="muted">
              Explain charges that remain
              applicable. This text does not
              change prices.
            </p>
          </fieldset>

          <button
            type="submit"
            className="button"
            disabled={disabled}
          >
            {busy
              ? "Saving…"
              : "Save shipping offer"}
          </button>

          {reloadRequired && (
            <p role="status">
              Your draft is preserved. Reload
              saved settings before another
              save; reloading replaces this
              draft.
            </p>
          )}

          <p className="muted">
            Saved settings version:{" "}
            {saved.version}
          </p>
        </form>
      )}
    </div>
  );
}