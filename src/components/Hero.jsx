import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { heroMedia } from "../data/campaignMedia.js";

// Choose the appropriate source once; resizing cannot restart the campaign film.
export default function Hero() {
  const videoRef = useRef(null);
  const mediaRef = useRef(null);
  const pendingPlayRef = useRef(null);
  const blockedRef = useRef(false);

  if (!mediaRef.current) {
    mediaRef.current = window.matchMedia("(max-width: 700px)").matches
      ? heroMedia.mobile
      : heroMedia.desktop;
  }
  const media = mediaRef.current;
  const [autoplayAllowed, setAutoplayAllowed] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !navigator.connection?.saveData,
  );
  const [hasFrame, setHasFrame] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keep the video mounted even when autoplay is denied. Removing it after the
  // first rejected play() made the film impossible to start on mobile Safari.
  useEffect(() => {
    const player = videoRef.current;
    if (!player || !media.video) return;

    const prepareInlinePlayback = () => {
      player.muted = true;
      player.defaultMuted = true;
      player.setAttribute("muted", "");
      player.setAttribute("playsinline", "");
      player.setAttribute("webkit-playsinline", "true");
    };

    const play = () => {
      if (!autoplayAllowed || blockedRef.current || document.hidden || player.error ||
          !player.paused || pendingPlayRef.current) return;
      prepareInlinePlayback();
      try {
        const result = player.play();
        if (result?.then) {
          pendingPlayRef.current = result;
          result.catch(error => {
            if (error?.name === "AbortError") return; // Safari can abort while preparing the source.
            if (error?.name === "NotAllowedError" || player.readyState >= 2) {
              blockedRef.current = true;
              setNeedsTap(true);
            }
          }).finally(() => {
            if (pendingPlayRef.current === result) pendingPlayRef.current = null;
          });
        }
      } catch {
        blockedRef.current = true;
        setNeedsTap(true);
      }
    };

    const onVisibility = () => {
      if (!document.hidden) play();
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreferenceChange = () => {
      if (motion.matches) {
        player.pause();
        setHasFrame(false);
        setAutoplayAllowed(false);
        blockedRef.current = false;
        setNeedsTap(true);
      } else if (!navigator.connection?.saveData) {
        blockedRef.current = false;
        setNeedsTap(false);
        setAutoplayAllowed(true);
      }
    };

    player.addEventListener("canplay", play);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", play);
    motion.addEventListener("change", onPreferenceChange);
    prepareInlinePlayback();
    play();

    // On restricted mobile browsers, autoplay may simply never start rather
    // than rejecting. Offer a user-gesture recovery instead of a dead poster.
    const fallback = window.setTimeout(() => {
      if (autoplayAllowed && player.paused && !player.error) setNeedsTap(true);
    }, 5000);

    return () => {
      window.clearTimeout(fallback);
      player.removeEventListener("canplay", play);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", play);
      motion.removeEventListener("change", onPreferenceChange);
    };
  }, [autoplayAllowed, media.video]);

  function playOnTap() {
    const player = videoRef.current;
    if (!player) return;
    blockedRef.current = false;
    setNeedsTap(false);
    setFailed(false);
    player.muted = true;
    player.defaultMuted = true;
    player.setAttribute("muted", "");
    player.setAttribute("playsinline", "");
    player.setAttribute("webkit-playsinline", "true");
    player.preload = "auto";
    // The play call must occur synchronously inside this click for iOS user activation.
    if (player.error) player.load();
    try {
      player.play()?.catch(() => {
        blockedRef.current = true;
        setNeedsTap(true);
      });
    } catch {
      blockedRef.current = true;
      setNeedsTap(true);
    }
  }

  const showTap = Boolean(media.video) && (!autoplayAllowed || needsTap || failed) && !hasFrame;

  return (
    <section className="cinema-hero" aria-labelledby="cinema-title">
      <div className="cinema-content">
        <p className="cinema-kicker">THE GYMDROBE COLLECTION</p>
        <h1 id="cinema-title">Built for your<br /><span>every move.</span></h1>
        <p className="cinema-tagline">Everything You Need for Every Workout.</p>
        <div className="cinema-actions">
          <Link className="button cinema-shop" to="/shop">Shop Now <span aria-hidden="true">↗</span></Link>
          <a href="#categories" className="cinema-explore">Explore Collections <span aria-hidden="true">→</span></a>
        </div>
        <p className="cinema-note">Clothing. Footwear. Equipment. Your routine.</p>
      </div>
      <div className="cinema-stage">
        <picture className="cinema-poster">
          <source media="(max-width: 700px)" srcSet={heroMedia.mobile.poster} width="900" height="1600" />
          <img src={heroMedia.desktop.poster} alt="" width="1920" height="1080" fetchPriority="high" decoding="async" />
        </picture>
        {media.video && (
          <video
            ref={videoRef}
            className={`cinema-film${hasFrame ? " is-ready" : ""}`}
            src={media.video}
            poster={media.poster}
            autoPlay={autoplayAllowed}
            muted
            playsInline
            preload={autoplayAllowed ? "auto" : "none"}
            loop
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={() => { setHasFrame(true); setNeedsTap(false); setFailed(false); blockedRef.current = false; }}
            onError={() => { setFailed(true); setNeedsTap(true); setHasFrame(false); }}
          />
        )}
        {showTap && (
          <button type="button" className="cinema-play-fallback" onClick={playOnTap} aria-label="Play cinematic background video">
            <span aria-hidden="true">▶</span> Play video
          </button>
        )}
        <div className="cinema-caption"><span>MAKE TIME FOR YOURSELF.</span></div>
      </div>
    </section>
  );
}
