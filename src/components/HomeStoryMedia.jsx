import { useEffect, useRef, useState } from "react";
import { claimHomeVideo, releaseHomeVideo } from "../utils/homeMedia.js";

const mediaRoot = "/media/campaign/story-";

export default function HomeStoryMedia() {
  const frame = useRef(null);
  const playerRef = useRef(null);
  const [source, setSource] = useState("");
  const [playing, setPlaying] = useState(false);
  const [failedSource, setFailedSource] = useState("");

  useEffect(() => {
    const narrow = matchMedia("(max-width: 700px)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = navigator.connection;
    let visible = false;
    function sync() {
      const enabled = visible && !document.hidden && !reduced.matches && !connection?.saveData;
      if (!enabled) {
        releaseHomeVideo(playerRef.current);
        setPlaying(false);
      }
      setSource(enabled ? mediaRoot + (narrow.matches ? "portrait" : "wide") + ".mp4" : "");
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      sync();
    }, { threshold: 0.35 });
    observer.observe(frame.current);
    document.addEventListener("visibilitychange", sync);
    narrow.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      narrow.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.play().catch(() => { /* The poster stays visible until playback starts. */ });
    return () => releaseHomeVideo(player);
  }, [source, failedSource]);

  return <div className={`home-story-media${source && playing ? " is-playing" : ""}`} ref={frame} aria-hidden="true">
    <picture>
      <source media="(max-width: 700px)" srcSet={mediaRoot + "portrait.webp"} />
      <img src={mediaRoot + "wide.webp"} alt="" width="768" height="432" loading="lazy" decoding="async" />
    </picture>
    {source && source !== failedSource && <video key={source} ref={playerRef} src={source} muted playsInline loop preload="none"
      onPlay={event => claimHomeVideo(event.currentTarget)}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onError={() => { setPlaying(false); setFailedSource(source); }} />}
  </div>;
}
