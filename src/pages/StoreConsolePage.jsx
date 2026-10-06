import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import categories from "../data/categories.js";
import { allOrders, persistOrder, orderTotal } from "../utils/customerData.js";
import { allTickets, persistTicket } from "../utils/support.js";
import { makeId } from "../utils/storage.js";
import { getTotalStock } from "../utils/cartUtils.js";
import { money } from "../utils/productPricing.js";
import { ORDER_TRANSITIONS, advanceOrder } from "../utils/inventory.js";
import { csvCell, downloadText } from "../utils/commerce.js";
import { COUPONS } from "../utils/orderCalculations.js";
import Modal from "../components/Modal.jsx";
function ProductEditor({ product, onClose }) {
  const { saveProduct, saveError } = useCatalog(),
    { notify } = useStore();
  const [draft, setDraft] = useState(() =>
    structuredClone(
      product || {
        id: makeId("product"),
        name: "",
        sku: "",
        isActive: true,
        brand: "GymDrobe",
        category: "Workout Clothes",
        subcategory: "",
        price: 0,
        discount: 0,
        stock: 0,
        stockStatus: "in-stock",
        image: "",
        images: [],
        description: "",
        colors: [],
        sizes: [],
        reviews: [],
        isFeatured: false,
        isNew: true,
      },
    ),
  );
  const [customImage, setCustomImage] = useState(product?.customImage || ""),
    [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function closeEditor() {
    if (!saveLock.current) onClose();
  }
  const hasVariants = Boolean(
    draft.variants &&
    typeof draft.variants === "object" &&
    !Array.isArray(draft.variants) &&
    Object.keys(draft.variants).length,
  );
  const set = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  async function submit(e) {
    e.preventDefault();
    if (saveLock.current) return;
    setError("");
    if (customImage && !/^https:\/\//i.test(customImage)) {
      setError(
        "Use an HTTPS image URL, or leave it blank to keep the supplied image.",
      );
      return;
    }
    if (draft.name.trim().length < 2 || !String(draft.sku || "").trim()) {
      setError(
        "Enter a product name with at least two characters and a unique product code (SKU).",
      );
      return;
    }
    const image = customImage.trim() || draft.image;
    const next = {
      ...draft,
      name: draft.name.trim(),
      sku: String(draft.sku || "")
        .trim()
        .toUpperCase(),
      customImage,
      image,
      images: customImage ? [customImage] : draft.images,
      price: Number(draft.price),
      discount: Number(draft.discount),
      stock: Number(draft.stock),
    };
    saveLock.current = true;
    setSaving(true);
    try {
      const saved = await saveProduct(next);
      if (!mounted.current) return;
      if (!saved) {
        setError(
          "The product was not confirmed as saved. Check the details below and retry after checking the admin product list.",
        );
        return;
      }
      notify("Product saved to the backend.");
      onClose();
    } catch (failure) {
      if (mounted.current)
        setError(failure.message || "Unable to save the product.");
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  const colors = draft.colors?.length ? draft.colors : [null],
    sizes = draft.sizes?.length ? draft.sizes : [null];
  return (
    <Modal
      title={product ? "Edit product & stock" : "Add a product"}
      onClose={closeEditor}
    >
      <form onSubmit={submit} className="admin-product-form" aria-busy={saving}>
        <fieldset
          disabled={saving}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <legend className="sr-only">Product details</legend>
          <div className="form-grid">
            {[
              ["name", "Product name"],
              ["sku", "Product code (SKU)"],
              ["brand", "Brand"],
              ["subcategory", "Product type"],
            ].map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={`edit-${key}`}>{label}</label>
                <input
                  id={`edit-${key}`}
                  required={key === "name" || key === "sku"}
                  value={draft[key] || ""}
                  maxLength="160"
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
            <div className="field">
              <label htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {!categories.some((c) => c.name === draft.category) &&
                  draft.category && <option>{draft.category}</option>}
                {categories.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            {[
              ["price", "Original price ₹", "any"],
              ["discount", "Discount %", "any"],
            ].map(([key, label, step]) => (
              <div className="field" key={key}>
                <label htmlFor={`edit-${key}`}>{label}</label>
                <input
                  id={`edit-${key}`}
                  type="number"
                  required
                  min="0"
                  max={key === "discount" ? 100 : undefined}
                  step={step}
                  value={draft[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="field">
            <label htmlFor="edit-description">Description</label>
            <textarea
              id="edit-description"
              rows="3"
              value={draft.description || ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-photo">
              Custom photo HTTPS URL (optional)
            </label>
            <input
              id="edit-photo"
              type="url"
              value={customImage}
              onChange={(e) => setCustomImage(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-stock-status">Store visibility</label>
            <select
              id="edit-stock-status"
              value={draft.isActive === false ? "out-of-stock" : "in-stock"}
              onChange={(e) =>
                set("isActive", e.target.value !== "out-of-stock")
              }
            >
              <option value="in-stock">Visible in the store</option>
              <option value="out-of-stock">Hidden from the store</option>
            </select>
          </div>
          <h3>Available inventory</h3>
          <p className="muted">
            Counts below are available units recorded in MongoDB. Stock from
            real orders is managed by the backend. Local preview orders do not
            change these counts.
          </p>
          {hasVariants ? (
            <div className="inventory-grid">
              {colors.flatMap((color) =>
                sizes.map((size) => (
                  <div className="field" key={`${color}-${size}`}>
                    <label htmlFor={`stock-${color}-${size}`}>
                      {[color, size].filter(Boolean).join(" / ") || "Default"}
                    </label>
                    <input
                      id={`stock-${color}-${size}`}
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={
                        color
                          ? (draft.variants[color]?.[size || "default"] ?? 0)
                          : (draft.variants[size || "default"] ?? 0)
                      }
                      onChange={(e) =>
                        setDraft((old) => {
                          const variants = structuredClone(old.variants),
                            value = Number(e.target.value);
                          if (color)
                            variants[color] = {
                              ...variants[color],
                              [size || "default"]: value,
                            };
                          else variants[size || "default"] = value;
                          return { ...old, variants };
                        })
                      }
                    />
                  </div>
                )),
              )}
            </div>
          ) : (
            <div className="field">
              <label htmlFor="edit-stock">Available units</label>
              <input
                id="edit-stock"
                type="number"
                required
                min="0"
                step="1"
                value={draft.stock}
                onChange={(e) => set("stock", e.target.value)}
              />
            </div>
          )}
          <div className="browse-controls">
            {[
              ["isFeatured", "Featured"],
              ["isBestSeller", "Bestseller"],
              ["isNew", "New arrival"],
            ].map(([key, label]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(draft[key])}
                  onChange={(e) => set(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="field-error">
            {error}
            {saveError ? ` ${saveError}` : ""}
          </p>
        )}
        <button type="submit" className="button full" disabled={saving}>
          {saving ? "Saving product…" : "Save product"}
        </button>
      </form>
    </Modal>
  );
}
function OrderManager({ order, refresh }) {
  const { notify } = useStore(),
    [status, setStatus] = useState(""),
    [carrier, setCarrier] = useState(""),
    [tracking, setTracking] = useState(""),
    [response, setResponse] = useState("");
  function save(e) {
    e.preventDefault();
    try {
      const current = allOrders().find((o) => o.id === order.id);
      if (!current) throw new Error("Order no longer exists.");
      const next = advanceOrder(current, status, {
        carrier,
        trackingNumber: tracking,
      });
      if (!persistOrder(next)) throw new Error("Unable to save order.");
      setStatus("");
      refresh();
      notify("Preview order status updated.");
    } catch (error) {
      notify(error.message, "error");
    }
  }
  function decision(value) {
    const current = allOrders().find((o) => o.id === order.id);
    if (!current || current.returnRequest?.status !== "requested") {
      notify("The request has already changed.", "info");
      return;
    }
    if (response.trim().length < 5) {
      notify("Add a response of at least 5 characters.", "error");
      return;
    }
    if (
      persistOrder({
        ...current,
        returnRequest: {
          ...current.returnRequest,
          status: value,
          response: response.trim(),
          reviewedAt: new Date().toISOString(),
        },
      })
    ) {
      refresh();
      notify("Request review saved.");
    }
  }
  return (
    <article className="panel">
      <div className="panel-heading">
        <h3 className="order-id">{order.id}</h3>
        <span className="status-pill">{order.status}</span>
      </div>
      <p>
        {order.customer?.name || order.shippingAddress?.fullName} ·{" "}
        {money(orderTotal(order))}
      </p>
      <p>{order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>
      <p>
        Payment: {order.payment?.method || "cod"} ·{" "}
        {order.payment?.status || "pending"}
      </p>
      {(ORDER_TRANSITIONS[order.status] || []).length > 0 && (
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor={`status-${order.id}`}>Next recorded status</label>
            <select
              id={`status-${order.id}`}
              required
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Select next status</option>
              {ORDER_TRANSITIONS[order.status].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("-", " ")}
                </option>
              ))}
            </select>
          </div>
          {status === "shipped" && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor={`carrier-${order.id}`}>Carrier label</label>
                <input
                  id={`carrier-${order.id}`}
                  required
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={`tracking-${order.id}`}>Tracking number</label>
                <input
                  id={`tracking-${order.id}`}
                  required
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </div>
            </div>
          )}
          <button type="submit" className="button secondary compact">
            Record preview status
          </button>
        </form>
      )}
      {order.returnRequest?.status &&
        order.returnRequest.status !== "not-requested" && (
          <div className="request-review">
            <h4>
              {order.returnRequest.type || "Return"} ·{" "}
              {order.returnRequest.status}
            </h4>
            <p>{order.returnRequest.reason}</p>
            {order.returnRequest.items?.map((item) => (
              <p key={item.index}>
                {order.items[item.index]?.name} × {item.quantity}
                {order.returnRequest.type === "exchange"
                  ? ` → ${[item.color, item.size].filter(Boolean).join(" / ")}`
                  : ""}
              </p>
            ))}
            {order.returnRequest.status === "requested" && (
              <>
                <div className="field">
                  <label htmlFor={`return-response-${order.id}`}>
                    Review response
                  </label>
                  <textarea
                    id={`return-response-${order.id}`}
                    rows="2"
                    value={response}
                    maxLength="1000"
                    onChange={(e) => setResponse(e.target.value)}
                  />
                </div>
                <div className="purchase-actions">
                  <button
                    type="button"
                    className="button compact"
                    onClick={() => decision("approved")}
                  >
                    Approve request
                  </button>
                  <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => decision("rejected")}
                  >
                    Decline request
                  </button>
                </div>
                <p className="muted">
                  Approval does not issue refunds, send replacements, or restock
                  returned goods.
                </p>
              </>
            )}
          </div>
        )}
    </article>
  );
}
function TicketManager({ ticket, refresh }) {
  const [reply, setReply] = useState(""),
    { notify } = useStore();
  return (
    <article className="panel">
      <div className="panel-heading">
        <h3>{ticket.subject}</h3>
        <span className="status-pill">{ticket.status}</span>
      </div>
      <p>
        {ticket.email} · {ticket.category}
      </p>
      {ticket.messages.map((m) => (
        <div className={`support-message ${m.by}`} key={m.id}>
          <strong>{m.by}</strong>
          <p>{m.text}</p>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const current = allTickets().find((t) => t.id === ticket.id);
          if (
            current &&
            persistTicket({
              ...current,
              status: "answered",
              messages: [
                ...current.messages,
                {
                  id: makeId("message"),
                  by: "store",
                  text: reply.trim(),
                  createdAt: new Date().toISOString(),
                },
              ],
            })
          ) {
            setReply("");
            refresh();
            notify("Reply saved in the preview.");
          }
        }}
      >
        <div className="field">
          <label htmlFor={`admin-reply-${ticket.id}`}>Reply to request</label>
          <textarea
            id={`admin-reply-${ticket.id}`}
            required
            minLength="2"
            maxLength="2000"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
        </div>
        <div className="purchase-actions">
          <button type="submit" className="button compact">
            Save reply
          </button>
          <button
            type="button"
            className="button secondary compact"
            disabled={ticket.status === "resolved"}
            onClick={() => {
              const current = allTickets().find((t) => t.id === ticket.id);
              if (current && persistTicket({ ...current, status: "resolved" }))
                refresh();
            }}
          >
            Resolve
          </button>
        </div>
      </form>
    </article>
  );
}
function StoreConsoleWorkspace() {
  const { user, token } = useAuth();
  const canEditProducts = Boolean(token && user?.role === "admin");
  const {
      products,
      loading,
      error: catalogError,
      refreshProducts,
    } = useCatalog(),
    [tab, setTab] = useState("overview"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState(null),
    [, update] = useState(0);
  const refresh = () => update((n) => n + 1),
    orders = allOrders(),
    tickets = allTickets();
  const lowStock = products.filter((p) => getTotalStock(p) <= 10),
    pendingReturns = orders.filter(
      (o) => o.returnRequest?.status === "requested",
    );
  function exportOrders() {
    const rows = [
      ["Order", "Created", "Customer", "Status", "Total INR", "Payment status"],
      ...orders.map((o) => [
        o.id,
        o.createdAt,
        o.customer?.name,
        o.status,
        orderTotal(o),
        o.payment?.status || "pending",
      ]),
    ];
    downloadText(
      "GymDrobe-preview-orders.csv",
      rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEVELOPMENT ONLY</p>
          <h1>Store console</h1>
        </div>
        <Link to="/" className="text-link">
          Open storefront →
        </Link>
      </div>
      <p className="notice">
        Product edits save to the configured backend and require an admin
        account. Orders, return reviews and support replies here are
        browser-local previews. Manage real orders and returns in their admin
        dashboards. This console is available only through the development
        route.
      </p>
      <div className="purchase-actions">
        <Link className="button secondary" to="/admin/products">
          Product admin
        </Link>
        <Link className="button secondary" to="/admin/orders">
          Real orders
        </Link>
        <Link className="button secondary" to="/admin/returns">
          Real returns
        </Link>
      </div>
      {catalogError && (
        <div className="notice">
          <p role="alert">{catalogError}</p>
          <button
            type="button"
            className="button secondary"
            disabled={loading}
            onClick={refreshProducts}
          >
            Retry catalog
          </button>
        </div>
      )}
      {!canEditProducts && (
        <p className="notice">
          Sign in with an admin account to edit backend products.{" "}
          <Link to="/login">Sign in</Link>
        </p>
      )}
      <div
        className="choice-tabs admin-tabs"
        aria-label="Store console sections"
      >
        {[
          "overview",
          "products",
          "orders",
          "returns",
          "support",
          "coupons",
        ].map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="metric-grid">
            {[
              ["Catalogue products", products.length],
              ["Preview orders", orders.length],
              ["Awaiting return review", pendingReturns.length],
              [
                "Open support requests",
                tickets.filter((t) => t.status !== "resolved").length,
              ],
            ].map(([label, value]) => (
              <article className="panel" key={label}>
                <strong>{value}</strong>
                <p>{label}</p>
              </article>
            ))}
          </div>
          <div className="panel">
            <h2>STOCK TO CHECK</h2>
            {lowStock.length ? (
              lowStock.map((p) => (
                <p key={p.id}>
                  {p.name} · {getTotalStock(p)} available{" "}
                  <button
                    className="text-link"
                    type="button"
                    disabled={
                      !canEditProducts || loading || Boolean(catalogError)
                    }
                    onClick={() => setEditing(p)}
                  >
                    Edit stock
                  </button>
                </p>
              ))
            ) : (
              <p>All products have more than 10 units available.</p>
            )}
            <p className="muted">
              No revenue is reported from unpaid preview orders.
            </p>
          </div>
        </>
      )}
      {tab === "products" && (
        <>
          <div className="browse-controls">
            <div className="field">
              <label htmlFor="admin-product-search">Find a product</label>
              <input
                id="admin-product-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="button"
              type="button"
              disabled={!canEditProducts || loading || Boolean(catalogError)}
              onClick={() => setEditing({ newProduct: true })}
            >
              Add product
            </button>
          </div>
          <div className="comparison-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Original price</th>
                  <th>Available stock</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) =>
                    `${p.name} ${p.category}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.category}</td>
                      <td>{money(p.price)}</td>
                      <td>{getTotalStock(p)}</td>
                      <td>
                        <button
                          className="button secondary compact"
                          type="button"
                          disabled={
                            !canEditProducts || loading || Boolean(catalogError)
                          }
                          onClick={() => setEditing(p)}
                        >
                          Edit {p.name}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "orders" && (
        <>
          <div className="page-heading">
            <h2>ALL PREVIEW ORDERS</h2>
            <button
              className="button secondary compact"
              type="button"
              onClick={exportOrders}
            >
              Export orders CSV
            </button>
          </div>
          {orders.length ? (
            orders.map((o) => (
              <OrderManager key={o.id} order={o} refresh={refresh} />
            ))
          ) : (
            <p className="panel">
              Place a preview order in the storefront to test order management.
            </p>
          )}
        </>
      )}
      {tab === "returns" && (
        <>
          {orders
            .filter(
              (o) =>
                o.returnRequest?.status &&
                o.returnRequest.status !== "not-requested",
            )
            .map((o) => (
              <OrderManager key={o.id} order={o} refresh={refresh} />
            ))}
          {!orders.some(
            (o) =>
              o.returnRequest?.status &&
              o.returnRequest.status !== "not-requested",
          ) && (
            <p className="panel">
              No return or exchange requests. Record delivery on a preview
              order, then request a return from that order’s customer page.
            </p>
          )}
        </>
      )}
      {tab === "support" && (
        <>
          {tickets.map((ticket) => (
            <TicketManager key={ticket.id} ticket={ticket} refresh={refresh} />
          ))}
          {!tickets.length && (
            <p className="panel">
              Support requests appear after you submit the Help form.
            </p>
          )}
        </>
      )}
      {tab === "coupons" && (
        <section className="panel">
          <h2>COUPON CONFIGURATION</h2>
          {Object.values(COUPONS).map((c) => (
            <p key={c.code}>
              <strong>{c.code}</strong> ·{" "}
              {c.type === "fixed" ? money(c.value) : `${c.value}%`} off ·
              minimum {money(c.minimum)}
            </p>
          ))}
          <p>
            These configured coupons are shared by offers, bag and checkout.
            Edit <code>src/utils/orderCalculations.js</code> to change the
            store’s coupon rules. Live promotional eligibility must be verified
            by a backend.
          </p>
        </section>
      )}
      {editing && canEditProducts && (
        <ProductEditor
          product={editing.newProduct ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
export default function StoreConsolePage() {
  const { user, token, authLoading = false } = useAuth();
  if (authLoading)
    return (
      <div className="page panel" role="status">
        Loading session…
      </div>
    );
  return (
    <StoreConsoleWorkspace
      key={`${user?.id || user?._id || "guest"}:${token || ""}`}
    />
  );
}
