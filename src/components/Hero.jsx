import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

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

import ProductArtwork from "./ProductArtwork.jsx";


// ======================================================
// HIGHEST REAL DISCOUNT
// ======================================================

function highestDiscount(
  items
) {
  return Math.max(
    0,

    ...items.map(
      (
        product
      ) => {
        const price =
          priceDetails(
            product
          );


        return price.valid
          ? price.discount
          : 0;
      }
    )
  );
}


// ======================================================
// CAMPAIGN IMAGE
// ======================================================

function CampaignPhoto({
  slide,
}) {
  const [
    failedBanner,
    setFailedBanner,
  ] =
    useState("");


  const hasBanner =
    Boolean(
      slide.bannerImage
    ) &&
    failedBanner !==
      slide.bannerImage;


  return (
    <Link
      className="gm-campaign-photo"
      to={
        slide.href
      }
      aria-label={`Shop ${slide.title}`}
    >
      {hasBanner ? (
        <img
          className="gm-editorial-image"
          src={
            slide.bannerImage
          }
          alt=""
          loading="eager"
          decoding="async"
          style={{
            objectPosition:
              slide.bannerPosition ||
              "center",
          }}
          onError={() =>
            setFailedBanner(
              slide.bannerImage
            )
          }
        />

      ) : slide.product
          ?.image ? (
        <ProductImage
          product={
            slide.product
          }
          eager
          decorative
        />

      ) : (
        <div
          className="campaign-art"
          aria-hidden="true"
        >
          <div className="campaign-art-copy">
            <span>
              GYMDROBE
            </span>


            <strong>
              TRAIN.
              <br />

              MOVE.
              <br />

              <em>
                REPEAT.
              </em>
            </strong>


            <p>
              Gear for every session.
            </p>
          </div>


          <div className="campaign-art-product">
            <ProductArtwork
              category={
                slide.title
              }
              name={
                slide.product
                  ?.name
              }
            />


            <small>
              GymDrobe collection
            </small>
          </div>
        </div>
      )}


      <span className="gm-campaign-brand">
        {slide.product
          ?.brand ||
          "GymDrobe"}
      </span>
    </Link>
  );
}


// ======================================================
// HERO
// ======================================================

