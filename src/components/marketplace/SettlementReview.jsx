import { useState } from "react";
import { amount, Empty, LoadingState, Notice, useMarketLoad } from "./Shared.jsx";

const explanations = {
  MISSING_ENTITLEMENT: "The purchased supplier item has no earnings record.",
  ENTITLEMENT_MISMATCH: "The earnings record differs from the purchased supplier or amount.",
  SHIPMENT_MEMBERSHIP_MISSING: "The supplier shipment does not include this purchased item.",
  INVALID_SETTLEMENT_SNAPSHOT: "The purchased settlement terms need review.",
  BALANCE_RECONCILIATION_REQUIRED: "The recorded balance differs from current eligibility. Review the supplier’s earnings.",
  UNMATCHED_ENTITLEMENT: "An earnings record has no corresponding purchased supplier item.",
};

function ReviewContents({ token, orderId }) {
  const load = useMarketLoad(`/admin/orders/${encodeURIComponent(orderId)}/settlement-review`, token);
  const review = load.data?.review;
  const valid = review?.orderId === orderId && review.currency === "INR" &&
    Number.isFinite(Date.parse(review.asOf)) && Array.isArray(review.lines) && Array.isArray(review.exceptions) &&
    review.lines.every(line => Number.isSafeInteger(line?.itemIndex) && line.itemIndex >= 0 &&
      (line.calculated?.reason == null || typeof line.calculated.reason === "string")) &&
    review.exceptions.every(issue => Number.isSafeInteger(issue?.itemIndex) && issue.itemIndex >= 0 && typeof issue.code === "string");
  return <LoadingState load={load}>
    {valid ? <>
      <p>Checked {new Date(review.asOf).toLocaleString("en-IN")}</p>
      {review.exceptions.length > 0 && <ul aria-label="Settlement differences">
        {review.exceptions.map((issue, index) => <li key={index}>
          Item {issue.itemIndex + 1} · {explanations[issue.code] || "Review this item’s settlement records."}
        </li>)}
      </ul>}
      {review.lines.length ? <div className="mp-table-wrap"><table>
        <caption>Supplier earnings across this order</caption>
        <thead><tr>{["Item", "Purchased payable", "Recorded eligible", "Calculated eligible", "Recorded paid", "Eligibility"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{review.lines.map(line => <tr key={line.itemIndex}>
          <th scope="row">{line.itemIndex + 1}</th><td>{amount(line.purchasedPayablePaise)}</td>
          <td>{amount(line.recorded?.eligiblePaise)}</td><td>{amount(line.calculated?.eligiblePaise)}</td>
          <td>{amount(line.recorded?.paidPaise)}</td><td>{line.calculated?.reason || "Requires record review"}</td>
        </tr>)}</tbody>
      </table></div> : <Empty>No purchased supplier earnings on this order.</Empty>}
    </> : <Notice error="The settlement review could not be verified for this order."/>}
    <button className="button secondary" type="button" onClick={load.reload}>Refresh settlement review</button>
  </LoadingState>;
}

export default function SettlementReview({ token, orderId }) {
  const [open, setOpen] = useState(false);
  return <details className="mp-section" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Review order settlement</summary>
    {open && <ReviewContents key={orderId} token={token} orderId={orderId}/>}
  </details>;
}
