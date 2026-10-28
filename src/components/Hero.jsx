import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { heroMedia } from "../data/campaignMedia.js";

// Freeze the chosen source for this mount so a breakpoint change cannot restart the film.
export default function Hero() {
  const videoRef = useRef(null);
  const attemptedRef = useRef(false);
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
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      if (motion.matches) {
        videoRef.current?.pause();
        setMotionAllowed(false);
        setHasFrame(false);
      } else if (!attemptedRef.current && !navigator.connection?.saveData) {
        setMotionAllowed(true);
      }
    };
    motion.addEventListener("change", onChange);
    return () => motion.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !motionAllowed || attemptedRef.current) return;
    attemptedRef.current = true;
    player.muted = true;
    player.defaultMuted = true;
    // One autoplay attempt; native looping handles subsequent cycles without React re-renders.
    player.play()?.catch(() => {
      setFailed(true);
      setHasFrame(false);
    });
  }, [motionAllowed]);


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
            loop
            aria-hidden="true"
            tabIndex={-1}
            onPlaying={() => setHasFrame(true)}
            onError={() => { setFailed(true); setHasFrame(false); }}
          />
        )}
        <div className="cinema-caption"><span>MAKE TIME FOR YOURSELF.</span></div>
      </div>
    </section>
  );
}
