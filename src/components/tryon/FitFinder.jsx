import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import charts from '../../../scripts/config/fit-charts.json';
import { assessFit, chartProblem, convertMeasurement, MEASUREMENTS } from '../../utils/fit.js';
import { getVariantStock } from '../../utils/cartUtils.js';

export default function FitFinder({ product, color, onSelect }) {
  const chart = charts.products[String(product.id)] || product.fitProfile;
  const problem = chartProblem(chart, product.sizes || []);
  const [unit, setUnit] = useState('cm'), [values, setValues] = useState({});
  const [preference, setPreference] = useState('regular'), [result, setResult] = useState(null);
  const id = useId();
  const fields = chart?.requiredMeasurements?.filter(k => MEASUREMENTS[k]) || [];
  function changeUnit(next) {
    setValues(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? '' : String(Math.round(convertMeasurement(Number(v), unit, next) * 10) / 10)])));
    setUnit(next); setResult(null);
  }
  function submit(event) {
    event.preventDefault();
    const next = assessFit(chart, values, unit, preference, product.sizes || []);
    setResult(next);
    if (next.status === 'invalid') requestAnimationFrame(() => document.getElementById(`${id}-${Object.keys(next.errors)[0]}`)?.focus());
  }
  return <div className="fit-finder">
    <p className="try-eyebrow">Find your size</p><h3>Start with your measurements.</h3>
    <p className="try-muted">Compare your body measurements with this product’s supplier chart. A photo preview cannot measure tightness, stretch or comfort.</p>
    {problem ? <div className="try-notice"><strong>Measurement chart needed</strong><p>{problem} We won’t guess from your height, weight or photo.</p>
      <Link className="text-link" to={`/help?product=${encodeURIComponent(product.id)}`}>Ask for this product’s measurements →</Link></div> : <>
      <form onSubmit={submit} noValidate>
        <div className="fit-form-head"><span>Body measurements</span><div className="try-segment" aria-label="Measurement unit">
          <button type="button" aria-pressed={unit === 'cm'} onClick={() => changeUnit('cm')}>cm</button>
          <button type="button" aria-pressed={unit === 'in'} onClick={() => changeUnit('in')}>inches</button></div></div>
        <div className="fit-fields">{fields.map(key => <div key={key}>
          <label htmlFor={`${id}-${key}`}>{MEASUREMENTS[key].label} ({unit})</label>
          <input id={`${id}-${key}`} type="number" inputMode="decimal" step="0.1" value={values[key] || ''} aria-invalid={Boolean(result?.errors?.[key])}
            aria-describedby={`${id}-${key}-help`} onChange={e => { setValues({ ...values, [key]: e.target.value }); setResult(null); }} />
          <small id={`${id}-${key}-help`}>{result?.errors?.[key] || MEASUREMENTS[key].help}</small>
        </div>)}</div>
        <label htmlFor={`${id}-preference`}>If more than one size matches</label>
        <select id={`${id}-preference`} value={preference} onChange={e => {setPreference(e.target.value); setResult(null);}}>
          <option value="regular">Prefer the middle of the range</option><option value="closer">Prefer a closer fit</option><option value="roomier">Prefer more room</option></select>
        <p className="try-small">This preference only ranks sizes already within the supplier ranges. It does not simulate fabric or add arbitrary centimetres.</p>
        <button type="submit" className="button">Find my size</button>
        <button className="text-link" type="button" onClick={() => {setValues({});setResult(null);}}>Clear measurements</button>
      </form>
      {result && result.status !== 'invalid' && <div className="fit-result" role="status">
        <h4>{result.recommended ? `Suggested size: ${result.recommended}` : 'No confirmed size match'}</h4><p>{result.message}</p>
        {result.matches.map(row => {const stock = getVariantStock(product, row.label, color);return <div className="fit-match" key={row.label}>
          <span><strong>{row.label}</strong> · {stock > 0 ? `Available${color ? ` in ${color}` : ''}` : `Unavailable${color ? ` in ${color}` : ''}`}</span>
          {onSelect && <button type="button" className="button secondary" disabled={!stock} onClick={() => onSelect(row.label)}>Choose {row.label}</button>}
        </div>;})}
        <p className="try-small">A range match is guidance, not a guarantee. Fabric, cut and personal comfort still matter.</p>
      </div>}
      <div className="try-table-wrap"><table className="try-table"><caption>Supplier body ranges ({chart.unit}) · {chart.source}</caption>
        <thead><tr><th scope="col">Size</th>{fields.map(k => <th scope="col" key={k}>{MEASUREMENTS[k].label}</th>)}<th scope="col">Your match</th></tr></thead>
        <tbody>{chart.sizes.map(row => {const match = result?.rows?.find(r => r.label === String(row.label));return <tr key={row.label} className={match?.matches ? 'is-match' : ''}>
          <th scope="row">{row.label}</th>{fields.map(k => <td key={k}>{row.body[k].join('–')}{match && <small>{({within:'Within range',below:'Below range',above:'Above range'})[match.areas.find(a => a.key === k).position]}</small>}</td>)}
          <td>{match ? match.matches ? 'Matches' : 'Check measurements' : 'Enter measurements'}</td></tr>;})}</tbody></table></div>
    </>}
    <details className="try-guidance"><summary>How to measure</summary>{(fields.length ? fields : product.category === 'Gym Shoes' ? ['footLength','footWidth'] : ['chest','waist','hips']).map(k => <p key={k}><strong>{MEASUREMENTS[k].label}:</strong> {MEASUREMENTS[k].help}</p>)}</details>
    <p className="try-small">Your measurements stay in this window and are cleared when you close it. They are not sent to the image service.</p>
  </div>;
}