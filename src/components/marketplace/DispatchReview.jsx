import { useState } from "react";
import { LoadingState, useMarketLoad } from "./Shared.jsx";

const timingLabels = { overdue: "Overdue", unknown: "Timing unknown", "within-window": "Within window" };
const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
});

function DispatchPage({ token, supplierId, cursor, advance, back }) {
  const params = new URLSearchParams({ source: "real" });
  if (supplierId) params.set("supplier", supplierId);
  if (cursor) params.set("after", cursor);
  const load = useMarketLoad("/dispatch-review?" + params, token);
  return <LoadingState load={load}>{load.data && <>
    {load.data.rows.length === 0 ? <p>No eligible dispatches on this page.</p> :
      <ul>{load.data.rows.map(row => <li key={row.fulfilmentId}>
        <strong>{timingLabels[row.timing] || "Timing unknown"}</strong> · Order {row.orderId}
        {row.dueAt && <div>Earliest known deadline {dateTime.format(new Date(row.dueAt))} IST</div>}
        {row.unknownItems > 0 && <div>Missing timing for {row.unknownItems} purchased {row.unknownItems === 1 ? "line" : "lines"}</div>}
      </li>)}</ul>}
    <div className="mp-actions">
      {cursor && <button className="button secondary" type="button" onClick={back}>Previous page</button>}
      {load.data.nextCursor && <button className="button secondary" type="button" onClick={() => advance(load.data.nextCursor)}>Next page</button>}
      <button className="button secondary" type="button" onClick={load.reload}>Refresh dispatch review</button>
    </div>
  </>}</LoadingState>;
}

export default function DispatchReview({ token, supplierId }) {
  const [pages, setPages] = useState([]);
  const cursor = pages.at(-1);
  return <section className="mp-panel" aria-label="Dispatch timing">
    <h2>Dispatch timing</h2>
    <p>Check open real orders against the dispatch clock agreed at purchase. Missing terms or payment verification leave timing unknown, including confirmed full-COD orders awaiting collection.</p>
    {pages.length === 0 ? <button className="button secondary" type="button" onClick={() => setPages([null])}>Review dispatch timing</button> :
      <DispatchPage key={cursor || "first"} token={token} supplierId={supplierId} cursor={cursor}
        advance={next => setPages(current => [...current, next])} back={() => setPages(current => current.slice(0, -1))} />}
  </section>;
}
