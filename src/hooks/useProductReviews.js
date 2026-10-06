import {
  useEffect,
  useState,
} from "react";

import {
  reviewStats,
} from "../utils/reviews.js";

export default function useProductReviews(
  product,
) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    function refreshReviews() {
      setVersion((current) => current + 1);
    }

    window.addEventListener(
      "gymdrobe-reviews-updated",
      refreshReviews,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-reviews-updated",
        refreshReviews,
      );
    };
  }, []);

  return {
    ...reviewStats(product),
    version,
  };
}