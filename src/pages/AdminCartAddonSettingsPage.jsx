import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getAdminProducts,
  getAdminProductById,
} from "../services/productApi.js";
import {
  MAX_CONFIGURED_PAIRS,
  MAX_EXCLUDED_PRODUCTS,
  getCartAddonSettings,
  saveCartAddonSettings,
  validateCartAddonSettings,
} from "../services/cartAddonSettingsApi.js";

import "./AdminDashboardPage.css";

const PAGE_SIZE = 10;

const clone = (value) =>
  JSON.parse(JSON.stringify(value));

const idOf = (product) =>
  String(product?._id || product?.id || "").toLowerCase();

const deniedStatus = (error) =>
  [401, 403].includes(error?.status);

const rowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
};

const cardStyle = {
  padding: 16,
  border: "1px solid #dce2e8",
  borderRadius: 10,
  margin: "12px 0",
  overflowWrap: "anywhere",
};

const checkStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  minHeight: 44,
};

function AccessMessage({ children }) {
  return (
    <div className="page gd-admin-page">
      <p className="gd-admin-alert" role="alert">
        {children}
      </p>

      <Link to="/login?next=%2Fadmin%2Fcart-addons">
        Sign in with an admin account
      </Link>
    </div>
  );
}

export default function AdminCartAddonSettingsPage() {
  const {
    user,
    token,
    loading,
    authError,
  } = useAuth();

  if (loading) {
    return (
      <div className="page" role="status">
        Checking admin access…
      </div>
    );
  }

  if (
    authError ||
    !token ||
    user?.role !== "admin" ||
    user.isActive === false
  ) {
    return (
      <AccessMessage>
        {authError || "An active admin session is required."}
      </AccessMessage>
    );
  }

  return (
    <SettingsEditor
      key={`${idOf(user)}:${token}`}
      token={token}
    />
  );
}

