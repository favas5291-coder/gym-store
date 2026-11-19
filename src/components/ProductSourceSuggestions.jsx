import { useEffect, useRef, useState } from "react";
import { previewProductSource } from "../services/productApi.js";

export default function ProductSourceSuggestions({ url, token, onDetails, onPhoto, onPrice, allowPrice }) {
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(null);

  useEffect(() => {
    setPreview(null);
    setMessage("");
    setBusy(false);
    return () => active.current?.abort();
  }, [url]);

  async function load(photo) {
    if (busy) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    try {
      const result = await previewProductSource(token, photo || url, photo ? "image" : "page", controller.signal);
      if (controller.signal.aborted) return;
      if (photo) {
        onPhoto(result.media.url);
        setMessage("Photo added to the gallery.");
      } else {
        onDetails(result);
        setPreview(result);
        setMessage("Review the suggestions. Enter your own stock quantity.");
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={busy || !url.trim()} onClick={() => load()}>Fill from link</button>
    <p role="status">{busy ? "Reading source…" : message}</p>
    {preview?.low != null && <p>Source price {preview.currency} {preview.low}{preview.high !== preview.low && ` – ${preview.high}. Confirm the variant price manually.`}
      {allowPrice && preview.currency === "INR" && preview.low === preview.high && <button type="button" onClick={() => onPrice(preview.low)}>Use this price</button>}
    </p>}
    {preview?.images.map((image, i) => <button type="button" key={image} disabled={busy} onClick={() => load(image)}>Import authorized photo {i + 1}</button>)}
  </div>;
}
