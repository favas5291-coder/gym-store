import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCatalog } from "../context/CatalogContext.jsx";
import categories from "../data/categories";
import {
  Arrow,
  ProductImage,
  categoryPath,
  inStock,
  priceDetails,
  validProducts,
} from "./StorefrontShared";
import "./GymDrobeStorefront.css";

function highestDiscount(items) {
  return Math.max(
    0,
    ...items.map((product) => {
      const price = priceDetails(product);
      return price.valid ? price.discount : 0;
    }),
  );
}

function CampaignPhoto({ slide }) {
  const [failedBanner, setFailedBanner] = useState("");
  const hasBanner =
    Boolean(slide.bannerImage) && failedBanner !== slide.bannerImage;
  return (
    <Link
      className="gm-campaign-photo"
      to={slide.href}
      aria-label={`Explore ${slide.title}`}
    >
      {hasBanner ? (
        <img
          className="gm-editorial-image"
          src={slide.bannerImage}
          alt=""
          loading="eager"
          decoding="async"
          style={{ objectPosition: slide.bannerPosition || "center" }}
          onError={() => setFailedBanner(slide.bannerImage)}
        />
      ) : slide.product ? (
        <ProductImage product={slide.product} eager decorative />
      ) : (
        <span className="gm-campaign-placeholder" aria-hidden="true">
          GYM
          <br />
          DROBE
        </span>
      )}
      <span className="gm-campaign-brand">
        {slide.product?.brand || "GymDrobe"}
      </span>
    </Link>
  );
}

export default function Hero() {
  const { products } = useCatalog();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { slides, maxDiscount } = useMemo(() => {
    const available = validProducts(products).filter(inStock);
    const grouped = new Map();
    for (const product of available) {
      const name =
        typeof product.category === "string" ? product.category.trim() : "";
      const key = name || "Workout Essentials";
      if (!grouped.has(key)) grouped.set(key, { name, items: [] });
      grouped.get(key).items.push(product);
    }
    const categoryData = Array.isArray(categories) ? categories : [];
    const featured = [...grouped.entries()]
      .slice(0, 5)
      .map(([title, group]) => {
        const product =
          group.items.find((item) => item.image) || group.items[0];
        const category = categoryData.find((item) => item?.name === group.name);
        const customBanner = category?.bannerImage || product.bannerImage;
        return {
          id: title,
          title,
          product,
          discount: highestDiscount(group.items),
          href: group.name ? categoryPath(group.name) : "/shop",
          // Optional: a wide campaign image in your category or product data.
          bannerImage: typeof customBanner === "string" ? customBanner : "",
          bannerPosition: category?.bannerPosition || product.bannerPosition,
        };
      });
    return {
      maxDiscount: highestDiscount(available),
      slides: featured.length
        ? featured
        : [
            {
              id: "collection",
              title: "Your Workout Wardrobe",
              href: "/shop",
              discount: 0,
            },
          ],
    };
  }, [products]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    const visibility = () => setHidden(document.hidden);
    update();
    visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (
      paused ||
      hovered ||
      focused ||
      hidden ||
      reduceMotion ||
      slides.length < 2
    )
      return;
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [paused, hovered, focused, hidden, reduceMotion, slides.length]);

  const slide = slides[active] || slides[0];
  function select(index) {
    setActive((index + slides.length) % slides.length);
    setPaused(true);
  }

  return (
    <section
      className="gm-hero"
      aria-label="GymDrobe collections"
      aria-roledescription="carousel"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <Link
        to="/shop"
        className={`gm-offer-ticket${maxDiscount > 0 ? "" : " gm-ticket-collection"}`}
      >
        <span className="gm-ticket-main">
          {maxDiscount > 0 ? (
            <>
              UP TO <strong>{maxDiscount}% OFF</strong>
            </>
          ) : (
            "YOUR WORKOUT EDIT"
          )}
        </span>
        <span className="gm-ticket-side">
          <span>
            {maxDiscount > 0
              ? "On selected workout gear"
              : "Everything for your next session"}
          </span>
          <strong>
            Explore GymDrobe <Arrow />
          </strong>
        </span>
      </Link>
      <div
        className="gm-campaign"
        key={slide.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`${active + 1} of ${slides.length}`}
      >
        <CampaignPhoto slide={slide} />
        <div className="gm-campaign-copy">
          <h1>{slide.title}</h1>
          <p className="gm-campaign-discount">
            {slide.discount > 0
              ? `Up to ${slide.discount}% Off`
              : "Find Your Next Favourite"}
          </p>
          <Link to={slide.href} className="gm-explore-link">
            <span aria-hidden="true">+</span> Explore
          </Link>
        </div>
      </div>
      {slides.length > 1 && (
        <div className="gm-carousel-controls">
          <button
            className="gm-carousel-arrow"
            type="button"
            aria-label="Previous collection"
            onClick={() => select(active - 1)}
          >
            <Arrow direction="left" />
          </button>
          <div className="gm-carousel-dots">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show collection ${index + 1}`}
                aria-current={active === index ? "true" : undefined}
                onClick={() => select(index)}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            className="gm-carousel-arrow"
            type="button"
            aria-label="Next collection"
            onClick={() => select(active + 1)}
          >
            <Arrow />
          </button>
          {!reduceMotion && (
            <button
              className="gm-play"
              type="button"
              aria-label={
                paused ? "Play banner rotation" : "Pause banner rotation"
              }
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? "Play" : "Pause"}
            </button>
          )}
        </div>
      )}
      <Link to="/shop" className="gm-collection-band">
        <span className="gm-band-mark" aria-hidden="true">
          GD
        </span>
        <span className="gm-band-copy">
          <strong>Everything for every workout.</strong>
          <span>Clothing, shoes & everyday gym essentials</span>
        </span>
        <Arrow />
      </Link>
    </section>
  );
}