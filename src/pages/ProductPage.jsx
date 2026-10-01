import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import RecentlyViewed from "../components/RecentlyViewed.jsx";

import ProductOptions from "../components/ProductOptions.jsx";
import ProductReviews from "../components/ProductReviews.jsx";
import ProductRow from "../components/ProductRow.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";

import {
  ProductImage,
  categoryPath,
} from "../components/StorefrontShared.jsx";

import {
  productSpecs,
  rankRelated,
} from "../utils/commerce.js";

import {
  readStorage,
  writeStorage,
} from "../utils/storage.js";

import {
  useShoppingTools,
} from "../context/ShoppingToolsContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import useProductReviews from "../hooks/useProductReviews.js";


// ======================================================
// PRODUCT DETAIL
// ======================================================

function ProductDetail({
  product,
  products,
}) {
  const {
    compared,
    toggleCompare,
  } = useShoppingTools();

  const {
    notify,
    shoppingKey,
  } = useStore();

  const {
    rating,
    count,
  } = useProductReviews(
    product
  );

  const deliveryKey =
    shoppingKey(
      "gymdrobe-delivery-pincode"
    );

  const recentlyViewedKey =
    shoppingKey(
      "gymdrobe-recently-viewed"
    );

  const images = [
    ...new Set(
      [
        product.image,

        ...(
          Array.isArray(
            product.images
          )
            ? product.images
            : []
        ),
      ].filter(
        (src) =>
          typeof src ===
            "string" &&
          src.trim()
      )
    ),
  ];

  const [
    photo,
    setPhoto,
  ] = useState(
    images[0] || ""
  );

  const [
    zoom,
    setZoom,
  ] = useState(false);

  const [
    pincode,
    setPincode,
  ] = useState(() => {
    const saved =
      readStorage(
        deliveryKey,
        ""
      );

    return typeof saved ===
      "string"
      ? saved
      : "";
  });

  const [
    delivery,
    setDelivery,
  ] = useState("");

  const activePhoto =
    images.includes(photo)
      ? photo
      : images[0] || "";

  const photoIndex =
    images.indexOf(
      activePhoto
    );

  const isCompared =
    compared.some(
      (item) =>
        String(item.id) ===
        String(product.id)
    );

  const highlights =
    Array.isArray(
      product.highlights
    )
      ? product.highlights
      : Array.isArray(
            product.features
          )
        ? product.features
        : [];

  const careInstructions =
    Array.isArray(
      product.careInstructions
    )
      ? product.careInstructions

      : typeof product.careInstructions ===
            "string" &&
          product.careInstructions.trim()

        ? [
            product.careInstructions,
          ]

        : [];


  // ======================================================
  // PAGE TITLE
  // ======================================================

  useEffect(() => {
    document.title =
      `${product.name} | GymDrobe`;
  }, [product.name]);


  // ======================================================
  // RECENTLY VIEWED
  // ======================================================

  useEffect(() => {
    const saved =
      readStorage(
        recentlyViewedKey,
        []
      );

    const recentIds =
      Array.isArray(saved)
        ? saved
            .filter(
              (id) =>
                id != null
            )
            .map(String)
        : [];

    writeStorage(
      recentlyViewedKey,

      [
        ...new Set([
          String(
            product.id
          ),

          ...recentIds.filter(
            (id) =>
              id !==
              String(
                product.id
              )
          ),
        ]),
      ].slice(0, 8)
    );
  }, [
    product.id,
    recentlyViewedKey,
  ]);


  // ======================================================
  // RELATED PRODUCTS
  // ======================================================

  const related =
    rankRelated(
      product,
      products
    ).slice(
      0,
      5
    );


  // ======================================================
  // DELIVERY
  // ======================================================

  function checkDelivery(
    event
  ) {
    event.preventDefault();

    if (
      !/^[1-9]\d{5}$/.test(
        pincode
      )
    ) {
      setDelivery(
        "Enter a valid 6-digit pincode."
      );

      return;
    }

    writeStorage(
      deliveryKey,
      pincode
    );

    setDelivery(
      product.delivery
        ?.available ===
        false

        ? "This product is currently unavailable for delivery."

        : "Pincode format accepted. Delivery serviceability and dates will be confirmed when live shipping is connected."
    );
  }


  // ======================================================
  // SHARE
  // ======================================================

  async function share() {
    try {
      if (
        navigator.share
      ) {
        await navigator.share({
          title:
            product.name,

          url:
            window.location.href,
        });
      } else {
        await navigator
          .clipboard
          .writeText(
            window.location.href
          );

        notify(
          "Product link copied."
        );
      }
    } catch (error) {
      if (
        error.name !==
        "AbortError"
      ) {
        notify(
          "Copy this page’s address to share the product.",
          "info"
        );
      }
    }
  }


  // ======================================================
  // PAGE
  // ======================================================

  return (
    <div className="product-page">

      {/* BREADCRUMB */}

      <nav
        className="breadcrumb"
        aria-label="Breadcrumb"
      >
        <Link to="/">
          Home
        </Link>

        <span>/</span>

        <Link
          to={categoryPath(
            product.category
          )}
        >
          {product.category}
        </Link>

        <span>/</span>

        <span>
          {product.name}
        </span>
      </nav>


      {/* MAIN PRODUCT */}

      <div className="product-detail-layout">

        {/* GALLERY */}

        <div className="gallery">

          <button
            className="main-photo"
            type="button"
            disabled={
              !activePhoto
            }
            onClick={() =>
              setZoom(true)
            }
            aria-label={`Enlarge ${product.name} image`}
          >
            <ProductImage
              product={{
                ...product,

                image:
                  activePhoto,
              }}
              eager
            />
          </button>


          {images.length >
            1 && (

            <div className="thumbnails">

              {images.map(
                (
                  src,
                  index
                ) => (

                  <button
                    key={src}
                    type="button"
                    aria-label={`View product photo ${index + 1}`}
                    aria-pressed={
                      activePhoto ===
                      src
                    }
                    onClick={() =>
                      setPhoto(
                        src
                      )
                    }
                  >
                    <ProductImage
                      product={{
                        ...product,

                        image:
                          src,
                      }}
                      decorative
                    />
                  </button>
                )
              )}

            </div>
          )}

        </div>


        {/* PRODUCT INFO */}

        <div className="product-info">

          <p className="product-brand">
            {product.brand}
          </p>

          <h1>
            {product.name}
          </h1>


          {/* RATING */}

          {count > 0 && (

            <a
              className="detail-rating"
              href="#product-reviews"
            >
              {rating}{" "}

              <span>
                ★
              </span>

              {" | "}

              {count} reviews
            </a>
          )}


          {/* PRODUCT OPTIONS */}

          <ProductOptions
            product={
              product
            }
          />


          {/* DELIVERY */}

          <div className="delivery-box">

            <h2>
              DELIVERY OPTIONS
            </h2>

            <form
              onSubmit={
                checkDelivery
              }
            >
              <label
                className="sr-only"
                htmlFor="delivery-pincode"
              >
                Delivery pincode
              </label>

              <input
                id="delivery-pincode"
                placeholder="Enter pincode"
                value={
                  pincode
                }
                maxLength="6"
                inputMode="numeric"
                onChange={(
                  event
                ) => {
                  setPincode(
                    event
                      .target
                      .value
                      .replace(
                        /\D/g,
                        ""
                      )
                  );

                  setDelivery(
                    ""
                  );
                }}
              />

              <button
                className="text-link"
                type="submit"
              >
                Check
              </button>
            </form>


            {delivery && (
              <p role="status">
                {delivery}
              </p>
            )}


            <p>
              Standard delivery
              is free on
              qualifying totals
              of ₹500 or more
              after coupons.
            </p>


            <p>
              {
                product.returnPolicy ||
                "Return eligibility is shown with your order."
              }
            </p>

          </div>


          {/* PRODUCT DETAILS */}

          <details
            open
            className="product-description"
          >
            <summary>
              PRODUCT DETAILS
            </summary>

            <p>
              {
                product.description
              }
            </p>


            {highlights.length >
              0 && (

              <ul>
                {highlights.map(
                  (feature) => (
                    <li
                      key={
                        feature
                      }
                    >
                      {
                        feature
                      }
                    </li>
                  )
                )}
              </ul>
            )}


            <dl className="spec-grid">
              {productSpecs(
                product
              ).map(
                (
                  [
                    label,
                    value,
                  ]
                ) => (

                  <div
                    key={
                      label
                    }
                  >
                    <dt>
                      {
                        label
                      }
                    </dt>

                    <dd>
                      {
                        value
                      }
                    </dd>
                  </div>
                )
              )}
            </dl>
          </details>


          {/* CARE */}

          <details className="product-description">
            <summary>
              CARE INSTRUCTIONS
            </summary>

            {careInstructions
              .length ? (

              <ul>
                {careInstructions.map(
                  (line) => (
                    <li
                      key={
                        line
                      }
                    >
                      {line}
                    </li>
                  )
                )}
              </ul>

            ) : (

              <p>
                Follow the care
                label supplied
                with the product.
              </p>

            )}
          </details>


          {/* COMPARE / HELP */}

          <div className="bag-links">

            <button
              className="text-link"
              type="button"
              aria-pressed={
                isCompared
              }
              onClick={() =>
                toggleCompare(
                  product
                )
              }
            >
              {
                isCompared
                  ? "Remove from comparison"
                  : "Compare this product"
              }
            </button>


            <Link
              className="text-link"
              to={`/help?product=${encodeURIComponent(
                product.id
              )}`}
            >
              Ask about this
              product
            </Link>

          </div>


          <button
            type="button"
            className="text-link"
            onClick={
              share
            }
          >
            Share this product ↗
          </button>

        </div>

      </div>


      {/* REVIEWS */}

      <ProductReviews
        product={
          product
        }
      />


      {/* RELATED */}

      <ProductRow
        title="YOU MAY ALSO LIKE"
        products={
          related
        }
      />


      {/* RECENTLY VIEWED */}

      <RecentlyViewed
        exclude={
          product.id
        }
      />


      {/* IMAGE ZOOM */}

      {zoom && (

        <Modal
          title={
            product.name
          }
          onClose={() =>
            setZoom(false)
          }
          className="image-modal"
        >
          <ProductImage
            product={{
              ...product,

              image:
                activePhoto,
            }}
            eager
          />


          {images.length >
            1 && (

            <div className="pagination">

              <button
                type="button"
                onClick={() =>
                  setPhoto(
                    images[
                      (
                        photoIndex -
                        1 +
                        images.length
                      ) %
                        images.length
                    ]
                  )
                }
              >
                Previous photo
              </button>


              <span>
                {photoIndex + 1}
                {" / "}
                {images.length}
              </span>


              <button
                type="button"
                onClick={() =>
                  setPhoto(
                    images[
                      (
                        photoIndex +
                        1
                      ) %
                        images.length
                    ]
                  )
                }
              >
                Next photo
              </button>

            </div>
          )}

        </Modal>
      )}

    </div>
  );
}


