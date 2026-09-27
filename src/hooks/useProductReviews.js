import { useEffect, useState } from "react";
import { reviewStats } from "../utils/reviews.js";
export default function useProductReviews(product) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion((v) => v + 1);
    const sync = event => { if (event.key === "gymdrobe-reviews" || event.key === null) update(); };
    window.addEventListener("gymdrobe-reviews-updated", update);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gymdrobe-reviews-updated", update);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { ...reviewStats(product), version };
}