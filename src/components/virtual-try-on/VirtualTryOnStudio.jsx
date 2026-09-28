import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../Modal.jsx";
import { ProductImage } from "../StorefrontShared.jsx";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { useStore } from "../../context/StoreContext.jsx";
import { firstOptions, getVariantStock } from "../../utils/cartUtils.js";
import {
  getDiscountedPrice,
  getOriginalPrice,
  money,
} from "../../utils/productPricing.js";
import catalog from "../../../config/virtual-try-on.json";
import {
  analyzePhoto,
  checkAnalysis,
  preparePhoto,
  resultBlob,
} from "./photo.js";
import { discard, request, wait } from "./client.js";
import Camera from "./Camera.jsx";

function Outline() {
  return (
    <svg viewBox="0 0 160 240" fill="none" aria-hidden="true">
      <circle cx="80" cy="34" r="22" />
      <path d="M56 67h48l8 85-9 70M56 67l-8 85 9 70M80 153v69M55 69 27 136m78-67 28 67M48 152h64" />
    </svg>
  );
}
export default function VirtualTryOnStudio({
  product: initialProduct,
  initialColor,
  initialSize,
  onSelectionChange,
  onClose,
}) {
  const { products } = useCatalog(),
    { addToCart } = useStore(),
    id = useId();
  const first = firstOptions(initialProduct);
  const [productId, setProductId] = useState(String(initialProduct.id));
  const [color, setColor] = useState(initialColor ?? first.selectedColor),
    [size, setSize] = useState(initialSize ?? first.selectedSize);
  const [photo, setPhoto] = useState(null),
    [analysis, setAnalysis] = useState(null),
    [result, setResult] = useState(null);
  const [config, setConfig] = useState(null),
    [configError, setConfigError] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false),
    [phase, setPhase] = useState("idle"),
    [camera, setCamera] = useState(false),
    [added, setAdded] = useState(false),
    [comparison, setComparison] = useState(50),
    [elapsed, setElapsed] = useState(0),
    [sharing, setSharing] = useState(false);
  const upload = useRef(null),
    captureInput = useRef(null),
    op = useRef(null),
    sequence = useRef(0),
    activeJob = useRef(null),
    resultUrl = useRef(null),
    csrf = useRef(""),
    configOp = useRef(null),
    mounted = useRef(true),
    configLoad = useRef(0);
  const product =
    products.find((p) => String(p.id) === productId) || initialProduct;
  const choices = products.filter(
    (p) => catalog.products[String(p.id)]?.enabled,
  );
  const category = catalog.products[productId]?.category || "tops";
  const photoProblem = photo ? checkAnalysis(analysis, category) : "";
  const approvedImage =
    config?.products?.[productId]?.images?.[String(color || "")];
  const ready = Boolean(config?.configured && approvedImage);
  const preparing = phase === "preparing",
    busy = ["starting", "in_queue", "processing"].includes(phase);
  const stock = getVariantStock(product, size, color);
  const price = getDiscountedPrice(product),
    originalPrice = getOriginalPrice(product);
  function forgetJob() {
    const current = activeJob.current;
    activeJob.current = null;
    discard(current, csrf.current);
  }
  function clearResult() {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setResult(null);
  }
  function stopWork() {
    sequence.current++;
    op.current?.abort();
    forgetJob();
    setPhase("idle");
  }
  function resetPreview() {
    stopWork();
    clearResult();
    setError("");
    setNotice("");
    setAdded(false);
  }
  function removePhoto() {
    resetPreview();
    setPhoto(null);
    setAnalysis(null);
    setConsent(false);
    if (upload.current) upload.current.value = "";
    if (captureInput.current) captureInput.current.value = "";
  }
  async function loadConfig() {
    const revision = ++configLoad.current;
    configOp.current?.abort();
    const ctrl = new AbortController();
    configOp.current = ctrl;
    setConfigError("");
    setConfig(null);
    try {
      const next = await request("config", { signal: ctrl.signal });
      if (mounted.current && revision === configLoad.current) {
        setConfig(next);
        csrf.current = next.csrf;
      }
    } catch (e) {
      if (
        e.name !== "AbortError" &&
        mounted.current &&
        revision === configLoad.current
      )
        setConfigError(e.message);
    }
  }
  useEffect(() => {
    mounted.current = true;
    loadConfig();
    return () => {
      mounted.current = false;
      sequence.current++;
      configOp.current?.abort();
      op.current?.abort();
      forgetJob();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  function selectProduct(nextId) {
    const next = choices.find((p) => String(p.id) === nextId);
    if (!next) return;
    resetPreview();
    const initial = firstOptions(next);
    setProductId(nextId);
    setColor(initial.selectedColor);
    setSize(initial.selectedSize);
    setCamera(false);
  }
  function selectColor(next) {
    resetPreview();
    setColor(next);
    if (!getVariantStock(product, size, next))
      setSize(
        product.sizes?.find((s) => getVariantStock(product, s, next) > 0) ||
          product.sizes?.[0] ||
          null,
      );
  }
  async function choosePhoto(file) {
    if (!file) return;
    removePhoto();
    setCamera(false);
    const current = sequence.current,
      ctrl = new AbortController();
    op.current = ctrl;
    setPhase("preparing");
    try {
      const prepared = await preparePhoto(file);
      if (current !== sequence.current) return;
      setPhoto(prepared);
      const checked = await analyzePhoto(prepared.blob, ctrl.signal);
      if (current !== sequence.current) return;
      setAnalysis(checked);
      const issue = checkAnalysis(checked, category);
      if (issue) setError(issue);
    } catch (e) {
      if (current === sequence.current && e.name !== "AbortError")
        setError(e.message);
    } finally {
      if (current === sequence.current) setPhase("idle");
    }
  }
  function openCamera() {
    setError("");
    if (navigator.mediaDevices?.getUserMedia && window.isSecureContext)
      setCamera(true);
    else captureInput.current.click();
  }
  async function generate() {
    if (busy || preparing) return;
    if (!photo) {
      setError("Add a photo or take one with your camera first.");
      upload.current?.focus();
      return;
    }
    if (photoProblem) {
      setError(photoProblem);
      return;
    }
    if (!consent) {
      setError("Please agree to photo processing before trying it on.");
      return;
    }
    if (!ready) {
      setError(
        "Photo try-on is not available for this selection yet. Try another colour or product.",
      );
      return;
    }
    resetPreview();
    const current = sequence.current,
      ctrl = new AbortController();
    op.current = ctrl;
    setPhase("starting");
    const requestKey = crypto.randomUUID();
    activeJob.current = requestKey;
    const selected = { productId, color };
    try {
      const started = await request("generate", {
        method: "POST",
        csrf: csrf.current,
        signal: ctrl.signal,
        body: {
          requestKey,
          productId,
          color,
          personImage: photo.dataUrl,
          consent: true,
        },
      });
      if (current !== sequence.current) {
        discard(requestKey, csrf.current);
        return;
      }
      if (started.status === "cancelled")
        throw new Error("This preview was stopped. You can start a new one.");
      const began = Date.now();
      while (Date.now() - began < 235000) {
        await wait(2500, ctrl.signal);
        const next = await request("job", {
          id: requestKey,
          signal: ctrl.signal,
        });
        if (current !== sequence.current) return;
        if (next.status === "completed") {
          if (
            next.productId !== selected.productId ||
            next.color !== selected.color
          )
            throw new Error(
              "This result does not match your selection. Please try again.",
            );
          const blob = resultBlob(next.image),
            url = URL.createObjectURL(blob);
          resultUrl.current = url;
          setResult({ url, blob, ...selected, name: product.name });
          setComparison(50);
          setPhase("completed");
          forgetJob();
          setNotice("Your preview is ready. Drag the slider to compare.");
          return;
        }
        if (next.status === "failed")
          throw new Error(
            next.message ||
              "We could not create this preview. Please try another photo.",
          );
        if (!["starting", "processing", "in_queue"].includes(next.status))
          throw new Error(
            "The preview could not be completed. Please try again.",
          );
        setPhase(next.status);
      }
      throw new Error(
        "This preview took longer than expected. Please try again later.",
      );
    } catch (e) {
      if (e.name !== "AbortError" && current === sequence.current) {
        setPhase("idle");
        setError(e.message);
        forgetJob();
      }
    }
  }
  async function share() {
    if (!result || sharing) return;
    setSharing(true);
    setNotice("");
    const file = new File(
      [result.blob],
      `GymDrobe-AI-preview-${result.productId}.${result.blob.type === "image/png" ? "png" : "jpg"}`,
      { type: result.blob.type },
    );
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My GymDrobe virtual try-on",
          text: "AI-generated appearance preview from GymDrobe.",
        });
        if (mounted.current) setNotice("Your preview was shared.");
      } else
        setNotice(
          "This browser cannot share image files. Download your preview, then share it from your photos.",
        );
    } catch (e) {
      if (e.name !== "AbortError" && mounted.current)
        setNotice(
          "Sharing was unavailable. You can download the preview instead.",
        );
    } finally {
      if (mounted.current) setSharing(false);
    }
  }
  function add() {
    setError("");
    if (addToCart(product, 1, size, color)) {
      setAdded(true);
      if (productId === String(initialProduct.id))
        onSelectionChange?.({ productId, color, size });
    } else
      setError(
        "This selection could not be added. Check the available size and colour, or the quantity already in your bag.",
      );
  }
  return (
    <Modal title="Virtual Try-On" className="vto-modal" onClose={onClose}>
      <div className="vto-intro">
        <p className="vto-eyebrow">GYMDROBE FITTING ROOM</p>
        <h3>Your style. On you.</h3>
        <p>A little less guessing. A closer look before you choose.</p>
      </div>
      <ol className="vto-steps" aria-label="Try-on steps">
        <li className={photo ? "is-done" : "is-current"}>
          <span>1</span>Your photo
        </li>
        <li className={photo && !result ? "is-current" : ""}>
          <span>2</span>Your style
        </li>
        <li className={result ? "is-current" : ""}>
          <span>3</span>Your preview
        </li>
      </ol>
      <div className="vto-layout">
        <section
          className="vto-visual"
          aria-label="Your photo and try-on preview"
        >
          {camera ? (
            <Camera onPhoto={choosePhoto} onClose={() => setCamera(false)} />
          ) : (
            <>
              <div
                className={`vto-canvas ${photo ? "has-photo" : ""}`}
                style={
                  photo
                    ? { aspectRatio: `${photo.width}/${photo.height}` }
                    : undefined
                }
              >
                {!photo ? (
                  <div className="vto-empty">
                    <Outline />
                    <h4>Meet your next look</h4>
                    <p>Add a clear photo with just you in the frame.</p>
                    <div className="vto-actions">
                      <button
                        type="button"
                        className="vto-primary"
                        onClick={openCamera}
                      >
                        Use camera
                      </button>
                      <button
                        type="button"
                        className="vto-secondary"
                        onClick={() => upload.current.click()}
                      >
                        Upload photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <img
                      src={photo.dataUrl}
                      className="vto-person"
                      alt="Your original photo"
                    />
                    {result && (
                      <>
                        <img
                          src={result.url}
                          className="vto-person vto-result"
                          style={{
                            clipPath: `inset(0 ${100 - comparison}% 0 0)`,
                          }}
                          alt={`AI try-on of ${result.name} in ${result.color}`}
                        />
                        <div
                          className="vto-divider"
                          style={{ left: `${comparison}%` }}
                          aria-hidden="true"
                        >
                          <span>↔</span>
                        </div>
                        <span className="vto-photo-label after">
                          AFTER · AI PREVIEW
                        </span>
                      </>
                    )}
                    <span className="vto-photo-label before">BEFORE</span>
                  </>
                )}
                {(preparing || busy) && (
                  <div
                    className="vto-processing"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="vto-orbit" aria-hidden="true">
                      <span>✦</span>
                    </div>
                    <strong>
                      {preparing
                        ? "Checking your photo…"
                        : "Creating your virtual try-on..."}
                    </strong>
                    <p>
                      {preparing
                        ? "Looking for one clear person. Your photo stays on this device during this check."
                        : "This may take a few seconds. Detailed previews can take a minute or longer."}
                    </p>
                    {busy && (
                      <span className="vto-time" aria-hidden="true">
                        {elapsed}s elapsed
                        {phase === "in_queue" ? " · In the queue" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {result && (
                <>
                  <label className="vto-slider" htmlFor={`${id}-compare`}>
                    <span>After</span>
                    <span>Slide to compare</span>
                    <span>Before</span>
                    <input
                      id={`${id}-compare`}
                      aria-label="Before and after comparison"
                      type="range"
                      min="0"
                      max="100"
                      value={comparison}
                      onChange={(e) => setComparison(Number(e.target.value))}
                    />
                  </label>
                  <div className="vto-actions">
                    <a
                      className="vto-secondary"
                      href={result.url}
                      download={`GymDrobe-AI-preview-${result.productId}.${result.blob.type === "image/png" ? "png" : "jpg"}`}
                    >
                      ↓ Download result
                    </a>
                    <button
                      type="button"
                      className="vto-secondary"
                      onClick={share}
                      disabled={sharing}
                    >
                      ↗ Share result
                    </button>
                  </div>
                  <p className="vto-caption">
                    AI appearance preview. Details, proportions and drape may
                    differ from the real product.
                  </p>
                </>
              )}
            </>
          )}
          <input
            ref={upload}
            className="vto-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload your photo"
            onChange={(e) => choosePhoto(e.target.files?.[0])}
          />
          <input
            ref={captureInput}
            className="vto-file"
            type="file"
            accept="image/*"
            capture="user"
            aria-label="Take photo with device camera"
            onChange={(e) => choosePhoto(e.target.files?.[0])}
          />
          {photo && !camera && (
            <div className="vto-photo-actions">
              <button
                type="button"
                onClick={() => upload.current.click()}
                disabled={preparing || busy}
              >
                Change photo
              </button>
              <button
                type="button"
                onClick={openCamera}
                disabled={preparing || busy}
              >
                Use camera
              </button>
              <button type="button" onClick={removePhoto}>
                Remove photo
              </button>
            </div>
          )}
          <details className="vto-tips">
            <summary>Tips for your best preview</summary>
            <ul>
              <li>
                Use one person, facing the camera, with arms slightly away from
                the body.
              </li>
              <li>
                Show your torso and hips for tops; include both feet for shoes.
              </li>
              <li>
                Use even lighting and a sharp photo. Avoid crossed arms and
                mirror obstructions.
              </li>
              <li>
                Upload JPEG, PNG or WebP, up to 8 MB. Automated checks can make
                mistakes; try another photo if needed.
              </li>
            </ul>
          </details>
        </section>
        <section
          className="vto-controls"
          aria-label="Choose product and options"
        >
          <label className="vto-field-label" htmlFor={`${id}-product`}>
            {result ? "Try another product" : "Choose your product"}
          </label>
          <select
            id={`${id}-product`}
            className="vto-select"
            value={productId}
            disabled={busy || preparing}
            onChange={(e) => selectProduct(e.target.value)}
          >
            {choices.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="vto-product-card">
            <ProductImage
              product={
                approvedImage ? { ...product, image: approvedImage } : product
              }
              decorative
            />
            <div>
              <p className="vto-eyebrow">{product.brand || "GymDrobe"}</p>
              <h4>{product.name}</h4>
              <p className="vto-price">
                <strong>{money(price)}</strong>
                {originalPrice > price && <del>{money(originalPrice)}</del>}
              </p>
              <p className="vto-caption">
                {approvedImage
                  ? `${color} · Try-on reference photo`
                  : "Catalogue photo · colour preview may vary"}
              </p>
            </div>
          </div>
          {!!product.colors?.length && (
            <fieldset className="vto-options" disabled={busy || preparing}>
              <legend>
                Colour <strong>{color}</strong>
              </legend>
              <div>
                {product.colors.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={color === value}
                    onClick={() => selectColor(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {!!product.sizes?.length && (
            <fieldset className="vto-options" disabled={busy || preparing}>
              <legend>
                Size <strong>{size}</strong>
              </legend>
              <div>
                {product.sizes.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={String(size) === String(value)}
                    disabled={!getVariantStock(product, value, color)}
                    onClick={() => {
                      setSize(value);
                      setAdded(false);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <p className="vto-caption">
            Size selects the variant for your bag. This preview does not
            simulate tightness or guarantee physical fit.
          </p>
          {configError ? (
            <div className="vto-notice">
              <strong>Try-on service unavailable</strong>
              <p>{configError}</p>
              <button type="button" className="vto-link" onClick={loadConfig}>
                Check again
              </button>
            </div>
          ) : config && !ready ? (
            <div className="vto-notice">
              <strong>
                {config.configured
                  ? "This colour is not ready for try-on"
                  : "Photo try-on is being set up"}
              </strong>
              <p>
                {config.configured
                  ? "Choose another colour or product. A clear photo of this exact item is needed for a reliable preview."
                  : "You can explore the fitting room and prepare your photo. Generating a preview will be available when the image service is connected."}
              </p>
            </div>
          ) : !config ? (
            <p className="vto-caption" role="status">
              Checking try-on availability…
            </p>
          ) : null}
          {photoProblem && !preparing && !error && (
            <p className="vto-error" role="alert">
              {photoProblem}
            </p>
          )}
          <label className="vto-consent">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I have permission to use this photo and agree to its processing
              for this try-on.{" "}
              <a
                href="/virtual-try-on-privacy.html"
                target="_blank"
                rel="noreferrer"
              >
                Photo privacy
              </a>
            </span>
          </label>
          {error && (
            <p className="vto-error" role="alert">
              {error}
            </p>
          )}
          <div className="vto-cta-block">
            <button
              type="button"
              className="vto-primary vto-full"
              disabled={busy || preparing || camera || (!ready && !!config)}
              onClick={generate}
            >
              {busy
                ? "Creating your virtual try-on..."
                : result
                  ? "Try It On Again"
                  : "Try It On"}
              <span aria-hidden="true">✦</span>
            </button>
            {busy && (
              <button
                type="button"
                className="vto-link"
                onClick={() => {
                  stopWork();
                  setNotice(
                    "Preview stopped here. A request already sent to the AI service may still finish.",
                  );
                }}
              >
                Stop waiting
              </button>
            )}
          </div>
          <div className="vto-bag">
            <button
              type="button"
              className="vto-secondary vto-full"
              disabled={!stock || added}
              onClick={add}
            >
              {added
                ? "✓ Added to bag"
                : stock
                  ? "Add to Cart"
                  : "This selection is out of stock"}
            </button>
            {added && (
              <Link to="/cart" className="vto-link" onClick={onClose}>
                View your bag →
              </Link>
            )}
          </div>
          {notice && (
            <p role="status" className="vto-notice-text">
              {notice}
            </p>
          )}
          <details className="vto-tips">
            <summary>Your photo stays in your control</summary>
            <p>
              Uploading and the initial person check happen on your device. “Try
              It On” sends a prepared copy to FASHN through GymDrobe. We do not
              save your images to your account or browser storage.
            </p>
            <p>
              Closing this window clears its local photos. Submitted requests
              may continue at the image service. Downloads and shared copies
              remain wherever you save or share them.
            </p>
            <a
              href="/virtual-try-on-privacy.html"
              target="_blank"
              rel="noreferrer"
            >
              Read how photos are handled ↗
            </a>
          </details>
        </section>
      </div>
    </Modal>
  );
}