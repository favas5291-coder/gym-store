import { useEffect, useState } from "react";
import { brandKey } from "../utils/brandIdentity.js";
import { brandLogoUrl, changeBrandLogo, getAdminBrands, getBrandLogoPreview } from "../services/productApi.js";

const statuses = {
  idle: "No suggestion yet",
  queued: "Logo lookup queued",
  searching: "Checking the official source…",
  review: "Artwork ready to review",
  unavailable: "No usable official match. Upload an approved logo or retry.",
};

function readArtwork(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 512 * 1024) {
    return Promise.reject(new Error("Choose a PNG, JPEG or WebP logo up to 512 KB."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ mime: file.type, base64: String(reader.result).split(",")[1] });
    reader.onerror = () => reject(new Error("The image could not be opened."));
    reader.readAsDataURL(file);
  });
}

function Candidate({ brand, token }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let url;
    getBrandLogoPreview(brand.key, brand.candidate.media, token, controller.signal)
      .then(blob => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [brand.key, brand.candidate.media, token]);

  return <div>
    {preview && <img className="ap-brand-preview" src={preview} alt={`Suggested logo for ${brand.name}`} />}
    {error && <p role="alert">Logo preview could not be loaded.</p>}
    {brand.candidate.source && <a href={brand.candidate.source} target="_blank" rel="noreferrer">Artwork source</a>}
  </div>;
}

export default function AdminBrandLogos({ token, catalogueRevision }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState("");
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const brand = rows.find(row => row.key === selected);
  const processing = rows.some(row => ["queued", "searching"].includes(row.status));

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const refresh = () => getAdminBrands(token, controller.signal).then(setRows).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    refresh();
    const timer = setInterval(refresh, processing ? 3000 : 12000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [open, token, revision, catalogueRevision, processing]);

  async function perform(work, message) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setRevision(value => value + 1);
      setPending(false);
    }
  }

  function add(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("name");
    perform(async () => {
      await changeBrandLogo("", token, { name });
      setSelected(brandKey(name));
      form.reset();
    }, "Brand saved.");
  }

  function upload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    perform(async () => {
      const artwork = await readArtwork(data.get("artwork"));
      await changeBrandLogo("/upload", token, { ...artwork, source: data.get("source"), name: brand.name, revision: brand.revision });
      form.reset();
    }, "Artwork uploaded for review.");
  }

  function review(action, message) {
    perform(() => changeBrandLogo(`/${encodeURIComponent(brand.key)}/${action}`, token, { revision: brand.revision }), message);
  }

  return <details className="ap-brand-logos" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Brand logos</summary>
    {open && <>
      <p>Review the artwork and its source before the logo appears in Shop by brand.</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={add} className="ap-brand-fields">
        <label>New brand name<input name="name" maxLength={100} required /></label>
        <button className="button secondary" disabled={pending}>Add brand</button>
      </form>
      <button type="button" className="button secondary" disabled={pending}
        onClick={() => perform(() => changeBrandLogo("/existing", token, {}), "Lookup requested for existing brands with known official sources.")}>
        Find logos for existing brands
      </button>
      <label>Choose a brand<select value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Select a brand</option>
        {rows.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}
      </select></label>
      {brand && (brand.key === "gymdrobe" ? <p>GymDrobe uses its approved storefront wordmark.</p> : <>
        <p role="status">{statuses[brand.status]}</p>
        {brand.approved && <div>
          <img className="ap-brand-preview" src={brandLogoUrl(`/brands/${encodeURIComponent(brand.key)}/logo/${brand.approved.media}`)}
            alt={`Published logo for ${brand.name}`} />
          <button type="button" className="button secondary" disabled={pending}
            onClick={() => review("remove", "Published logo removed.")}>Remove published logo</button>
        </div>}
        {brand.candidate && <>
          <Candidate key={brand.candidate.media} brand={brand} token={token} />
          <div className="ap-actions">
            <button type="button" className="button" disabled={pending}
              onClick={() => review("approve", "Logo published to Shop by brand.")}>Approve logo</button>
            <button type="button" className="button secondary" disabled={pending}
              onClick={() => review("discard", "Suggestion discarded.")}>Discard suggestion</button>
          </div>
        </>}
        {!brand.candidate && !brand.approved && <button type="button" className="button secondary"
          disabled={pending || ["queued", "searching"].includes(brand.status)}
          onClick={() => perform(() => changeBrandLogo("/discover", token, { name: brand.name }), "Lookup requested.")}>
          Find official logo
        </button>}
        {!brand.approved && !brand.candidate && brand.status === "unavailable" &&
          <p><a href={`https://www.google.com/search?q=${encodeURIComponent(brand.name + " official logo media kit")}`}
            target="_blank" rel="noreferrer">Search for official artwork</a></p>}
        <form onSubmit={upload} className="ap-brand-fields">
          <label>Logo file<input name="artwork" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
          <label>Official artwork source (optional)<input name="source" type="url" placeholder="https://" maxLength={2048} /></label>
          <button className="button secondary" disabled={pending}>Upload for review</button>
        </form>
      </>)}
    </>}
  </details>;
}
