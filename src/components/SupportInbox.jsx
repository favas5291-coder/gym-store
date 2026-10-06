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
  supportRequest,
} from "../services/supportApi.js";

export default function SupportInbox({
  admin = false,
  revision = 0,
}) {
  const { token, user } = useAuth();

  const prefix = admin
    ? "/admin/tickets"
    : "";

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState("");
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const [detailError, setDetailError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const lock = useRef(false);
  const pending = useRef(null);

  const current = useRef({
    token,
    selected,
  });

  current.current = {
    token,
    selected,
  };

  useEffect(() => {
    current.current = {
      token,
      selected,
    };

    return () => {
      current.current = {};
    };
  }, [token, selected]);

  // Load the current page of requests.
  useEffect(() => {
    const controller =
      new AbortController();

    setError("");
    setLoading(true);
    setItems([]);

    supportRequest(
      token,
      `${prefix}?page=${page}${
        status ? `&status=${status}` : ""
      }`,
      {
        signal: controller.signal,
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setItems(data.tickets);
          setPages(data.pages);
        }
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(loadError.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    token,
    prefix,
    page,
    status,
    revision,
    refresh,
  ]);

  // Load the selected conversation.
  useEffect(() => {
    setTicket(null);
    setDetailError("");
    setReply("");
    pending.current = null;

    if (!selected) {
      setDetailLoading(false);
      return;
    }

    const controller =
      new AbortController();

    setDetailLoading(true);

    supportRequest(
      token,
      `${prefix}/${encodeURIComponent(selected)}`,
      {
        signal: controller.signal,
      },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setTicket(data.ticket);
        }
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setDetailError(
            loadError.message,
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      });

    return () => controller.abort();
  }, [token, prefix, selected]);

  async function mutate(kind, value) {
    if (
      lock.current ||
      !ticket ||
      detailLoading
    ) {
      return;
    }

    lock.current = true;
    setBusy(true);
    setDetailError("");

    const captured = {
      token,
      selected,
    };

    try {
      let body;

      if (kind === "replies") {
        const message = value.trim();

        if (
          message.length < 2 ||
          message.length > 2000
        ) {
          throw new Error(
            "Enter a reply of 2–2000 characters.",
          );
        }

        if (
          !pending.current ||
          pending.current.message !== message
        ) {
          pending.current = {
            requestId: crypto.randomUUID(),
            message,
          };
        }

        body = pending.current;
      } else {
        body = {
          status: value,
        };
      }

      const data = await supportRequest(
        token,
        `${prefix}/${encodeURIComponent(
          selected,
        )}/${kind}`,
        {
          method:
            kind === "replies"
              ? "POST"
              : "PUT",
          body,
        },
      );

      if (
        current.current.token !==
          captured.token ||
        current.current.selected !==
          captured.selected
      ) {
        return;
      }

      setTicket(data.ticket);
      setRefresh((value) => value + 1);

      if (kind === "replies") {
        setReply("");
        pending.current = null;
      }
    } catch (saveError) {
      if (
        current.current.token ===
          captured.token &&
        current.current.selected ===
          captured.selected
      ) {
        setDetailError(
          saveError.message,
        );
      }
    } finally {
      lock.current = false;

      if (
        current.current.token ===
        captured.token
      ) {
        setBusy(false);
      }
    }
  }

  if (!user || !token) {
    return (
      <p>
        Sign in to view support requests.
      </p>
    );
  }

  return (
    <section
      aria-label={
        admin
          ? "Customer support inbox"
          : "Your support requests"
      }
    >
      <div className="panel-heading">
        <h2>
          {admin
            ? "Customer requests"
            : "Your requests"}
        </h2>

        <button
          type="button"
          className="button secondary compact"
          disabled={loading || busy}
          onClick={() =>
            setRefresh((value) => value + 1)
          }
        >
          Refresh inbox
        </button>
      </div>

      {admin && (
        <div className="field">
          <label htmlFor="support-status-filter">
            Filter status
          </label>

          <select
            id="support-status-filter"
            disabled={busy}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              All statuses
            </option>

            <option value="open">
              Open — needs attention
            </option>

            <option value="waiting">
              Waiting for customer
            </option>

            <option value="resolved">
              Resolved
            </option>
          </select>
        </div>
      )}

      {loading && (
        <p role="status">
          Loading requests…
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

      {!loading &&
        !error &&
        !items.length && (
          <p>No requests in this view.</p>
        )}

      <div>
        {items.map((item) => (
          <article
            className="panel"
            key={item.id}
          >
            <div className="panel-heading">
              <h3>{item.subject}</h3>

              <span className="status-pill">
                {item.status}
              </span>
            </div>

            <p>
              {item.category} ·{" "}
              {new Date(
                item.updatedAt,
              ).toLocaleString("en-IN")}
            </p>

            {admin && <p>{item.email}</p>}

            <button
              type="button"
              className="button secondary compact"
              disabled={busy}
              onClick={() =>
                setSelected(item.id)
              }
            >
              Open conversation
            </button>
          </article>
        ))}
      </div>

      <div className="purchase-actions">
        <button
          type="button"
          className="button secondary compact"
          disabled={
            loading ||
            busy ||
            page <= 1
          }
          onClick={() =>
            setPage((value) => value - 1)
          }
        >
          Previous
        </button>

        <span>
          Page {page} of {pages}
        </span>

        <button
          type="button"
          className="button secondary compact"
          disabled={
            loading ||
            busy ||
            page >= pages
          }
          onClick={() =>
            setPage((value) => value + 1)
          }
        >
          Next
        </button>
      </div>

      {selected && (
        <section
          className="panel"
          aria-label="Selected conversation"
        >
          <button
            type="button"
            className="button secondary compact"
            disabled={busy}
            onClick={() =>
              setSelected("")
            }
          >
            Close conversation
          </button>

          {detailLoading && (
            <p role="status">
              Loading conversation…
            </p>
          )}

          {detailError && (
            <p
              className="field-error"
              role="alert"
            >
              {detailError}
            </p>
          )}

          {!ticket &&
            !detailLoading &&
            detailError && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  const id = selected;

                  setSelected("");

                  setTimeout(() => {
                    if (
                      current.current.token ===
                      token
                    ) {
                      setSelected(id);
                    }
                  }, 0);
                }}
              >
                Retry conversation
              </button>
            )}

          {ticket && (
            <>
              <h3>{ticket.subject}</h3>

              <p className="order-id">
                Ticket: {ticket.id}
              </p>

              <p>
                Status: {ticket.status}
              </p>

              {ticket.orderId && (
                <p>
                  Order:{" "}
                  <Link
                    to={
                      admin
                        ? "/admin/orders"
                        : `/orders/${encodeURIComponent(
                            ticket.orderId,
                          )}`
                    }
                  >
                    {ticket.orderId}
                  </Link>
                </p>
              )}

              {ticket.productId && (
                <p>
                  Product reference:{" "}
                  {ticket.productId}
                </p>
              )}

              {ticket.messages.map(
                (message) => (
                  <div
                    className={`support-message ${message.by}`}
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

                    <small>
                      {new Date(
                        message.createdAt,
                      ).toLocaleString("en-IN")}
                    </small>
                  </div>
                ),
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  mutate("replies", reply);
                }}
              >
                <div className="field">
                  <label htmlFor="support-reply">
                    {ticket.status ===
                    "resolved"
                      ? "Reply to reopen this conversation"
                      : "Reply"}
                  </label>

                  <textarea
                    id="support-reply"
                    disabled={busy}
                    required
                    minLength={2}
                    maxLength={2000}
                    rows={4}
                    value={reply}
                    onChange={(event) =>
                      setReply(
                        event.target.value,
                      )
                    }
                  />
                </div>

                <button
                  className="button"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : "Send reply"}
                </button>
              </form>

              {admin && (
                <div className="purchase-actions">
                  {[
                    "open",
                    "waiting",
                    "resolved",
                  ].map((value) => (
                    <button
                      type="button"
                      className="button secondary compact"
                      key={value}
                      disabled={
                        busy ||
                        ticket.status === value
                      }
                      onClick={() =>
                        mutate(
                          "status",
                          value,
                        )
                      }
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