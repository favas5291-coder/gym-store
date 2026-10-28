import { useEffect, useState } from "react";

// Opt-in on-device diagnostics. No video controls, telemetry, or stored data.
// Open /?heroDebug=1 on the affected phone; compare Low Power Mode ON vs OFF.
export default function HeroVideoDiagnostics({ videoRef, diagnosticsRef }) {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let lastTime = null;
    const sample = () => {
      const video = videoRef.current;
      if (!video) return;
      const rect = video.getBoundingClientRect();
      const currentTime = Number(video.currentTime.toFixed(2));
      const data = {
        paused: video.paused,
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime,
        movingSinceLastSample: lastTime != null && Math.abs(currentTime - lastTime) > 0.04,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        mediaErrorCode: video.error?.code ?? null,
        lastPlayError: diagnosticsRef.current.lastPlayError,
        lastEvent: diagnosticsRef.current.lastEvent,
        playAttempts: diagnosticsRef.current.playAttempts,
        muted: video.muted,
        defaultMuted: video.defaultMuted,
        autoplay: video.autoplay,
        loop: video.loop,
        playsInline: video.playsInline,
        documentHidden: document.hidden,
        onscreen: rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth,
        opacity: getComputedStyle(video).opacity,
        currentSrc: video.currentSrc.split("/").pop(),
      };
      lastTime = currentTime;
      setSnapshot(data);
      window.__gymdrobeHeroVideoState = () => data;
    };
    sample();
    const interval = window.setInterval(sample, 800);
    return () => {
      window.clearInterval(interval);
      delete window.__gymdrobeHeroVideoState;
    };
  }, [videoRef, diagnosticsRef]);

  if (!snapshot) return null;
  return (
    <aside
      aria-label="Hero video diagnostics"
      style={{
        position: "fixed", zIndex: 10000, bottom: 8, left: 8, right: 8,
        margin: "0 auto", maxWidth: 420, maxHeight: "45dvh", overflowY: "auto",
        padding: 12, border: "1px solid #ffffff66", borderRadius: 4,
        background: "#0e1710f5", color: "#fff", font: "12px/1.45 monospace",
        textAlign: "left", pointerEvents: "none", userSelect: "text",
      }}
    >
      <strong>GymDrobe video diagnostics (opt-in)</strong>
      <div>Low Power Mode is not detectable by websites. Compare ON/OFF after reloading.</div>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "8px 0 0" }}>
        {JSON.stringify(snapshot, null, 2)}
      </pre>
    </aside>
  );
}
