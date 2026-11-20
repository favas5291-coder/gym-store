import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { adminRequest } from "../services/adminApi.js";
import "./AdminDashboardPage.css";
import "./AdminAutomationPage.css";

const endpoint = "/admin/automation";
const statuses = {
  needs_review: "Needs review",
  failed: "Failed",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
};

const explanations = {
  ORDER_MISSING: "The saved order could not be found. Review its ID before rechecking.",
  SUPPLIER_SNAPSHOT_INVALID: "The order contains incomplete supplier details. Review the purchased item’s saved supplier information.",
  FULFILMENT_MISMATCH: "The supplier fulfilment records differ from the order. Review the assigned supplier and items.",
  ENTITLEMENT_MISMATCH: "The supplier entitlement differs from the purchased amount. Review the supplier’s order and entitlement records.",
  RETRYABLE_READ_FAILURE: "A database read failed. Check database availability before rechecking the order.",
  LEASE_EXHAUSTED: "The worker could not finish after repeated attempts. Check the worker and database before rechecking.",
};

function time(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
  });
}

function readOverview(data) {
  const totalValid = Object.keys(statuses).every(key =>
    Number.isSafeInteger(data.counts?.[key]) && data.counts[key] >= 0);
  if (typeof data.enabled !== "boolean" || typeof data.workerEnabled !== "boolean" ||
      !Array.isArray(data.jobs) || !totalValid) {
    throw new Error("The automation server returned an incomplete queue summary.");
  }
  return data;
}

function JobRow({ job, busy, retry }) {
  const recoverable = job.status === "failed" || job.status === "needs_review";
  return (
    <li>
      <div className="automation-job-title">
        <strong>Order {job.orderId}</strong>
        <span className="automation-status" data-state={job.status}>
          {statuses[job.status] || job.status}
        </span>
      </div>
      <p>{job.type === "order.fulfilment.check.v1" ? "Check supplier fulfilment records" : job.type}</p>
      {job.lastError && <p className="automation-error">{explanations[job.lastError] || job.lastError}</p>}
      <details>
        <summary>Check details</summary>
        <dl className="automation-record">
          <dt>Job ID</dt><dd>{job.id}</dd>
          {job.lastError && <><dt>Issue code</dt><dd>{job.lastError}</dd></>}
          <dt>Attempts</dt><dd>{job.attempts}</dd>
          <dt>Created</dt><dd>{time(job.createdAt)}</dd>
          <dt>Updated</dt><dd>{time(job.updatedAt)}</dd>
          {job.status === "queued" && <><dt>Next attempt</dt><dd>{time(job.nextRunAt)}</dd></>}
        </dl>
        {job.history?.length > 0 && <ol className="automation-history" aria-label="Check history">
          {job.history.map((event, index) => <li key={index}>
            {time(event.at)} · {statuses[event.action] || event.action}{event.code && ` · ${event.code}`}
          </li>)}
        </ol>}
      </details>
      {recoverable && (
        <button className="button secondary" type="button" disabled={busy}
          onClick={() => retry(job.id)} aria-label={`Recheck order ${job.orderId}`}>
          Recheck order
        </button>
      )}
    </li>
  );
}

