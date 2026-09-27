import { useEffect, useState } from "react";
import { reviewStats } from "../utils/reviews.js";
export default function useProductReviews(product) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const update = () => setVersion((v) => v + 1);
    window.addEventListener("gymdrobe-reviews-updated", update);
    return () => window.removeEventListener("gymdrobe-reviews-updated", update);
  }, []);
  return { ...reviewStats(product), version };
}