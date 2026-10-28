import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { heroMedia } from "../data/campaignMedia.js";

export default function Hero() {
  const section = useRef(null);
  const video = useRef(null);
  const [portrait, setPortrait] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const [paused, setPaused] = useState(false);
  const [requested, setRequested] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const media = portrait ? heroMedia.mobile : heroMedia.desktop;
  const saveData = Boolean(navigator.connection?.saveData);
  // Mount the selected film immediately. Never wait for a timer or a click.
  const loadFilm = Boolean(media.video) && !failed && (requested || (!reduced && !saveData));

  useEffect(() => {
    const size = window.matchMedia("(max-width: 700px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => { setPortrait(size.matches); setHasFrame(false); setFailed(false); setBlocked(false); };
    const preference = () => { setReduced(motion.matches); setRequested(false); };
    const visibility = () => setHidden(document.hidden);
    size.addEventListener("change", resize);
    motion.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(section.current);
    return () => {
      size.removeEventListener("change", resize);
      motion.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    let active = true;
    if (paused || !visible || hidden || !loadFilm) { player.pause(); return; }
    player.muted = true;
    player.defaultMuted = true;
    player.play()?.catch(error => {
      // Cleanup can interrupt play during routing or React strict-mode setup.
      if (!active || error.name === "AbortError") return;
      player.pause();
      setPlaying(false);
      setHasFrame(false);
      setBlocked(true);
    });
    return () => { active = false; player.pause(); };
  }, [paused, visible, hidden, loadFilm, portrait, attempt]);

  function toggleFilm() {
    if (playing) { setPaused(true); return; }
    setRequested(true);
    setPaused(false);
    setBlocked(false);
    if (failed) setFailed(false);
    setAttempt(value => value + 1);
    video.current?.play()?.catch(() => setBlocked(true));
  }

  return (
    <section className="cinema-hero" ref={section} aria-labelledby="cinema-title">
      <div className="cinema-content">
        <p className="cinema-kicker">THE GYMDROBE COLLECTION</p>
        <h1 id="cinema-title">Built for your<br /><span>every move.</span></h1>
        <p className="cinema-tagline">Everything You Need for Every Workout.</p>
        <div className="cinema-actions">
          <Link className="button cinema-shop" to="/shop">Shop now <span aria-hidden="true">↗</span></Link>
          <a href="#categories" className="cinema-explore">Explore collections <span aria-hidden="true">→</span></a>
        </div>
        <p className="cinema-note">Clothing. Footwear. Equipment. Your routine.</p>
      </div>
      <div className="cinema-stage">
        <picture className="cinema-poster">
          <source media="(max-width: 700px)" srcSet={heroMedia.mobile.poster} width="900" height="1600" />
          <img src={heroMedia.desktop.poster} alt="" width="1920" height="1080" fetchPriority="high" decoding="async" />
        </picture>
        {loadFilm && (
          <video key={`${portrait}-${attempt}`} ref={video} className={`cinema-film${hasFrame ? " is-ready" : ""}`}
            src={media.video} poster={media.poster} autoPlay={!paused && !blocked && visible && !hidden} muted loop playsInline preload="auto" aria-hidden="true" tabIndex={-1}
            onPlaying={() => { setPlaying(true); setHasFrame(true); setBlocked(false); }} onPause={() => setPlaying(false)}
            onError={() => { setFailed(true); setPlaying(false); setHasFrame(false); }} />
        )}
        <div className="cinema-caption"><span>MAKE TIME FOR YOURSELF.</span>
          {media.video && <button type="button" className="cinema-control" onClick={toggleFilm} aria-label={playing ? "Pause hero film" : "Play hero film"}>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">{playing ? <path d="M6 4v12M14 4v12" stroke="currentColor" strokeWidth="2" /> : <path d="m6 3 10 7-10 7Z" fill="none" stroke="currentColor" strokeWidth="1.5" />}</svg>
            <span>{playing ? "Pause" : failed ? "Retry" : "Play"}</span>
          </button>}
        </div>
      </div>
    </section>
  );
}
