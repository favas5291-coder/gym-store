import { useEffect, useRef, useState } from "react";
import { heroMedia } from "../data/campaignMedia.js";
import { PremiumButton, TextLink } from "./PremiumControls.jsx";

// Keep the source stable for the component's lifetime so React updates,
// scrolling, and viewport-height changes do not recreate the media element.
export default function Hero() {
  const videoRef = useRef(null);
  const mediaRef = useRef(null);
  const [hasFrame, setHasFrame] = useState(false);

  if (!mediaRef.current) {
    mediaRef.current = window.matchMedia("(max-width: 700px)").matches
      ? heroMedia.mobile
      : heroMedia.desktop;
  }
  const media = mediaRef.current;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari needs a genuinely muted inline element BEFORE calling play().
    // These settings are deliberately not tied to React state or data-saving
    // heuristics; the browser itself decides whether autoplay is allowed.
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

    function startIfAllowed() {
      if (disposed || document.hidden || policyBlocked || video.error ||
          !video.paused || playingPromise || attempts >= MAX_START_ATTEMPTS) return;

      // A rejected NotAllowedError cannot be bypassed: retain the poster.
      // Retry at most once for a transient early-loading/AbortError failure.
      attempts += 1;
      try {
        const result = video.play();
        if (result && typeof result.then === "function") {
          playingPromise = result;
          result.catch(error => {
            if (disposed) return;
            if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
              policyBlocked = true;
              setHasFrame(false);
            } else if (error?.name === "NotSupportedError") {
              // File/codec errors are not autoplay-policy failures.
              policyBlocked = true;
              setHasFrame(false);
            }
            // AbortError during source preparation may be retried on canplay.
          }).finally(() => {
            if (playingPromise === result) playingPromise = null;
          });
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          policyBlocked = true;
          setHasFrame(false);
        }
      }
    }

    function onPlaying() {
      attempts = 0; // Allow a future user-visible return from background.
      setHasFrame(true);
    }

    function onPageVisible() {
      if (!document.hidden) {
        // Browser-initiated background suspension is not a failed autoplay.
        if (!policyBlocked) attempts = 0;
        startIfAllowed();
      }
    }

    video.addEventListener("loadeddata", startIfAllowed);
    video.addEventListener("canplay", startIfAllowed);
    video.addEventListener("playing", onPlaying);
    document.addEventListener("visibilitychange", onPageVisible);
    window.addEventListener("pageshow", onPageVisible);

    // Muted native autoplay begins immediately where permitted; this extra
    // call handles WebKit cases where the attribute alone is insufficient.
    startIfAllowed();

    return () => {
      disposed = true;
      video.removeEventListener("loadeddata", startIfAllowed);
      video.removeEventListener("canplay", startIfAllowed);
      video.removeEventListener("playing", onPlaying);
      document.removeEventListener("visibilitychange", onPageVisible);
      window.removeEventListener("pageshow", onPageVisible);
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
          className={`cinema-film${hasFrame ? " is-ready" : ""}`}
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
          onPlaying={() => setHasFrame(true)}
          onLoadedData={() => {
            const player = videoRef.current;
            if (player && !player.paused && player.readyState >= 2) setHasFrame(true);
          }}
          onError={() => setHasFrame(false)}
        >
          <source src={media.video} type="video/mp4" />
        </video>
        <div className="cinema-caption"><span>MAKE TIME FOR YOURSELF.</span></div>
      </div>
    </section>
  );
}
