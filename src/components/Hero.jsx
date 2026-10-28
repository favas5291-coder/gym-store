import { useEffect, useRef, useState } from "react";
import { heroMedia } from "../data/campaignMedia.js";
import { PremiumButton, TextLink } from "./PremiumControls.jsx";

// A stable, muted, native looping background film. Browser policies take
// precedence: on blocked autoplay, the campaign poster and shopping links
// remain fully available without adding an intrusive playback control.
export default function Hero() {
  const videoRef = useRef(null);
  const mediaRef = useRef(null);
  const blockedRef = useRef(false);

  if (!mediaRef.current) {
    mediaRef.current = window.matchMedia("(max-width: 700px)").matches
      ? heroMedia.mobile
      : heroMedia.desktop;
  }
  const media = mediaRef.current;
  const [motionEnabled, setMotionEnabled] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !navigator.connection?.saveData,
  );
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.loop = true;

    const tryAutoplay = () => {
      if (!motionEnabled || document.hidden || !video.paused || blockedRef.current || video.error) return;
      try {
        const result = video.play();
        result?.catch(error => {
          // No artificial play button: the still poster and shop CTAs are the fallback.
          if (error?.name === "NotAllowedError" || error?.name === "NotSupportedError") {
            blockedRef.current = true;
            setHasFrame(false);
          }
        });
      } catch {
        blockedRef.current = true;
        setHasFrame(false);
      }
    };

    const onVisibility = () => {
      if (!document.hidden) tryAutoplay();
    };
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionPreference = () => {
      if (motionPreference.matches) {
        video.pause();
        setMotionEnabled(false);
        setHasFrame(false);
      } else if (!navigator.connection?.saveData) {
        blockedRef.current = false;
        setMotionEnabled(true);
      }
    };

    video.addEventListener("canplay", tryAutoplay);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    motionPreference.addEventListener("change", onMotionPreference);
    tryAutoplay();

    return () => {
      video.removeEventListener("canplay", tryAutoplay);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      motionPreference.removeEventListener("change", onMotionPreference);
    };
  }, [motionEnabled]);

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
          autoPlay={motionEnabled}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setHasFrame(true)}
          onError={() => setHasFrame(false)}
        >
          <source src={media.video} type="video/mp4" />
        </video>
        <div className="cinema-caption"><span>MAKE TIME FOR YOURSELF.</span></div>
      </div>
    </section>
  );
}
