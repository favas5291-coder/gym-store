import { useEffect, useState } from "react";
import { TextLink } from "./PremiumControls.jsx";
import { getFitnessKits } from "../services/kitApi.js";

export default function HomeKits() {
  const [kits, setKits] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    getFitnessKits({ signal: controller.signal }).then(rows => { if (!controller.signal.aborted) setKits(rows.filter(kit => kit.isActive !== false)); }).catch(() => {});
    return () => controller.abort();
  }, []);
  if (!kits.length) return null;
  return <section className="gm-section home-kits" aria-labelledby="home-kit-title">
    <div><p className="eyebrow">YOUR ROUTINE, TOGETHER</p><h2 id="home-kit-title">Build your workout kit.</h2><p>Choose a kit, make it yours, and review delivery before you buy.</p></div>
    <div className="home-kit-options">{kits.slice(0, 3).map(kit => <TextLink key={kit.id} to={`/kits/${encodeURIComponent(kit.id)}`}>{kit.name}</TextLink>)}</div>
  </section>;
}
