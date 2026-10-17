import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  ProductImage,
  categoryPath,
  resolveProductImage,
} from "./StorefrontShared.jsx";

const PHOTO_INTERVAL = 5000;

export default function CategoryCard({
  name,
  icon,
  images = [],
  offer,
  comingSoon = false,
  outOfStock = false,
  autoRotate = false,
}) {
  const sources = [
    ...new Set(
      [
        icon,
        ...(Array.isArray(images) ? images : []),
      ]
        .map(resolveProductImage)
        .filter(Boolean),
    ),
  ];

  const signature = JSON.stringify(sources);

  const [position, setPosition] = useState({
    signature,
    index: 0,
  });

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const index =
    position.signature === signature &&
    sources.length
      ? position.index % sources.length
      : 0;

  useEffect(() => {
    if (
      !autoRotate ||
      comingSoon ||
      hovered ||
      focused ||
      sources.length < 2
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (
        document.visibilityState === "hidden" ||
        reducedMotion
      ) {
        return;
      }

      setPosition((current) => ({
        signature,

        index:
          current.signature === signature
            ? (current.index + 1) % sources.length
            : 1,
      }));
    }, PHOTO_INTERVAL);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    signature,
    autoRotate,
    comingSoon,
    hovered,
    focused,
    sources.length,
  ]);

  const gallery = [
    ...sources.slice(index),
    ...sources.slice(0, index),
  ];

  const content = (
    <>
      <div className="gm-category-image">
        <ProductImage
          product={{
            name,
            category: name,
            image: gallery[0] || "",
            images: gallery,
          }}
          decorative
        />
      </div>

      <div className="gm-category-copy">
        <h3>{name}</h3>

        <strong>
          {comingSoon
            ? "COMING SOON"
            : outOfStock
              ? "OUT OF STOCK"
              : offer || "SHOP THE EDIT"}
        </strong>

        <span>
          {comingSoon
            ? "More gear on the way"
            : outOfStock
              ? "View collection"
              : "Shop Now"}
        </span>
      </div>
    </>
  );

  if (comingSoon) {
    return (
      <article className="gm-category-card gm-coming-soon">
        {content}
      </article>
    );
  }

  return (
    <Link
      className="gm-category-card"
      to={categoryPath(name)}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") {
          setHovered(true);
        }
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {content}
    </Link>
  );
}