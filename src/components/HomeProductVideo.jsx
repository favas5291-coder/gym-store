import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { productVideo } from "../utils/productVideo.js";
import { money, priceDetails, productPath, ProductImage, resolveProductImage } from "./StorefrontShared.jsx";

function Playlist({ clips, fallback }) {
  const frame = useRef(null);
  const player = useRef(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState([]);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [paused, setPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const available = clips.filter(clip => !failed.includes(clip.media.url));
  const clip = available[index % available.length];
  const product = clip?.product ?? fallback;
  const to = productPath(product.id ?? product._id);

  useEffect(() => {
    const load = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setNear(true);
    }, { rootMargin: "160px" });
    const view = new IntersectionObserver(([entry]) => {
      setVisible(entry.intersectionRatio >= 0.4);
    }, { threshold: 0.4 });
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => setReducedMotion(preference.matches);
    const onVisibility = () => setHidden(document.hidden);
    load.observe(frame.current);
    view.observe(frame.current);
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      load.disconnect();
      view.disconnect();
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const video = player.current;
    if (!video) return;
    if (paused || reducedMotion || !visible || hidden) {
      video.pause();
      return;
    }
    let current = true;
    video.play().catch(() => { if (current) setBlocked(true); });
    return () => { current = false; };
  }, [clip, near, paused, reducedMotion, visible, hidden]);

  function advance(event) {
    if (available.length === 1) {
      if (!paused && !hidden && visible && !reducedMotion) {
        event.currentTarget.currentTime = 0;
        event.currentTarget.play().catch(() => setBlocked(true));
      }
      return;
    }
    setBlocked(false);
    setIndex(next => (next + 1) % available.length);
  }

  return <section className="gm-section home-new" aria-labelledby="home-new-title">
    <h2 id="home-new-title">{clip ? "See the Gear in Action" : "Product Spotlight"}</h2>
    <div className="home-product-feature">
      <div className="home-video-frame" ref={frame}>
        {clip?.media.kind === "file" && near ? <>
          <video key={clip.media.url} ref={player} src={clip.media.src}
            poster={resolveProductImage(product.image) || undefined}
            aria-label={`${product.name} demonstration`}
            muted playsInline controls preload="metadata"
            onPlay={() => { setPaused(false); setBlocked(false); }}
            onPause={event => {
              if (!event.currentTarget.ended && visible && !hidden && !reducedMotion) setPaused(true);
            }}
            onEnded={advance}
            onError={() => { setBlocked(false); setFailed(urls => [...urls, clip.media.url]); }}
          />
          {blocked && <button className="button home-video-play" type="button"
            onClick={() => player.current?.play().catch(() => setBlocked(true))}>Play video</button>}
        </> :
          <Link className="home-feature-photo" to={to}><ProductImage product={product} /></Link>}
      </div>
      <div className="home-feature-copy">
        <h3>{product.name}</h3>
        <p>{money(priceDetails(product).selling)}</p>
        <Link className="button" to={to}>Shop this product</Link>
      </div>
    </div>
  </section>;
}

export default function HomeProductVideo({ products, fallback }) {
  const clips = products.flatMap(product => {
    const media = productVideo(product.videoUrl);
    return media?.kind === "file" ? [{ product, media }] : [];
  });
  return <Playlist key={clips.map(clip => clip.media.url).join("|")} clips={clips} fallback={fallback} />;
}
