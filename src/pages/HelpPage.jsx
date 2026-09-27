import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { getOrders } from "../utils/customerData.js";
import { createTicket, ticketsFor, replyToTicket } from "../utils/support.js";
const faqs = [
  [
    "How much does delivery cost?",
    "Standard delivery costs ₹99 and is free from ₹500 after coupons. Express delivery costs ₹199. Dates and courier serviceability require a connected shipping provider.",
  ],
  [
    "How do coupons work?",
    "Apply one code per order. MIDLAJ gives 10% off from ₹1,000; NISHAD gives ₹200 off from ₹1,500; FAVAS gives 15% off from ₹2,500. The minimum uses the subtotal after product discounts.",
  ],
  [
    "Can I change a size or colour?",
    "In your bag, choose Edit size / colour. Matching variants combine only if enough stock remains. After delivery, eligible orders show a request for return or exchange.",
  ],
  [
    "How do returns and exchanges work?",
    "The supplied catalogue offers a 7-day return/replacement window. Open a delivered order, select the items and quantities, and describe the issue. The preview records a request for review; it does not book collection or issue a refund.",
  ],
  [
    "Where is my order?",
    "Open Orders & returns, then Track order. Tracking uses recorded events. The preview does not make up carrier updates or delivery dates.",
  ],
  [
    "What happens to saved items?",
    "Wishlist, comparison, product watches and saved-for-later items remain in this browser. Clearing browser storage removes them. Account orders and addresses are separated by preview account.",
  ],
  [
    "Can I pay online?",
    "Online payments are not connected in this preview. Checkout creates a COD preview record and never collects card numbers, CVVs or UPI credentials.",
  ],
];
export default function HelpPage() {
  const { user } = useAuth(),
    { notify } = useStore(),
    [params] = useSearchParams();
  const [query, setQuery] = useState(""),
    [tickets, setTickets] = useState(() => ticketsFor(user));
  const [form, setForm] = useState({
    subject: "",
    category: params.get("product") ? "Product question" : "General",
    email: user?.email || "",
    orderId: params.get("order") || "",
    productId: params.get("product") || "",
    message: "",
  });
  const [error, setError] = useState(""),
    [reply, setReply] = useState({});
  const orders = getOrders(user);
  function submit(e) {
    e.preventDefault();
    const saved = createTicket(user, form);
    if (!saved) {
      setError(
        "Enter a subject, valid email and at least 10 characters, and ensure browser storage is available.",
      );
      return;
    }
    setTickets(ticketsFor(user));
    setForm({ ...form, subject: "", message: "" });
    setError("");
    notify("Support request saved in this preview.");
  }
  return (
    <div className="page narrow">
      <div className="page-heading">
        <h1>How can we help?</h1>
        <Link className="text-link" to="/orders">
          Orders & returns →
        </Link>
      </div>
      <div className="field">
        <label htmlFor="help-search">Search shopping help</label>
        <input
          id="help-search"
          type="search"
          value={query}
          placeholder="Delivery, coupon, returns…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="faq-list">
        {faqs
          .filter((pair) =>
            pair.join(" ").toLowerCase().includes(query.toLowerCase()),
          )
          .map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
      </div>
      <div className="help-layout">
        <section className="panel">
          <h2>CONTACT SUPPORT</h2>
          <p className="notice">
            This form saves a request on this device. It is not sent to a
            support team. In development, the store console can reply so you can
            test the full conversation.
          </p>
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="help-email">Email</label>
              <input
                id="help-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="help-topic">Topic</label>
              <select
                id="help-topic"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {[
                  "General",
                  "Product question",
                  "Order issue",
                  "Delivery",
                  "Return or exchange",
                  "Payment question",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="help-order">Related order (optional)</label>
              <select
                id="help-order"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              >
                <option value="">No order selected</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="help-subject">Subject</label>
              <input
                id="help-subject"
                required
                maxLength="120"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="help-message">Message</label>
              <textarea
                id="help-message"
                required
                minLength="10"
                maxLength="2000"
                rows="5"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </div>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <button className="button" type="submit">
              Save support request
            </button>
          </form>
        </section>
        <section>
          <h2>YOUR REQUESTS</h2>
          {!tickets.length && (
            <p className="muted">
              Requests for this account or guest session will appear here.
            </p>
          )}
          {tickets.map((ticket) => (
            <article className="panel support-ticket" key={ticket.id}>
              <div className="panel-heading">
                <h3>{ticket.subject}</h3>
                <span className="status-pill">{ticket.status}</span>
              </div>
              <small className="order-id">{ticket.id}</small>
              {ticket.messages.map((m) => (
                <div className={`support-message ${m.by}`} key={m.id}>
                  <strong>
                    {m.by === "store" ? "Store preview reply" : "You"}
                  </strong>
                  <p>{m.text}</p>
                  <small>{new Date(m.createdAt).toLocaleString("en-IN")}</small>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (replyToTicket(ticket.id, user, reply[ticket.id] || "")) {
                    setTickets(ticketsFor(user));
                    setReply({ ...reply, [ticket.id]: "" });
                  } else
                    notify(
                      "Enter at least 2 characters and try again.",
                      "error",
                    );
                }}
              >
                <div className="field">
                  <label htmlFor={`reply-${ticket.id}`}>Add a reply</label>
                  <textarea
                    id={`reply-${ticket.id}`}
                    maxLength="2000"
                    required
                    minLength="2"
                    value={reply[ticket.id] || ""}
                    onChange={(e) =>
                      setReply({ ...reply, [ticket.id]: e.target.value })
                    }
                  />
                </div>
                <button className="button secondary compact" type="submit">
                  Save reply
                </button>
              </form>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}