export default function Hero() {
  const {
    products,
  } =
    useCatalog();


  const [
    active,
    setActive,
  ] =
    useState(0);


  const [
    paused,
    setPaused,
  ] =
    useState(false);


  const [
    hovered,
    setHovered,
  ] =
    useState(false);


  const [
    focused,
    setFocused,
  ] =
    useState(false);


  const [
    hidden,
    setHidden,
  ] =
    useState(false);


  const [
    reduceMotion,
    setReduceMotion,
  ] =
    useState(false);


  // ====================================================
  // BUILD HERO COLLECTIONS FROM REAL PRODUCT DATA
  // ====================================================

  const {
    slides,
    maxDiscount,
  } =
    useMemo(
      () => {
        const available =
          validProducts(
            products
          ).filter(
            inStock
          );


        const grouped =
          new Map();


        for (
          const product of
          available
        ) {
          const name =
            typeof product.category ===
            "string"
              ? product.category.trim()
              : "";


          const key =
            name ||
            "Workout Essentials";


          if (
            !grouped.has(
              key
            )
          ) {
            grouped.set(
              key,
              {
                name,
                items: [],
              }
            );
          }


          grouped
            .get(
              key
            )
            .items.push(
              product
            );
        }


        const categoryData =
          Array.isArray(
            categories
          )
            ? categories
            : [];


        const featured = [
          ...grouped.entries(),
        ]
          .slice(
            0,
            5
          )
          .map(
            (
              [
                title,
                group,
              ]
            ) => {
              const product =
                group.items.find(
                  (
                    item
                  ) =>
                    item.image
                ) ||
                group.items[0];


              const category =
                categoryData.find(
                  (
                    item
                  ) =>
                    item?.name ===
                    group.name
                );


              const customBanner =
                category
                  ?.bannerImage ||
                product
                  ?.bannerImage;


              return {
                id:
                  title,

                title,

                product,

                discount:
                  highestDiscount(
                    group.items
                  ),

                href:
                  group.name
                    ? categoryPath(
                        group.name
                      )
                    : "/shop",

                bannerImage:
                  typeof customBanner ===
                  "string"
                    ? customBanner
                    : "",

                bannerPosition:
                  category
                    ?.bannerPosition ||
                  product
                    ?.bannerPosition,
              };
            }
          );


        return {
          maxDiscount:
            highestDiscount(
              available
            ),

          slides:
            featured.length
              ? featured
              : [
                  {
                    id:
                      "collection",

                    title:
                      "Workout Essentials",

                    href:
                      "/shop",

                    discount:
                      0,
                  },
                ],
        };
      },

      [
        products,
      ]
    );


  // ====================================================
  // REDUCED MOTION + PAGE VISIBILITY
  // ====================================================

  useEffect(
    () => {
      const media =
        window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        );


      const update =
        () =>
          setReduceMotion(
            media.matches
          );


      const visibility =
        () =>
          setHidden(
            document.hidden
          );


      update();
      visibility();


      media.addEventListener(
        "change",
        update
      );


      document.addEventListener(
        "visibilitychange",
        visibility
      );


      return () => {
        media.removeEventListener(
          "change",
          update
        );


        document.removeEventListener(
          "visibilitychange",
          visibility
        );
      };
    },

    []
  );


  // ====================================================
  // AUTO ROTATE
  // ====================================================

  useEffect(
    () => {
      if (
        paused ||
        hovered ||
        focused ||
        hidden ||
        reduceMotion ||
        slides.length <
          2
      ) {
        return;
      }


      const timer =
        window.setInterval(
          () =>
            setActive(
              (
                value
              ) =>
                (
                  value +
                  1
                ) %
                slides.length
            ),

          6000
        );


      return () =>
        window.clearInterval(
          timer
        );
    },

    [
      paused,
      hovered,
      focused,
      hidden,
      reduceMotion,
      slides.length,
    ]
  );


  const slide =
    slides[
      active
    ] ||
    slides[0];


  // ====================================================
  // SELECT SLIDE
  // ====================================================

  function select(
    index
  ) {
    setActive(
      (
        index +
        slides.length
      ) %
        slides.length
    );


    setPaused(
      true
    );
  }


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <section
      className="gm-hero"
      aria-label="GymDrobe fitness store"
      aria-roledescription="carousel"
      onPointerEnter={(
        event
      ) => {
        if (
          event.pointerType ===
          "mouse"
        ) {
          setHovered(
            true
          );
        }
      }}
      onPointerLeave={() =>
        setHovered(
          false
        )
      }
      onFocusCapture={() =>
        setFocused(
          true
        )
      }
      onBlurCapture={(
        event
      ) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget
          )
        ) {
          setFocused(
            false
          );
        }
      }}
    >
      {/* =================================================
          REAL PROMOTION
      ================================================= */}

      <Link
        to={
          maxDiscount >
          0
            ? "/shop?discount=1"
            : "/shop"
        }
        className={`gm-offer-ticket${
          maxDiscount >
          0
            ? ""
            : " gm-ticket-collection"
        }`}
      >
        <span className="gm-ticket-main">
          {maxDiscount >
          0 ? (
            <>
              UP TO{" "}

              <strong>
                {maxDiscount}%
                OFF
              </strong>
            </>
          ) : (
            "GYMDROBE FITNESS STORE"
          )}
        </span>


        <span className="gm-ticket-side">
          <span>
            {maxDiscount >
            0
              ? "Real discounts on selected workout essentials"
              : "Everything you need for every workout"}
          </span>


          <strong>
            Shop now{" "}

            <Arrow />
          </strong>
        </span>
      </Link>


      {/* =================================================
          MAIN HERO
      ================================================= */}

      <div
        className="gm-campaign"
        key={
          slide.id
        }
        role="group"
        aria-roledescription="slide"
        aria-label={`${active + 1} of ${slides.length}`}
      >
        {/* ===============================================
            VISUAL
        =============================================== */}

        <CampaignPhoto
          slide={
            slide
          }
        />


        {/* ===============================================
            CRO COPY
        =============================================== */}

        <div className="gm-campaign-copy">
          <p className="eyebrow">
            GYMDROBE
          </p>


          <h1>
            Everything You Need for Every Workout.
          </h1>


          <p className="gm-campaign-discount">
            Shop workout clothing, shoes and gym essentials in one fitness-focused store.
          </p>


          {/* =============================================
              PRIMARY CTAS
          ============================================= */}

          <div className="gm-hero-actions">
            <Link
              to="/shop"
              className="button"
            >
              Shop Now
            </Link>


            <a
              href="#categories"
              className="button secondary"
            >
              Explore Categories
            </a>
          </div>


          {/* =============================================
              CURRENT COLLECTION
          ============================================= */}

          <div className="gm-hero-featured">
            <span>
              Featured:
            </span>


            <Link
              to={
                slide.href
              }
              className="gm-explore-link"
            >
              {slide.title}

              {" "}

              <Arrow />
            </Link>


            {slide.discount >
              0 && (
              <strong>
                Up to{" "}
                {slide.discount}%
                off
              </strong>
            )}
          </div>


          {/* =============================================
              TRUST
          ============================================= */}

          <div
            className="gm-hero-trust"
            aria-label="GymDrobe checkout benefits"
          >
            <span>
              ✓ Secure Razorpay payments
            </span>


            <span>
              ✓ Full online or COD with 10% advance
            </span>


            <span>
              ✓ Delivery & return details shown before purchase
            </span>
          </div>
        </div>
      </div>


      {/* =================================================
          CAROUSEL CONTROLS
      ================================================= */}

      {slides.length >
        1 && (
        <div className="gm-carousel-controls">
          <button
            className="gm-carousel-arrow"
            type="button"
            aria-label="Previous collection"
            onClick={() =>
              select(
                active -
                1
              )
            }
          >
            <Arrow direction="left" />
          </button>


          <div className="gm-carousel-dots">
            {slides.map(
              (
                item,
                index
              ) => (
                <button
                  key={
                    item.id
                  }
                  type="button"
                  aria-label={`Show ${item.title}`}
                  aria-current={
                    active ===
                    index
                      ? "true"
                      : undefined
                  }
                  onClick={() =>
                    select(
                      index
                    )
                  }
                >
                  <span />
                </button>
              )
            )}
          </div>


          <button
            className="gm-carousel-arrow"
            type="button"
            aria-label="Next collection"
            onClick={() =>
              select(
                active +
                1
              )
            }
          >
            <Arrow />
          </button>


          {!reduceMotion && (
            <button
              className="gm-play"
              type="button"
              aria-label={
                paused
                  ? "Play banner rotation"
                  : "Pause banner rotation"
              }
              aria-pressed={
                paused
              }
              onClick={() =>
                setPaused(
                  (
                    value
                  ) =>
                    !value
                )
              }
            >
              {paused
                ? "Play"
                : "Pause"}
            </button>
          )}
        </div>
      )}


      {/* =================================================
          BRAND VALUE BAND
      ================================================= */}

      <Link
        to="/shop"
        className="gm-collection-band"
      >
        <span
          className="gm-band-mark"
          aria-hidden="true"
        >
          GD
        </span>


        <span className="gm-band-copy">
          <strong>
            Built for your workout routine.
          </strong>


          <span>
            Clothing · Footwear · Hydration · Gym essentials
          </span>
        </span>


        <strong>
          Shop all
        </strong>


        <Arrow />
      </Link>
    </section>
  );
}