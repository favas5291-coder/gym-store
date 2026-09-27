// Measurements stay in component state; this module never stores or uploads them.
export const MEASUREMENTS = {
  chest: { label: 'Chest', help: 'Measure around the fullest part of your chest. Keep the tape level and comfortably close.', min: 30, max: 250 },
  waist: { label: 'Waist', help: 'Measure around your natural waist without pulling the tape tight.', min: 25, max: 250 },
  hips: { label: 'Hips', help: 'Measure around the fullest part of your hips, keeping the tape level.', min: 30, max: 270 },
  shoulder: { label: 'Shoulder width', help: 'Measure across your back between the ends of your shoulders.', min: 10, max: 100 },
  inseam: { label: 'Inside leg', help: 'Measure down the inside of your leg from the crotch to your intended hem.', min: 15, max: 130 },
  footLength: { label: 'Foot length', help: 'Standing on paper, mark heel and longest toe. Measure both feet and use the longer measurement.', min: 8, max: 40 },
  footWidth: { label: 'Foot width', help: 'Standing on paper, measure across the widest part of each foot and use the larger measurement.', min: 3, max: 20 },
};
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function chartProblem(chart, productSizes = []) {
  if (!chart || chart.verified !== true || !String(chart.source || '').trim()) return 'The supplier’s verified measurement chart is not available yet.';
  if (chart.basis !== 'body' || !['cm', 'in'].includes(chart.unit)) return 'This chart needs body-measurement ranges before we can recommend a size.';
  const keys = chart.requiredMeasurements;
  if (!Array.isArray(keys) || !keys.length || new Set(keys).size !== keys.length || keys.some(k => !MEASUREMENTS[k])) return 'The measurement chart is incomplete.';
  if (!Array.isArray(chart.sizes) || !chart.sizes.length) return 'The measurement chart has no size ranges.';
  const labels = new Set();
  for (const row of chart.sizes) {
    if (!row || !String(row.label || '').trim() || labels.has(String(row.label))) return 'The measurement chart has invalid size labels.';
    labels.add(String(row.label));
    if (productSizes.length && !productSizes.map(String).includes(String(row.label))) return 'The supplier chart does not match this product’s size labels.';
    for (const key of keys) {
      const range = row.body?.[key];
      if (!Array.isArray(range) || range.length !== 2 || !range.every(finite) || range[0] <= 0 || range[1] < range[0]) return 'The measurement chart contains an invalid range.';
    }
  }
  return '';
}
export const convertMeasurement = (value, from, to) => from === to ? value : from === 'in' ? value * 2.54 : value / 2.54;
export function assessFit(chart, measurements, unit = 'cm', preference = 'regular', productSizes = []) {
  const problem = chartProblem(chart, productSizes);
  if (problem) return { status: 'unavailable', message: problem, errors: {}, rows: [], matches: [] };
  const errors = {}, values = {};
  if (!['cm', 'in'].includes(unit)) return { status: 'invalid', errors: { unit: 'Choose cm or inches.' }, rows: [], matches: [] };
  for (const key of chart.requiredMeasurements) {
    const raw = measurements[key], n = Number(raw), cm = convertMeasurement(n, unit, 'cm'), spec = MEASUREMENTS[key];
    if (raw == null || String(raw).trim() === '' || !Number.isFinite(n) || cm < spec.min || cm > spec.max) errors[key] = `Check your ${spec.label.toLowerCase()} measurement and unit.`;
    else values[key] = convertMeasurement(n, unit, chart.unit);
  }
  if (Object.keys(errors).length) return { status: 'invalid', errors, rows: [], matches: [] };
  const target = preference === 'closer' ? .7 : preference === 'roomier' ? .3 : .5;
  const rows = chart.sizes.map(row => {
    const areas = chart.requiredMeasurements.map(key => {
      const [min, max] = row.body[key], value = values[key];
      return { key, min, max, value, position: value < min - .001 ? 'below' : value > max + .001 ? 'above' : 'within' };
    });
    const matches = areas.every(a => a.position === 'within');
    const score = areas.reduce((total, a) => total + Math.abs((a.value - a.min) / Math.max(a.max - a.min, 1) - target), 0);
    return { label: String(row.label), areas, matches, score, note: row.note || '' };
  });
  const matches = rows.filter(r => r.matches).sort((a, b) => a.score - b.score);
  return { status: matches.length ? 'matched' : 'no-match', errors, rows, matches,
    recommended: matches[0]?.label || null, unit: chart.unit,
    message: matches.length ? 'Your measurements fall within these supplier ranges.' : 'No size covers all of your measurements in this chart. Ask us for help before choosing.' };
}