// ======================================================
// PRODUCT PAGE
// ======================================================

export default function ProductPage() {
  const {
    id,
  } = useParams();

  const {
    products,
    loading,
    error,
    refreshProducts,
  } = useCatalog();


  // Support MongoDB ID,
  // old numeric ID and slug.
  const product =
    products.find(
      (item) =>
        String(
          item.id
        ) ===
          String(id) ||

        String(
          item._id
        ) ===
          String(id) ||

        String(
          item.legacyId
        ) ===
          String(id) ||

        String(
          item.slug
        ) ===
          String(id)
    );


  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <EmptyState
        title="Loading product..."
      >
        Getting the latest
        product information
        from GymDrobe.
      </EmptyState>
    );
  }


  // ======================================================
  // ERROR
  // ======================================================

  if (error) {
    return (
      <EmptyState
        title="Unable to load product"
      >
        <p>
          {error}
        </p>

        <button
          type="button"
          className="button"
          onClick={
            refreshProducts
          }
        >
          Try again
        </button>

        <p>
          <Link
            className="text-link"
            to="/shop"
          >
            Back to shop
          </Link>
        </p>
      </EmptyState>
    );
  }


  // ======================================================
  // NOT FOUND
  // ======================================================

  if (!product) {
    return (
      <EmptyState
        title="Product not found"
      >
        This product may no
        longer be available.{" "}

        <Link
          className="text-link"
          to="/shop"
        >
          Explore our current
          collection.
        </Link>
      </EmptyState>
    );
  }


  // ======================================================
  // PRODUCT
  // ======================================================

  return (
    <ProductDetail
      key={
        product.id
      }
      product={
        product
      }
      products={
        products
      }
    />
  );
}