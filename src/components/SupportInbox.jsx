import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { supportRequest } from "../services/supportApi.js";

function formatDate(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString("en-IN");
}

function InboxWorkspace({ token, admin, revision }) {
  const prefix = admin ? "/admin/tickets" : "";

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");

  const [selected, setSelected] = useState("");
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState("");

  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [listRevision, setListRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);

  const mounted = useRef(false);
  const lock = useRef(false);
  const pending = useRef(null);
  const activeSelection = useRef(selected);
  const detailGeneration = useRef(0);

  activeSelection.current = selected;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      detailGeneration.current += 1;
    };
  }, []);

  // Load the ticket list.
  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
    });

    if (status) params.set("status", status);

    async function loadList() {
      try {
        const data = await supportRequest(
          token,
          `${prefix}?${params}`,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        if (!Array.isArray(data.tickets)) {
          throw new Error("The ticket list could not be read.");
        }

        const parsedPages = Number(data.pages);

        const nextPages =
          Number.isSafeInteger(parsedPages) && parsedPages > 0
            ? parsedPages
            : 1;

        setPages(nextPages);

        if (page > nextPages) {
          setPage(nextPages);
          return;
        }

        setItems(data.tickets);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure.message || "Unable to load requests.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadList();

    return () => controller.abort();
  }, [
    token,
    prefix,
    page,
    status,
    revision,
    listRevision,
  ]);

  // Refresh the selected conversation without clearing its draft.
  useEffect(() => {
    const controller = new AbortController();
    const generation = ++detailGeneration.current;

    if (!selected) {
      setDetailLoading(false);
      return () => controller.abort();
    }

    setDetailLoading(true);
    setDetailError("");

    async function loadConversation() {
      try {
        const data = await supportRequest(
          token,
          `${prefix}/${encodeURIComponent(selected)}`,
          { signal: controller.signal },
        );

        if (
          controller.signal.aborted ||
          generation !== detailGeneration.current
        ) {
          return;
        }

        if (
          !data.ticket ||
          String(data.ticket.id) !== String(selected) ||
          !Array.isArray(data.ticket.messages)
        ) {
          throw new Error("The conversation could not be read.");
        }

        setTicket(data.ticket);
      } catch (failure) {
        if (
          !controller.signal.aborted &&
          generation === detailGeneration.current
        ) {
          setDetailError(
            failure.message || "Unable to load this conversation.",
          );
        }
      } finally {
        if (
          !controller.signal.aborted &&
          generation === detailGeneration.current
        ) {
          setDetailLoading(false);
        }
      }
    }

    loadConversation();

    return () => controller.abort();
  }, [
    token,
    prefix,
    selected,
    revision,
    detailRevision,
  ]);

  function refreshInbox() {
    if (lock.current) return;

    setListRevision((value) => value + 1);
    setDetailRevision((value) => value + 1);
  }

  function chooseConversation(id) {
    if (lock.current || id === selected) return;

    if (
      reply.trim() &&
      !window.confirm("Discard your unsent reply and change conversation?")
    ) {
      return;
    }

    detailGeneration.current += 1;
    pending.current = null;
    setReply("");
    setTicket(null);
    setDetailError("");
    setSelected(id);
  }

  async function mutate(kind, value) {
    if (
      lock.current ||
      !ticket ||
      detailLoading ||
      ticket.id !== selected
    ) {
      return;
    }

    if (kind === "status" && !admin) return;

    const capturedId = selected;

    lock.current = true;
    setBusy(true);
    setDetailError("");

    // Prevent an older detail fetch from overwriting this update.
    detailGeneration.current += 1;

    try {
      let body;

      if (kind === "replies") {
        const message = String(value).trim();

        if (message.length < 2 || message.length > 2000) {
          throw new Error("Enter a reply of 2–2,000 characters.");
        }

        if (
          !pending.current ||
          pending.current.message !== message ||
          pending.current.ticketId !== capturedId
        ) {
          pending.current = {
            ticketId: capturedId,
            requestId: crypto.randomUUID(),
            message,
          };
        }

        body = {
          requestId: pending.current.requestId,
          message: pending.current.message,
        };
      } else {
        if (!["open", "waiting", "resolved"].includes(value)) {
          throw new Error("Choose a valid support status.");
        }

        body = { status: value };
      }

      const data = await supportRequest(
        token,
        `${prefix}/${encodeURIComponent(capturedId)}/${kind}`,
        {
          method: kind === "replies" ? "POST" : "PUT",
          body,
        },
      );

      if (
        !mounted.current ||
        activeSelection.current !== capturedId
      ) {
        return;
      }

      if (
        !data.ticket ||
        String(data.ticket.id) !== String(capturedId) ||
        !Array.isArray(data.ticket.messages)
      ) {
        throw new Error(
          "The updated conversation was not returned. Refresh to check whether your change was saved.",
        );
      }

      setTicket(data.ticket);
      setListRevision((current) => current + 1);

      if (kind === "replies") {
        setReply("");
        pending.current = null;
      }
    } catch (failure) {
      if (
        mounted.current &&
        activeSelection.current === capturedId
      ) {
        setDetailError(
          failure.message || "Unable to save this update.",
        );
      }
    } finally {
      lock.current = false;

      if (mounted.current) {
        setBusy(false);
        setDetailLoading(false);
      }
    }
  }

  return (
    <section
      aria-label={
        admin ? "Customer support inbox" : "Your support requests"
      }
    >
      <div className="panel-heading">
        <h2>{admin ? "Customer requests" : "Your requests"}</h2>

        <button
          type="button"
          className="button secondary compact"
          disabled={loading || detailLoading || busy}
          onClick={refreshInbox}
        >
          Refresh inbox and conversation
        </button>
      </div>

      {admin && (
        <div className="field">
          <label htmlFor="support-status-filter">Filter status</label>
          <select
            id="support-status-filter"
            disabled={busy}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="open">Open — needs attention</option>
            <option value="waiting">Waiting for customer</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      )}

      {loading && <p role="status">Loading requests…</p>}

      {error && (
        <p className="field-error" role="alert">{error}</p>
      )}

      {!loading && !error && !items.length && (
        <p>No requests in this view.</p>
      )}

      {!loading && !error && (
        <div>
          {items.map((item) => (
            <article className="panel" key={item.id}>
              <div className="panel-heading">
                <h3>{item.subject}</h3>
                <span className="status-pill">{item.status}</span>
              </div>

              <p>
                {item.category} · {formatDate(item.updatedAt)}
              </p>

              {admin && <p>{item.email}</p>}

              <button
                type="button"
                className="button secondary compact"
                disabled={busy}
                aria-pressed={selected === item.id}
                onClick={() => {
                  if (selected === item.id) {
                    setDetailRevision((value) => value + 1);
                  } else {
                    chooseConversation(item.id);
                  }
                }}
              >
                {selected === item.id
                  ? "Refresh this conversation"
                  : "Open conversation"}
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="purchase-actions">
        <button
          type="button"
          className="button secondary compact"
          disabled={loading || busy || page <= 1}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>

        <span>Page {page} of {pages}</span>

        <button
          type="button"
          className="button secondary compact"
          disabled={loading || busy || page >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>

      {selected && (
        <section
          className="panel"
          aria-label="Selected conversation"
          aria-busy={busy || detailLoading}
        >
          <div className="purchase-actions">
            <button
              type="button"
              className="button secondary compact"
              disabled={busy}
              onClick={() => chooseConversation("")}
            >
              Close conversation
            </button>

            <button
              type="button"
              className="button secondary compact"
              disabled={busy || detailLoading}
              onClick={() =>
                setDetailRevision((value) => value + 1)
              }
            >
              Refresh conversation
            </button>
          </div>

          {detailLoading && (
            <p role="status">Loading conversation…</p>
          )}

          {detailError && (
            <div className="field-error" role="alert">
              <p>{detailError}</p>
              <p>
                Refresh to check whether your message was saved.
                Retrying the same unchanged reply uses its original
                request ID to avoid duplicates.
              </p>
            </div>
          )}

          {ticket && ticket.id === selected && (
            <>
              <h3>{ticket.subject}</h3>
              <p className="order-id">Ticket: {ticket.id}</p>
              <p>Status: {ticket.status}</p>

              {ticket.orderId && (
                <p>
                  Order:{" "}
                  <Link
                    to={
                      admin
                        ? "/admin/orders"
                        : `/orders/${encodeURIComponent(ticket.orderId)}`
                    }
                  >
                    {ticket.orderId}
                  </Link>
                </p>
              )}

              {ticket.productId && (
                <p>Product reference: {ticket.productId}</p>
              )}

              {ticket.messages.map((message) => (
                <div
                  className={`support-message ${
                    message.by === "store" ? "store" : "customer"
                  }`}
                  key={message.id}
                >
                  <strong>
                    {message.by === "store"
                      ? "GymDrobe support"
                      : admin
                        ? "Customer"
                        : "You"}
                  </strong>

                  <p
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {message.text}
                  </p>

                  <small>{formatDate(message.createdAt)}</small>
                </div>
              ))}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  mutate("replies", reply);
                }}
              >
                <div className="field">
                  <label htmlFor="support-reply">
                    {ticket.status === "resolved"
                      ? "Reply to reopen this conversation"
                      : "Reply"}
                  </label>

                  <textarea
                    id="support-reply"
                    disabled={busy || detailLoading}
                    required
                    minLength={2}
                    maxLength={2000}
                    rows={4}
                    value={reply}
                    onChange={(event) =>
                      setReply(event.target.value)
                    }
                  />
                </div>

                <button
                  className="button"
                  type="submit"
                  disabled={busy || detailLoading}
                >
                  {busy ? "Saving…" : "Send reply"}
                </button>
              </form>

              {admin && (
                <div className="purchase-actions">
                  {["open", "waiting", "resolved"].map((value) => (
                    <button
                      type="button"
                      className="button secondary compact"
                      key={value}
                      disabled={
                        busy ||
                        detailLoading ||
                        ticket.status === value
                      }
                      onClick={() => mutate("status", value)}
                    >
                      Mark {value}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}

export default function SupportInbox({
  admin = false,
  revision = 0,
}) {
  const {
    token,
    user,
    loading,
    authError,
    retrySession,
  } = useAuth();

  if (loading) {
    return <p role="status">Checking your session…</p>;
  }

  if (authError) {
    return (
      <section className="panel">
        <p className="field-error" role="alert">{authError}</p>
        <button
          type="button"
          className="button secondary"
          onClick={retrySession}
        >
          Retry session
        </button>
      </section>
    );
  }

  if (!user || !token) {
    return <p>Sign in to view support requests.</p>;
  }

  if (admin && user.role !== "admin") {
    return <p>Admin access is required to view customer requests.</p>;
  }

  return (
    <InboxWorkspace
      key={`${user.id || user._id}:${token}:${admin}`}
      token={token}
      admin={admin}
      revision={revision}
    />
  );
}