function Pagination({
  page,
  pages,
  onChange,
  disabled,
  label,
}) {
  if (pages <= 1) return null;

  return (
    <nav aria-label={label} style={rowStyle}>
      <button
        type="button"
        className="gd-admin-action"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>

      <span>
        Page {page} of {pages}
      </span>

      <button
        type="button"
        className="gd-admin-action"
        disabled={disabled || page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

function ProductPicker({
  token,
  disabled,
  onChoose,
  onRemember,
  onDenied,
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (disabled) return;

    const request = new AbortController();

    setLoading(true);
    setError("");
    setData(null);

    getAdminProducts(token, {
      search: query,
      page,
      limit: 10,
      signal: request.signal,
    })
      .then((result) => {
        if (request.signal.aborted) return;

        onRemember(result.products);
        setData(result);
      })
      .catch((failure) => {
        if (request.signal.aborted) return;

        setError(
          failure.message ||
            "Products could not be loaded.",
        );

        if (deniedStatus(failure)) {
          onDenied();
        }
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setLoading(false);
        }
      });

    return () => request.abort();
  }, [
    token,
    query,
    page,
    revision,
    disabled,
    onRemember,
    onDenied,
  ]);

  return (
    <section
      className="gd-admin-panel"
      aria-label="Find products for add-ons"
    >
      <h2>Find products</h2>

      <p>
        Choose the product already in the bag, then its
        suggested add-on. You can also exclude a product
        from suggestions.
      </p>

      <form
        className="gd-admin-filters"
        onSubmit={(event) => {
          event.preventDefault();

          if (disabled) return;

          setQuery(search.trim());
          setPage(1);
          setRevision((value) => value + 1);
        }}
      >
        <label>
          Search by product name, brand or category

          <input
            type="search"
            value={search}
            maxLength={150}
            disabled={disabled}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </label>

        <button
          type="submit"
          className="gd-admin-action"
          disabled={disabled}
        >
          Search / reload products
        </button>
      </form>

      {loading && !disabled && (
        <p role="status">Loading products…</p>
      )}

      {error && (
        <p className="gd-admin-alert" role="alert">
          {error}
        </p>
      )}

      {!loading && data?.products.length === 0 && (
        <p>No matching products found.</p>
      )}

      {data?.products.map((product) => {
        const id = idOf(product);

        if (!/^[a-f0-9]{24}$/.test(id)) {
          return null;
        }

        const inactive =
          product.isActive === false;

        return (
          <article key={id} style={cardStyle}>
            <strong>{product.name}</strong>

            <p className="gd-admin-muted">
              {[
                product.brand,
                product.category,
                inactive ? "Inactive" : "Active",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div style={rowStyle}>
              <button
                type="button"
                className="gd-admin-action"
                disabled={disabled || inactive}
                onClick={() =>
                  onChoose("source", product)
                }
              >
                Use as bag product
              </button>

              <button
                type="button"
                className="gd-admin-action"
                disabled={disabled || inactive}
                onClick={() =>
                  onChoose("target", product)
                }
              >
                Use as add-on
              </button>

              <button
                type="button"
                className="gd-admin-action"
                disabled={disabled}
                onClick={() =>
                  onChoose("exclude", product)
                }
              >
                Exclude from suggestions
              </button>
            </div>
          </article>
        );
      })}

      <Pagination
        page={page}
        pages={data?.pages || 1}
        onChange={setPage}
        disabled={disabled || loading}
        label="Product search pages"
      />
    </section>
  );
}

function SettingsEditor({ token }) {
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [products, setProducts] = useState({});
  const [nameError, setNameError] = useState("");
  const [nameRevision, setNameRevision] = useState(0);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [pairEnabled, setPairEnabled] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [pairPage, setPairPage] = useState(1);
  const [excludedPage, setExcludedPage] = useState(1);

  const live = useRef(false);
  const lock = useRef(false);
  const writing = useRef(null);
  const productCache = useRef(products);

  productCache.current = products;

  const onDenied = useCallback(
    () => setDenied(true),
    [],
  );

  const remember = useCallback((rows) => {
    setProducts((previous) => {
      const next = { ...previous };

      for (const row of rows) {
        const id = idOf(row);

        if (/^[a-f0-9]{24}$/.test(id)) {
          next[id] = row;
        }
      }

      return next;
    });
  }, []);

  useEffect(() => {
    live.current = true;

    return () => {
      live.current = false;
      writing.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (denied) return;

    const request = new AbortController();

    setLoading(true);
    setReady(false);
    setError("");
    setNotice("");

    getCartAddonSettings(token, {
      signal: request.signal,
    })
      .then((value) => {
        if (request.signal.aborted) return;

        setSaved(value);
        setDraft(clone(value));
        setBlocked(false);
        setReady(true);
        setSource("");
        setTarget("");
        setConfirmed(false);
        setPairEnabled(true);
        setPairPage(1);
        setExcludedPage(1);
      })
      .catch((failure) => {
        if (request.signal.aborted) return;

        setError(
          failure.message ||
            "Settings could not be loaded.",
        );

        if (deniedStatus(failure)) {
          onDenied();
        }
      })
      .finally(() => {
        if (!request.signal.aborted) {
          setLoading(false);
        }
      });

    return () => request.abort();
  }, [token, revision, denied, onDenied]);

  const pairs = draft?.configuredPairs || [];
  const excluded = draft?.excludedProductIds || [];

  const pairPages = Math.max(
    1,
    Math.ceil(pairs.length / PAGE_SIZE),
  );

  const excludedPages = Math.max(
    1,
    Math.ceil(excluded.length / PAGE_SIZE),
  );

  const currentPairPage = Math.min(
    pairPage,
    pairPages,
  );

  const currentExcludedPage = Math.min(
    excludedPage,
    excludedPages,
  );

  const pairStart =
    (currentPairPage - 1) * PAGE_SIZE;

  const excludedStart =
    (currentExcludedPage - 1) * PAGE_SIZE;

  const visiblePairs = pairs.slice(
    pairStart,
    pairStart + PAGE_SIZE,
  );

  const visibleExcluded = excluded.slice(
    excludedStart,
    excludedStart + PAGE_SIZE,
  );

  const visibleIds = JSON.stringify(
    [
      ...new Set([
        ...visiblePairs.flatMap((pair) => [
          pair.sourceId,
          pair.productId,
        ]),
        ...visibleExcluded,
      ]),
    ].sort(),
  );

  useEffect(() => {
    if (denied || loading) return;

    const request = new AbortController();

    const missing = JSON.parse(visibleIds).filter(
      (id) => !productCache.current[id],
    );

    let index = 0;
    let failed = false;

    setNameError("");

    async function worker() {
      while (
        index < missing.length &&
        !request.signal.aborted
      ) {
        const id = missing[index++];

        try {
          const product = await getAdminProductById(
            token,
            id,
            {
              signal: request.signal,
            },
          );

          if (idOf(product) !== id) {
            throw new Error(
              "Product details did not match.",
            );
          }

          if (!request.signal.aborted) {
            remember([product]);
          }
        } catch (failure) {
          if (request.signal.aborted) return;

          if (deniedStatus(failure)) {
            onDenied();
            request.abort();
            return;
          }

          if (failure.status === 404) {
            remember([
              {
                _id: id,
                name: "Unavailable product",
                isActive: false,
              },
            ]);
          } else {
            failed = true;
          }
        }
      }
    }

    Promise.all(
      Array.from(
        {
          length: Math.min(4, missing.length),
        },
        worker,
      ),
    ).then(() => {
      if (!request.signal.aborted && failed) {
        setNameError(
          "Some product names could not be loaded. Your saved selections are preserved.",
        );
      }
    });

    return () => request.abort();
  }, [
    token,
    visibleIds,
    nameRevision,
    loading,
    denied,
    remember,
    onDenied,
  ]);

  const dirty = Boolean(
    draft &&
      saved &&
      JSON.stringify(draft) !==
        JSON.stringify(saved),
  );

  const disabled =
    !ready ||
    loading ||
    busy ||
    blocked ||
    denied;

  const name = (id) =>
    products[id]?.name || `Product ${id}`;

  function update(change) {
    if (disabled || lock.current) return;

    setDraft((previous) => ({
      ...previous,
      ...change,
    }));

    setError("");
    setNotice("");
  }

  function choose(kind, product) {
    if (disabled || lock.current) return;

    const id = idOf(product);

    remember([product]);

    if (kind === "exclude") {
      if (excluded.includes(id)) {
        setNotice(
          "This product is already excluded.",
        );
        return;
      }

      if (
        excluded.length >= MAX_EXCLUDED_PRODUCTS
      ) {
        setError(
          `Exclude up to ${MAX_EXCLUDED_PRODUCTS} products.`,
        );
        return;
      }

      update({
        excludedProductIds: [...excluded, id],
      });
    } else {
      if (product.isActive === false) return;

      if (kind === "source") {
        setSource(id);
      } else {
        setTarget(id);
      }

      setConfirmed(false);
      setNotice("");
      setError("");
    }
  }

  function addPair() {
    if (disabled || lock.current) return;

    try {
      const next = validateCartAddonSettings({
        ...draft,

        configuredPairs: [
          ...pairs,
          {
            sourceId: source,
            productId: target,
            enabled: pairEnabled,
            compatibilityConfirmed: confirmed,
          },
        ],
      });

      update(next);

      setSource("");
      setTarget("");
      setConfirmed(false);
      setPairEnabled(true);

      setPairPage(
        Math.ceil(
          next.configuredPairs.length / PAGE_SIZE,
        ),
      );
    } catch (failure) {
      setError(failure.message);
    }
  }

  function editPair(index, change) {
    update({
      configuredPairs: pairs.map(
        (pair, position) =>
          position === index
            ? {
                ...pair,
                ...change,
              }
            : pair,
      ),
    });
  }

  function movePair(index, direction) {
    const next = [...pairs];

    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];

    update({
      configuredPairs: next,
    });
  }

  function reload() {
    if (lock.current || loading) return;

    if (
      (dirty || source || target) &&
      !window.confirm(
        "Discard your unsaved add-on changes and load saved settings?",
      )
    ) {
      return;
    }

    setRevision((value) => value + 1);
  }

  async function save() {
    if (
      disabled ||
      lock.current ||
      !saved ||
      !draft
    ) {
      return;
    }

    if (source || target) {
      setError(
        "Add or clear the unfinished product pairing before saving.",
      );
      return;
    }

    let body;

    try {
      body = validateCartAddonSettings({
        ...draft,
        version: saved.version,
      });
    } catch (failure) {
      setError(failure.message);
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");
    setNotice("");

    const request = new AbortController();

    writing.current = request;

    try {
      const result =
        await saveCartAddonSettings(
          token,
          body,
          {
            signal: request.signal,
          },
        );

      if (
        !live.current ||
        request.signal.aborted
      ) {
        return;
      }

      setSaved(result);
      setDraft(clone(result));
      setNotice("Cart add-on settings saved.");

      window.dispatchEvent(
        new Event(
          "gymdrobe-cart-addon-settings-changed",
        ),
      );

      try {
        localStorage.setItem(
          "gymdrobe-cart-addon-revision",
          `${result.version}:${Date.now()}`,
        );
      } catch {
        // Other tabs refresh their settings when focused.
      }
    } catch (failure) {
      if (
        !live.current ||
        request.signal.aborted
      ) {
        return;
      }

      setError(
        failure.message ||
          "The settings could not be saved.",
      );

      setBlocked(
        Boolean(
          failure.reloadRequired ||
            failure.resultUnknown,
        ),
      );

      if (deniedStatus(failure)) {
        onDenied();
      }
    } finally {
      if (writing.current === request) {
        writing.current = null;
        lock.current = false;

        if (live.current) {
          setBusy(false);
        }
      }
    }
  }

  if (denied) {
    return (
      <AccessMessage>
        Your admin access could not be verified.
        Sign in again before editing add-on settings.
      </AccessMessage>
    );
  }

  return (
    <div
      className="page gd-admin-page"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div className="gd-admin-heading">
        <div>
          <p className="eyebrow">
            GYMDROBE ADMIN
          </p>

          <h1>Cart add-ons</h1>

          <p className="gd-admin-muted">
            Control the optional products customers
            see in their bag.
          </p>
        </div>

        <button
          type="button"
          className="button"
          disabled={disabled || !dirty}
          onClick={save}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>

      <nav
        className="gd-admin-menu"
        aria-label="Related admin pages"
      >
        <Link to="/admin">
          Dashboard
        </Link>

        <Link to="/admin/products">
          Products
        </Link>

        <Link to="/admin/shipping-settings">
          Free shipping
        </Link>
      </nav>

      {error && (
        <p
          className="gd-admin-alert"
          role="alert"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          className="gd-admin-success"
          role="status"
        >
          {notice}
        </p>
      )}

      {blocked && (
        <p className="gd-admin-test">
          Your draft is preserved. Load the saved
          settings before another save.
        </p>
      )}

      <button
        type="button"
        className="gd-admin-action"
        disabled={busy || loading}
        onClick={reload}
      >
        {draft
          ? "Discard draft and reload saved settings"
          : "Reload settings"}
      </button>

      {loading && (
        <p role="status">
          Loading saved add-on settings…
        </p>
      )}

      {draft && (
        <>
          <p className="gd-admin-muted">
            Saved offer:{" "}
            {saved.enabled ? "Enabled" : "Disabled"}
            {" · "}
            Version {saved.version}
            {dirty
              ? " · Unsaved changes"
              : " · No unsaved changes"}
          </p>

          <fieldset
            className="gd-admin-panel"
            disabled={disabled}
          >
            <legend>
              Suggestion settings
            </legend>

            <label style={checkStyle}>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  update({
                    enabled: event.target.checked,
                  })
                }
              />

              Enable cart add-on suggestions
            </label>

            <label style={checkStyle}>
              <input
                type="checkbox"
                checked={draft.useCategoryRules}
                onChange={(event) =>
                  update({
                    useCategoryRules:
                      event.target.checked,
                  })
                }
              />

              Include suggestions from complementary
              categories
            </label>

            <div className="gd-admin-filters">
              <label>
                Maximum suggestions

                <select
                  value={draft.maxSuggestions}
                  onChange={(event) =>
                    update({
                      maxSuggestions: Number(
                        event.target.value,
                      ),
                    })
                  }
                >
                  {[1, 2, 3].map((number) => (
                    <option
                      key={number}
                      value={number}
                    >
                      {number}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p>
              Confirmed product pairings take priority.
              Turning category suggestions off keeps only
              your enabled product pairings.
            </p>

            <p className="gd-admin-muted">
              Stock, selected options, prices and delivery
              are checked again before a customer adds an item.
            </p>
          </fieldset>

          <ProductPicker
            token={token}
            disabled={disabled}
            onChoose={choose}
            onRemember={remember}
            onDenied={onDenied}
          />

          <fieldset
            className="gd-admin-panel"
            disabled={disabled}
          >
            <legend>
              New product pairing
            </legend>

            <p>
              <strong>
                Already in the bag:
              </strong>{" "}
              {source
                ? name(source)
                : "Choose a bag product from the search results."}
            </p>

            <p>
              <strong>
                Suggest this add-on:
              </strong>{" "}
              {target
                ? name(target)
                : "Choose an add-on from the search results."}
            </p>

            {source && target && source === target && (
              <p className="gd-admin-alert">
                Choose two different products.
              </p>
            )}

            <label style={checkStyle}>
              <input
                type="checkbox"
                checked={pairEnabled}
                onChange={(event) =>
                  setPairEnabled(
                    event.target.checked,
                  )
                }
              />

              Enable this pairing
            </label>

            <label style={checkStyle}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) =>
                  setConfirmed(
                    event.target.checked,
                  )
                }
              />

              I have checked that these products are compatible.
            </label>

            <p className="gd-admin-muted">
              Enabled pairings require compatibility confirmation.
              A disabled pairing prevents this specific category
              suggestion.
            </p>

            {target && excluded.includes(target) && (
              <p className="gd-admin-test">
                This add-on is excluded and will remain
                hidden until its exclusion is removed.
              </p>
            )}

            <div style={rowStyle}>
              <button
                type="button"
                className="gd-admin-action"
                disabled={
                  disabled ||
                  !source ||
                  !target ||
                  source === target ||
                  (pairEnabled && !confirmed) ||
                  pairs.length >= MAX_CONFIGURED_PAIRS
                }
                onClick={addPair}
              >
                Add pairing to draft
              </button>

              <button
                type="button"
                className="gd-admin-action"
                disabled={
                  disabled ||
                  (!source && !target)
                }
                onClick={() => {
                  setSource("");
                  setTarget("");
                  setConfirmed(false);
                  setPairEnabled(true);
                }}
              >
                Clear pairing selection
              </button>
            </div>
          </fieldset>

          {nameError && (
            <div className="gd-admin-test">
              <p role="status">
                {nameError}
              </p>

              <button
                type="button"
                className="gd-admin-action"
                disabled={loading || busy}
                onClick={() =>
                  setNameRevision(
                    (value) => value + 1,
                  )
                }
              >
                Retry product names
              </button>
            </div>
          )}

          <section
            className="gd-admin-panel"
            aria-label="Configured product pairings"
          >
            <h2>
              Product pairings ({pairs.length}/
              {MAX_CONFIGURED_PAIRS})
            </h2>

            <p>
              Pairings near the top have higher priority.
              These changes take effect after saving.
            </p>

            {!pairs.length && (
              <p>No product pairings configured.</p>
            )}

            {visiblePairs.map((pair, offset) => {
              const index = pairStart + offset;

              const unavailable = [
                pair.sourceId,
                pair.productId,
              ].some(
                (id) =>
                  products[id]?.isActive === false,
              );

              return (
                <article
                  key={`${pair.sourceId}:${pair.productId}`}
                  style={cardStyle}
                >
                  <h3>
                    {index + 1}. {name(pair.sourceId)}
                    {" → "}
                    {name(pair.productId)}
                  </h3>

                  {unavailable && (
                    <p className="gd-admin-test">
                      A paired product is missing or inactive.
                      Disable this pairing or restore the
                      product before enabling suggestions.
                    </p>
                  )}

                  {excluded.includes(pair.productId) && (
                    <p className="gd-admin-muted">
                      This add-on is excluded. Its exclusion
                      takes priority.
                    </p>
                  )}

                  <label style={checkStyle}>
                    <input
                      type="checkbox"
                      checked={
                        pair.compatibilityConfirmed
                      }
                      disabled={disabled}
                      onChange={(event) =>
                        editPair(index, {
                          compatibilityConfirmed:
                            event.target.checked,

                          ...(event.target.checked
                            ? {}
                            : {
                                enabled: false,
                              }),
                        })
                      }
                    />

                    Compatibility confirmed
                  </label>

                  <label style={checkStyle}>
                    <input
                      type="checkbox"
                      checked={pair.enabled}
                      disabled={
                        disabled ||
                        (
                          !pair.enabled &&
                          (
                            !pair.compatibilityConfirmed ||
                            unavailable
                          )
                        )
                      }
                      onChange={(event) =>
                        editPair(index, {
                          enabled:
                            event.target.checked,
                        })
                      }
                    />

                    Pairing enabled
                  </label>

                  <div style={rowStyle}>
                    <button
                      type="button"
                      className="gd-admin-action"
                      disabled={
                        disabled ||
                        index === 0
                      }
                      aria-label={`Move pairing ${index + 1} up`}
                      onClick={() =>
                        movePair(index, -1)
                      }
                    >
                      Move up
                    </button>

                    <button
                      type="button"
                      className="gd-admin-action"
                      disabled={
                        disabled ||
                        index === pairs.length - 1
                      }
                      aria-label={`Move pairing ${index + 1} down`}
                      onClick={() =>
                        movePair(index, 1)
                      }
                    >
                      Move down
                    </button>

                    <button
                      type="button"
                      className="gd-admin-action danger"
                      disabled={disabled}
                      aria-label={`Remove pairing ${index + 1}`}
                      onClick={() =>
                        update({
                          configuredPairs:
                            pairs.filter(
                              (_, position) =>
                                position !== index,
                            ),
                        })
                      }
                    >
                      Remove pairing
                    </button>
                  </div>
                </article>
              );
            })}

            <Pagination
              page={currentPairPage}
              pages={pairPages}
              onChange={setPairPage}
              disabled={disabled}
              label="Pairing pages"
            />
          </section>

          <section
            className="gd-admin-panel"
            aria-label="Excluded add-on products"
          >
            <h2>
              Excluded products ({excluded.length}/
              {MAX_EXCLUDED_PRODUCTS})
            </h2>

            <p>
              These products will not be suggested as
              add-ons, even when a product pairing
              recommends them.
            </p>

            {!excluded.length && (
              <p>No products excluded.</p>
            )}

            {visibleExcluded.map((id) => (
              <div
                key={id}
                style={{
                  ...cardStyle,
                  ...rowStyle,
                }}
              >
                <span
                  style={{
                    flex: "1 1 220px",
                  }}
                >
                  {name(id)}
                </span>

                <button
                  type="button"
                  className="gd-admin-action"
                  disabled={disabled}
                  aria-label={`Remove exclusion for ${name(id)}`}
                  onClick={() =>
                    update({
                      excludedProductIds:
                        excluded.filter(
                          (value) => value !== id,
                        ),
                    })
                  }
                >
                  Remove exclusion
                </button>
              </div>
            ))}

            <Pagination
              page={currentExcludedPage}
              pages={excludedPages}
              onChange={setExcludedPage}
              disabled={disabled}
              label="Exclusion pages"
            />
          </section>

          <button
            type="button"
            className="button"
            disabled={disabled || !dirty}
            onClick={save}
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
        </>
      )}
    </div>
  );
}