import { useState } from "react";
import { amount, Notice, request } from "./Shared.jsx";
import { parseStatement, remittanceStatuses, verifyPreview } from "../../services/remittanceStatement.js";

export default function RemittancePreview({ token }) {
  const [statement, setStatement] = useState("");
  const [lines, setLines] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function compare(event) {
    event.preventDefault();
    if (busy) return;
    setLines(null);
    setError("");
    setBusy(true);
    try {
      const rows = parseStatement(statement);
      const { preview } = await request("/admin/remittances/preview", { token, method: "POST", body: { currency: "INR", rows } });
      if (!verifyPreview(preview, rows)) throw new Error("Could not verify the comparison against the submitted statement.");
      setLines(preview.lines);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="mp-panel">
    <h2>Courier remittance comparison</h2>
    <p>Compare a courier statement with recorded marketplace COD collections. Only the pasted references are checked. Bank confirmation is separate.</p>
    <form className="mp-form" onSubmit={compare}>
      <label htmlFor="courier-statement">Statement rows</label>
      <p id="courier-statement-help">Paste up to 200 spreadsheet rows without headers. Copy the collection reference, net remittance (₹) and fee (₹), in that order. Use plain amounts and enter 0 for a confirmed zero fee.</p>
      <textarea id="courier-statement" aria-describedby="courier-statement-help" rows={4} maxLength={52000}
        disabled={busy} value={statement} onChange={event => { setStatement(event.target.value); setLines(null); setError(""); }} />
      <button className="button secondary" type="submit" disabled={busy || !statement.trim()}>{busy ? "Comparing…" : "Compare statement"}</button>
    </form>
    <Notice error={error} />
    {lines && <>
      <p role="status">{lines.filter(line => line.status === "matched").length} of {lines.length} rows matched. Difference is the statement gross (net plus fee) minus recorded cash.</p>
      <div className="mp-table-wrap"><table>
        <caption>Courier statement results</caption>
        <thead><tr>{["Reference", "Status", "Net", "Fee", "Recorded cash", "Difference"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{lines.map(line => <tr key={line.rowNumber}>
          <th scope="row">{line.reference}</th><td>{remittanceStatuses[line.status]}</td>
          <td>{amount(line.remittedPaise)}</td><td>{amount(line.feePaise)}</td>
          <td>{amount(line.recordedCollectionPaise)}</td><td>{amount(line.differencePaise)}</td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
