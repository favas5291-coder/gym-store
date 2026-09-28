import { useEffect, useRef, useState } from "react";
export default function Camera({ onPhoto, onClose }) {
  const video = useRef(null),
    stream = useRef(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [taking, setTaking] = useState(false);
  useEffect(() => {
    let active = true;
    const stop = () => {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
    const hide = () => {
      if (document.hidden) {
        stop();
        onClose();
      }
    };
    (async () => {
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1440 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
        if (!active) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = next;
        video.current.srcObject = next;
        await video.current.play();
      } catch (e) {
        if (active)
          setError(
            e.name === "NotAllowedError"
              ? "Camera access was denied. Allow it in your browser settings, or upload a photo."
              : e.name === "NotFoundError"
                ? "No camera was found. You can upload a photo instead."
                : "We could not open the camera. Close other camera apps, or upload a photo.",
          );
      }
    })();
    document.addEventListener("visibilitychange", hide);
    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  async function capture() {
    const v = video.current;
    if (!v?.videoWidth) return;
    setTaking(true);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("We could not capture a photo. Please upload one instead.");
      setTaking(false);
      return;
    }
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.94),
    );
    if (blob) {
      onPhoto(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
      onClose();
    } else {
      setError("We could not capture that frame. Please try again.");
      setTaking(false);
    }
  }
  return (
    <div className="vto-camera">
      <div className="vto-camera-frame">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          onCanPlay={() => setReady(true)}
          aria-label="Live camera preview"
        />
        <div className="vto-camera-guide" aria-hidden="true" />
        {!ready && !error && <p role="status">Opening your camera…</p>}
      </div>
      <p>
        Stand back so your torso and hips are visible. Include both feet when
        trying shoes.
      </p>
      {error && (
        <p className="vto-error" role="alert">
          {error}
        </p>
      )}
      <div className="vto-actions">
        <button
          type="button"
          className="vto-primary"
          disabled={!ready || taking || !!error}
          onClick={capture}
        >
          Take photo
        </button>
        <button type="button" className="vto-secondary" onClick={onClose}>
          Close camera
        </button>
      </div>
    </div>
  );
}