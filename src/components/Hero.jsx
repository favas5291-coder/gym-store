import { useEffect, useRef, useState } from "react";
import { heroMedia } from "../data/campaignMedia.js";
import { PremiumButton, TextLink } from "./PremiumControls.jsx";
import HeroVideoDiagnostics from "./HeroVideoDiagnostics.jsx";

// The video stays mounted during React renders and viewport-height changes.
export default function Hero() {
  const videoRef = useRef(null);
  const mediaRef = useRef(null);
  const diagnosticsRef = useRef({ playAttempts: 0, lastPlayError: null, lastEvent: "mounted" });
  const debugEnabledRef = useRef(new URLSearchParams(window.location.search).get("heroDebug") === "1");
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  if (!mediaRef.current) {
    mediaRef.current = window.matchMedia("(max-width: 700px)").matches
      ? heroMedia.mobile
      : heroMedia.desktop;
  }
  const media = mediaRef.current;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Muted and inline BEFORE attempting play. No site-level feature flag,
    // data-saver heuristic, or motion-preference check disables native autoplay.
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.autoplay = true;
    video.loop = true;
    video.preload = "auto";

    let disposed = false;
    let playingPromise = null;
    let attempts = 0;
    let policyBlocked = false;
    const MAX_START_ATTEMPTS = 2;
    const diagnostics = diagnosticsRef.current;

    function tryPlay() {
      if (disposed || document.hidden || policyBlocked || video.error ||
          !video.paused || playingPromise || attempts >= MAX_START_ATTEMPTS) return;

      attempts += 1;
      diagnostics.playAttempts += 1;
      diagnostics.lastEvent = "play-attempt";
      try {
        const result = video.play();
        if (result && typeof result.then === "function") {
          playingPromise = result;
          result.catch(error => {
            if (disposed) return;
            diagnostics.lastPlayError = error?.name || "UnknownError";
            diagnostics.lastEvent = "play-rejected";
            // WebKit intentionally rejects silent autoplay in iPhone Low
            // Power Mode. Never loop on a permission/policy rejection.
            if (["NotAllowedError", "SecurityError", "NotSupportedError"].includes(error?.name)) {
              policyBlocked = true;
              setAutoplayBlocked(true);
            }
            // AbortError can occur during source preparation; at most one
            // more attempt is permitted on loadeddata/canplay.
          }).finally(() => {
            if (playingPromise === result) playingPromise = null;
          });
        }
      } catch (error) {
        diagnostics.lastPlayError = error?.name || "UnknownError";
        diagnostics.lastEvent = "play-exception";
        if (error?.name !== "AbortError") {
          policyBlocked = true;
          setAutoplayBlocked(true);
        }
      }
    }

    function onPlaying() {
      attempts = 0;
      diagnostics.lastPlayError = null;
      diagnostics.lastEvent = "playing";
      setAutoplayBlocked(false);
    }

    function onPageVisibility() {
      if (document.hidden) {
        // Pause only when the tab is actually in the background.
        video.pause();
        diagnostics.lastEvent = "background-paused";
      } else if (!policyBlocked) {
        attempts = 0;
        tryPlay();
      }
    }

    const hero = video.closest(".cinema-hero");
    const observer = typeof IntersectionObserver !== "undefined" && hero
      ? new IntersectionObserver(entries => {
          if (!entries[0]?.isIntersecting || document.hidden || policyBlocked) return;
          // Safari may suspend a film outside the viewport even if the
          // document remains visible. Resume only on re-entry if paused.
          attempts = 0;
          tryPlay();
        }, { threshold: 0.15 })
      : null;

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", onPlaying);
    document.addEventListener("visibilitychange", onPageVisibility);
    window.addEventListener("pageshow", onPageVisibility);
    if (observer && hero) observer.observe(hero);
    tryPlay();

    return () => {
      disposed = true;
      observer?.disconnect();
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", onPlaying);
      document.removeEventListener("visibilitychange", onPageVisibility);
      window.removeEventListener("pageshow", onPageVisibility);
    };
  }, []);

  return (
    <section className="cinema-hero" aria-labelledby="cinema-title">
      <div className="cinema-content">
        <p className="cinema-kicker">THE GYMDROBE COLLECTION</p>
        <h1 id="cinema-title">Built for your<br /><span>every move.</span></h1>
        <p className="cinema-tagline">Everything You Need for Every Workout.</p>
        <div className="cinema-actions">
          <PremiumButton to="/shop" className="cinema-shop">Shop Now</PremiumButton>
          <TextLink href="#categories" className="cinema-explore">Explore Collections</TextLink>
        </div>
        <p className="cinema-note">Clothing. Footwear. Equipment. Your routine.</p>
      </div>
      <div className="cinema-stage">
        <picture className="cinema-poster">
          <source media="(max-width: 700px)" srcSet={heroMedia.mobile.poster} width="900" height="1600" />
          <img src={heroMedia.desktop.poster} alt="" width="1920" height="1080" fetchPriority="high" decoding="async" />
        </picture>
        <video
          ref={videoRef}
          className={`cinema-film${autoplayBlocked ? " is-autoplay-blocked" : ""}`}
          poster={media.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => {
            diagnosticsRef.current.lastPlayError = null;
            diagnosticsRef.current.lastEvent = "playing";
            setAutoplayBlocked(false);
          }}
          onError={() => {
            diagnosticsRef.current.lastEvent = "media-error";
            setAutoplayBlocked(true);
          }}
        >
          <source src={media.video} type="video/mp4" />
        </video>
        <div className="cinema-caption"><span>MAKE TIME FOR YOURSELF.</span></div>
      </div>
      {debugEnabledRef.current && (
        <HeroVideoDiagnostics videoRef={videoRef} diagnosticsRef={diagnosticsRef} />
      )}
    </section>
  );
}