export default function AdminAutomationPage() {
  const { token } = useAuth();
  const [orderId, setOrderId] = useState("");
  const [status, setStatus] = useState("");
  const [cursors, setCursors] = useState([]);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");
  const writing = useRef(false);
  const cursor = cursors.at(-1) || "";
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (cursor) params.set("before", cursor);
  const query = params.toString();
  const key = `${revision}:${query}`;
  const current = result?.key === key ? result : null;
  const overview = current?.data;

  useEffect(() => {
    const controller = new AbortController();
    adminRequest(query ? `${endpoint}?${query}` : endpoint, token, { signal: controller.signal })
      .then(readOverview)
      .then(data => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch(error => {
        if (!controller.signal.aborted) setResult({ key, error: error.message });
      });
    return () => controller.abort();
  }, [token, key, query]);

  function refresh() {
    setRevision(value => value + 1);
  }

  async function run(action, id) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setNotice("");
    setMutationError("");
    try {
      if (action !== "process") {
        const path = action === "retry" ? `jobs/${encodeURIComponent(id)}/retry` : `orders/${encodeURIComponent(id)}/reconcile`;
        const response = await adminRequest(`${endpoint}/${path}`, token, { method: "POST" });
        if (!response.queued) throw new Error("The server did not confirm the recheck.");
        setNotice("Order check queued.");
        if (action === "reconcile") setOrderId("");
      } else {
        const response = await adminRequest(endpoint + "/process", token, { method: "POST" });
        if (!Number.isSafeInteger(response.processed) || response.processed < 0) {
          throw new Error("The server did not confirm the processed count.");
        }
        setNotice(`${response.processed} ${response.processed === 1 ? "check" : "checks"} processed.`);
      }
    } catch (error) {
      setMutationError(error.message);
    } finally {
      writing.current = false;
      setBusy(false);
      refresh();
    }
  }

  return (
    <div className="page gd-admin-page automation-page">
      <div className="gd-admin-heading">
        <div><h1>Automation</h1><p>Check supplier fulfilment records for confirmed orders.</p></div>
        <button className="button secondary" type="button" disabled={busy || !current} onClick={refresh}>Refresh</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {mutationError && <p role="alert">{mutationError}</p>}
      {!current && <p role="status">Loading queue…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {overview && !overview.enabled && <p>Automation is turned off on the server.</p>}
      {overview?.enabled && (
        <>
          <dl className="automation-counts" aria-label="Queue totals">
            {Object.entries(statuses).map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{overview.counts[key]}</dd></div>
            ))}
          </dl>
          <section className="automation-worker">
            <div>
              <h2>Worker</h2>
              <p>{overview.workerEnabled ? "Automatic processing enabled" : "Manual processing"}</p>
              <p>Last completed check (IST) · {overview.lastSuccessAt ? time(overview.lastSuccessAt) : "None recorded"}</p>
            </div>
            <button type="button" className="button" disabled={busy} onClick={() => run("process")}>
              {busy ? "Working…" : "Process pending checks"}
            </button>
          </section>
          <details className="automation-manual">
            <summary>Check an existing order</summary>
            <form onSubmit={event => {
              event.preventDefault();
              run("reconcile", orderId.trim());
            }}>
              <label>Order database ID
                <input value={orderId} onChange={event => setOrderId(event.target.value)}
                  required pattern="[a-fA-F0-9]{24}" title="Enter the 24-character hexadecimal order ID"
                  autoComplete="off" maxLength={24} />
              </label>
              <button type="submit" className="button secondary" disabled={busy}>Queue order check</button>
            </form>
          </details>
          <section aria-labelledby="job-heading">
            <div className="automation-toolbar">
              <h2 id="job-heading">Order checks</h2>
              <div><label htmlFor="automation-status">Status </label><select id="automation-status" value={status} disabled={busy} onChange={event => {
                setStatus(event.target.value);
                setCursors([]);
              }}>
                <option value="">All statuses</option>
                {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select></div>
            </div>
            {overview.jobs.length ? <ul className="automation-jobs">{overview.jobs.map(job =>
              <JobRow key={job.id} job={job} busy={busy} retry={id => run("retry", id)} />)}</ul> : <p>No checks in this view.</p>}
            {(cursor || overview.nextCursor) && <nav className="automation-pages" aria-label="Queue pages">
              <button type="button" className="button secondary" disabled={busy || !cursor}
                onClick={() => setCursors(items => items.slice(0, -1))}>Previous</button>
              <button type="button" className="button secondary" disabled={busy || !overview.nextCursor}
                onClick={() => setCursors(items => [...items, overview.nextCursor])}>Next</button>
            </nav>}
          </section>
        </>
      )}
    </div>
  );
}
