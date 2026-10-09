import { useRef, useState, useEffect } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";

import SupportInbox from "../components/SupportInbox.jsx";
import WhatsAppSupport from "../components/WhatsAppSupport.jsx";

import { supportRequest } from "../services/supportApi.js";

const faqs = [
  [
    "How much does delivery cost?",
    "Check the delivery options and final shipping charge at checkout before paying. Availability and estimated delivery information depend on the product and your delivery address.",
  ],
  [
    "How do coupons work?",
    "Apply one eligible coupon per order. See Offers & coupons for available codes and check the discount in your order summary before paying.",
  ],
  [
    "Can I change a size or colour?",
    "Before checkout, use Edit size / colour in your bag. Changes depend on available stock. After delivery, open your order to see whether a return or exchange request is available.",
  ],
  [
    "How do returns and exchanges work?",
    "Open a delivered order to check eligibility and submit an available return or exchange request. Select the items and quantities and describe the issue. A submitted request requires review; it does not mean a refund has been paid or collection has been booked.",
  ],
  [
    "Where is my order?",
    "Open My orders, select your order, then Track order. Tracking shows recorded order events and any carrier information supplied for that order.",
  ],
  [
    "What happens to saved items?",
    "Wishlist, comparison, product watches and saved-for-later items use browser storage. Clearing that storage can remove saved items. Sign in to view the orders associated with your account.",
  ],
  [
    "Can I pay online?",
    "Checkout supports Razorpay online payment and COD with a 10% online advance when available. Review the amount payable now and any delivery balance before proceeding. Your order details show the recorded payment status.",
  ],
  [
    "How do I contact GymDrobe support?",
    "Use WhatsApp or email to contact us without signing in. You can also sign in and submit a support request on this page. Check Your requests below for replies to support tickets.",
  ],
];

export default function HelpPage() {
  const { user, token } = useAuth();

  const [params] = useSearchParams();
  const location = useLocation();

  const [query, setQuery] = useState("");

  const [form, setForm] = useState({
    subject: "",
    category: params.get("product") ? "Product question" : "General",
    orderId: params.get("order") || "",
    productId: params.get("product") || "",
    message: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [revision, setRevision] = useState(0);

  const lock = useRef(false);
  const pending = useRef(null);
  const session = useRef(token);

  session.current = token;

  useEffect(() => {
    session.current = token;

    return () => {
      session.current = null;
    };
  }, [token]);

  async function submit(event) {
    event.preventDefault();

    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");

    const captured = token;

    try {
      const signature = JSON.stringify(form);

      if (!pending.current || pending.current.signature !== signature) {
        pending.current = {
          signature,
          requestId: crypto.randomUUID(),
        };
      }

      const data = await supportRequest(token, "", {
        method: "POST",
        body: {
          ...form,
          requestId: pending.current.requestId,
        },
      });

      if (session.current !== captured) {
        return;
      }

      setSuccess(
        `Request sent. Ticket ID: ${data.ticket.id}. Check Your requests below for replies.`,
      );

      setForm((value) => ({
        ...value,
        subject: "",
        message: "",
      }));

      pending.current = null;
      setRevision((value) => value + 1);
    } catch (saveError) {
      if (session.current === captured) {
        setError(saveError.message);
      }
    } finally {
      lock.current = false;

      if (session.current === captured) {
        setBusy(false);
      }
    }
  }

  const matches = faqs.filter((pair) =>
    pair.join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="page narrow">
      <div className="page-heading">
        <h1>How can we help?</h1>

        <Link className="text-link" to="/orders">
          Orders & returns →
        </Link>
      </div>

      <WhatsAppSupport />

      {user?.role === "admin" && (
        <p>
          <Link to="/admin/support">
            Open customer support inbox →
          </Link>
        </p>
      )}

      <div className="field">
        <label htmlFor="help-search">Search shopping help</label>

        <input
          id="help-search"
          type="search"
          value={query}
          placeholder="Delivery, coupons, returns…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="faq-list">
        {matches.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}

        {!matches.length && (
          <p>
            No matching answers. Try another search or contact support below.
          </p>
        )}
      </div>

      <p className="notice">
        Never share passwords, OTPs, card numbers, CVVs or UPI PINs
        in a support message.
      </p>

      {!user || !token ? (
        <section className="panel">
          <h2>Send a support request</h2>

          <p>
            Sign in to send a request and keep track of replies in your account.
          </p>

          <Link
            className="button"
            to={`/login?next=${encodeURIComponent(
              location.pathname + location.search,
            )}`}
          >
            Sign in to send a request
          </Link>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Send a support request</h2>

            <p>
              Requests go to the GymDrobe admin inbox.
              Replies appear on this page.
              Email notifications are not configured.
            </p>

            <p>Account email: {user.email}</p>

            <form onSubmit={submit}>
              <fieldset
                disabled={busy}
                style={{
                  border: 0,
                  padding: 0,
                  minWidth: 0,
                }}
              >
                <div className="field">
                  <label htmlFor="help-topic">Topic</label>

                  <select
                    id="help-topic"
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category: event.target.value,
                      })
                    }
                  >
                    {[
                      "General",
                      "Product question",
                      "Order issue",
                      "Delivery",
                      "Return or exchange",
                      "Payment question",
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="help-order">
                    Related order ID (optional)
                  </label>

                  <input
                    id="help-order"
                    maxLength={120}
                    value={form.orderId}
                    placeholder="Copy from My orders"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        orderId: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="help-product">
                    Related product ID (optional)
                  </label>

                  <input
                    id="help-product"
                    maxLength={120}
                    value={form.productId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        productId: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="help-subject">Subject</label>

                  <input
                    id="help-subject"
                    required
                    maxLength={120}
                    value={form.subject}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        subject: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor="help-message">Message</label>

                  <textarea
                    id="help-message"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={5}
                    value={form.message}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        message: event.target.value,
                      })
                    }
                  />
                </div>

                <button className="button" type="submit">
                  {busy ? "Sending…" : "Send support request"}
                </button>
              </fieldset>

              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}

              {success && <p role="status">{success}</p>}
            </form>
          </section>

          <SupportInbox
            revision={revision}
            key={`${user.id || user._id}:${token}`}
          />
        </>
      )}
    </div>
  );
}