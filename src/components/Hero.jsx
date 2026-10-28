import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { heroMedia } from "../data/campaignMedia.js";

// Keep the selected film stable for this mount: changing viewport width must not restart it.
export default function Hero() {
  const videoRef = useRef(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const mediaRef = useRef(null);
  if (!mediaRef.current) {
    mediaRef.current = window.matchMedia("(max-width: 700px)").matches
      ? heroMedia.mobile
      : heroMedia.desktop;
  }
  const media = mediaRef.current;
  const [motionAllowed, setMotionAllowed] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !navigator.connection?.saveData,
  );
  const [hasFrame, setHasFrame] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreferenceChange = () => {
      if (preference.matches) {
        videoRef.current?.pause();
        setMotionAllowed(false);
        setHasFrame(false);
      } else if (!startedRef.current && !navigator.connection?.saveData) {
        setMotionAllowed(true);
      }
    };
    preference.addEventListener("change", onPreferenceChange);
    return () => preference.removeEventListener("change", onPreferenceChange);
  }, []);

  useEffect(() => {
    const player = videoRef.current;
    if (!motionAllowed || !player || startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    // The muted/inline attributes let the browser autoplay where permitted.
    // Make one explicit attempt as a fallback; never retry on scroll or re-render.
    const attempt = player.play();
    attempt?.catch(() => {
      // Keep the poster and shopping links visible if autoplay is prohibited.
      setFailed(true);
      setHasFrame(false);
    });
  }, [motionAllowed]);

  function handleEnded(event) {
    finishedRef.current = true;
    const player = event.currentTarget;
    player.pause();
    // Some decoders clear the exact EOF frame. Seek just inside the final frame.
    if (Number.isFinite(player.duration) && player.duration > 0) {
      try {
        player.currentTime = Math.max(0, player.duration - 1 / 30);
      } catch {
        // The native end frame remains visible when seeking is unsupported.
      }
    }
  }

  return (
    <section className="cinema-hero" aria-labelledby="cinema-title">
      <div className="cinema-media" aria-hidden="true">
        <picture className="cinema-poster">
          <source media="(max-width: 700px)" srcSet={heroMedia.mobile.poster} width="900" height="1600" />
          <img src={heroMedia.desktop.poster} alt="" width="1920" height="1080" fetchPriority="high" decoding="async" />
        </picture>
        {motionAllowed && !failed && media.video && (
          <video
            ref={videoRef}
            className={`cinema-film${hasFrame ? " is-ready" : ""}`}
            src={media.video}
            poster={media.poster}
            autoPlay
            muted
            playsInline
            preload="auto"
            loop={false}
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={() => setHasFrame(true)}
            onEnded={handleEnded}
            onError={() => { setFailed(true); setHasFrame(false); }}
          />
        )}
      </div>
      <div className="cinema-shade" aria-hidden="true" />
      <div className="cinema-content">
        <p className="cinema-kicker"><span /> GYMDROBE</p>
        <h1 id="cinema-title">Built for your<br /><span>every move.</span></h1>
        <p className="cinema-tagline">Everything You Need for Every Workout.</p>
        <div className="cinema-actions">
          <Link className="button cinema-shop" to="/shop">Shop Now <span aria-hidden="true">↗</span></Link>
          <a href="#categories" className="cinema-explore">Explore Collections <span aria-hidden="true">↓</span></a>
        </div>
      </div>
      <div className="cinema-bottom">
        <span className="cinema-edition">01 / BUILT FOR YOUR RISE</span>
        <a href="#categories" className="cinema-scroll">Explore the collection <span aria-hidden="true">↓</span></a>
      </div>
    </section>
  );
}
