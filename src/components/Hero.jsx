import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { heroMedia } from "../data/campaignMedia.js";

// The poster and shopping UI never wait for media, consent, or playback.
export default function Hero() {
  const section = useRef(null);
  const video = useRef(null);
  const [portrait, setPortrait] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const [idle, setIdle] = useState(false);
  const [paused, setPaused] = useState(false);
  const [requested, setRequested] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const media = portrait ? heroMedia.mobile : heroMedia.desktop;
  const saveData = Boolean(navigator.connection?.saveData);
  const loadFilm = Boolean(media.video) && !failed && (requested || (idle && !reduced && !saveData));

  useEffect(() => {
    const size = window.matchMedia("(max-width: 700px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => { setPortrait(size.matches); setHasFrame(false); setFailed(false); };
    const preference = () => { setReduced(motion.matches); setRequested(false); };
    const visibility = () => setHidden(document.hidden);
    size.addEventListener("change", resize);
    motion.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(section.current);
    const timer = window.setTimeout(() => setIdle(true), 1400);
    return () => {
      size.removeEventListener("change", resize);
      motion.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    if (paused || !visible || hidden || !loadFilm) { player.pause(); return; }
    const promise = player.play();
    promise?.catch(() => setPlaying(false));
    return () => player.pause();
  }, [paused, visible, hidden, loadFilm, portrait, attempt]);

  function toggleFilm() {
    if (playing) { setPaused(true); return; }
    setRequested(true);
    setPaused(false);
    if (failed) { setFailed(false); setAttempt(value => value + 1); }
    video.current?.play()?.catch(() => setPlaying(false));
  }

  return (
    <section className="cinema-hero" ref={section} aria-labelledby="cinema-title">
      <picture className="cinema-poster">
        <source media="(max-width: 700px)" srcSet={heroMedia.mobile.poster} width="900" height="1600" />
        <img src={heroMedia.desktop.poster} alt="" width="1920" height="1080" fetchPriority="high" decoding="async" />
      </picture>
      {loadFilm && (
        <video key={`${portrait}-${attempt}`} ref={video} className={`cinema-film${hasFrame ? " is-ready" : ""}`}
          src={media.video} poster={media.poster} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1}
          onPlaying={() => { setPlaying(true); setHasFrame(true); }} onPause={() => setPlaying(false)}
          onError={() => { setFailed(true); setPlaying(false); setHasFrame(false); }} />
      )}
      <div className="cinema-shade" aria-hidden="true" />
      <div className="cinema-content">
        <p className="cinema-kicker"><span /> THE FITNESS COLLECTIVE</p>
        <h1 id="cinema-title">Your workout.<br /><span>Fully equipped.</span></h1>
        <p className="cinema-tagline">Everything You Need for Every Workout.</p>
        <div className="cinema-actions">
          <Link className="button cinema-shop" to="/shop">Shop Essentials <span aria-hidden="true">↗</span></Link>
          <a href="#categories" className="cinema-explore">Explore Collections <span aria-hidden="true">↓</span></a>
        </div>
      </div>
      <div className="cinema-bottom">
        <span className="cinema-edition">01 / MADE FOR YOUR EVERYDAY</span>
        {media.video && <button type="button" className="cinema-control" onClick={toggleFilm} aria-label={playing ? "Pause hero film" : "Play hero film"} aria-pressed={!playing}>
          <span aria-hidden="true">{playing ? "Ⅱ" : "▷"}</span> {playing ? "Pause film" : failed ? "Retry film" : "Play film"}
        </button>}
        <a href="#categories" className="cinema-scroll">Discover your next essential <span aria-hidden="true">↓</span></a>
      </div>
    </section>
  );
}
