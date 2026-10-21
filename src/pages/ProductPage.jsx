import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  productImageSources,
  isProductImageSource,
} from "../utils/productImages.js";

import {
  firstOptions,
} from "../utils/cartUtils.js";

import RecentlyViewed from "../components/RecentlyViewed.jsx";
import ProductOptions from "../components/ProductOptions.jsx";
import DeliveryPincode from "../components/DeliveryPincode.jsx";
import ProductVideo from "../components/ProductVideo.jsx";
import ProductReviews from "../components/ProductReviews.jsx";
import ProductRow from "../components/ProductRow.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Modal from "../components/Modal.jsx";

import {
  ProductImage,
  categoryPath,
  resolveProductImage,
} from "../components/StorefrontShared.jsx";

import {
  rankRelated,
} from "../utils/commerce.js";

import {
  readStorage,
  writeStorage,
} from "../utils/storage.js";

import {
  trackProductView,
} from "../utils/analytics.js";

import {
  useShoppingTools,
} from "../context/ShoppingToolsContext.jsx";

import {
  useStore,
} from "../context/StoreContext.jsx";

import {
  useCatalog,
} from "../context/CatalogContext.jsx";

import {
  money,
} from "../utils/productPricing.js";

import useProductReviews from "../hooks/useProductReviews.js";

import {
  buyingInformation,
  customerSpecifications,
  productList,
  productText,
  supplierSizeChart,
} from "../utils/productInformation.js";

import {
  EXPRESS_SHIPPING,
  FREE_SHIPPING_LIMIT,
  STANDARD_SHIPPING,
} from "../utils/orderCalculations.js";

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
  } = useProductReviews(product);

  const productId =
    product.id ?? product._id;

  const information =
    buyingInformation(product);

  const sizeChart =
    supplierSizeChart(product);

  const specifications =
    customerSpecifications(product);

  const description =
    productText(product.description);

  const included =
    productText(product.whatsIncluded);

  const deliveryKey = shoppingKey(
    "gymdrobe-delivery-pincode",
  );

  const recentlyViewedKey = shoppingKey(
    "gymdrobe-recently-viewed",
  );

  useEffect(() => {
    const track = () =>
      trackProductView(product);

    track();

    window.addEventListener(
      "gymdrobe-analytics-ready",
      track,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-analytics-ready",
        track,
      );
    };
  }, [product.id, product._id]);

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const [
    selectedColor,
    setSelectedColor,
  ] = useState(() => {
    const requested =
      searchParams.get("colour");

    return (
      Array.isArray(product.colors) &&
      product.colors.includes(requested)
    )
      ? requested
      : firstOptions(product).selectedColor;
  });

  const hasColorPhotos =
    Array.isArray(product.colorImages) &&
    product.colorImages.some(
      (row) =>
        row?.color === selectedColor &&
        Array.isArray(row.images) &&
        row.images.some(
          isProductImageSource,
        ),
    );

  const images = [
    ...new Set(
      productImageSources(
        product,
        selectedColor,
      )
        .map(resolveProductImage)
        .filter(Boolean),
    ),
  ];

  const [photo, setPhoto] = useState({
    color: selectedColor,
    source: images[0] || "",
  });

  const [zoom, setZoom] =
    useState(false);

  const chooseGalleryColor = useCallback(
    (color) => {
      setSelectedColor(color);

      // Reset to the new colour's first photo.
      setPhoto({
        color,
        source: "",
      });

      setZoom(false);

      // Preserve the colour when refreshing or sharing.
      setSearchParams(
        (current) => {
          const next =
            new URLSearchParams(current);

          if (color) {
            next.set("colour", color);
          } else {
            next.delete("colour");
          }

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const activePhoto =
    photo.color === selectedColor &&
    images.includes(photo.source)
      ? photo.source
      : images[0] || "";

  const photoIndex = Math.max(
    0,
    images.indexOf(activePhoto),
  );

  function galleryProduct(source) {
    return {
      ...product,

      name:
        `${product.name}` +
        (
          selectedColor && hasColorPhotos
            ? ` · ${selectedColor}`
            : " · Default product photo"
        ),

      // Explicit gallery photos should not be replaced
      // again by the shared image component.
      selectedColor: null,
      colorImages: [],
      image: source,
      images: [],
    };
  }

  function movePhoto(direction) {
    if (!images.length) {
      return;
    }

    const nextIndex =
      (
        photoIndex +
        direction +
        images.length
      ) % images.length;

    setPhoto({
      color: selectedColor,
      source: images[nextIndex],
    });
  }

  const isCompared = (
    Array.isArray(compared)
      ? compared
      : []
  ).some(
    (item) =>
      item &&
      String(item.id ?? item._id) ===
        String(productId),
  );

  const highlights = productList(
    Array.isArray(product.highlights) &&
    product.highlights.length
      ? product.highlights
      : product.features,
  );

  const careInstructions = productList(
    product.careInstructions,
  );

  useEffect(() => {
    const saved = readStorage(
      recentlyViewedKey,
      [],
    );

    const recentIds = Array.isArray(saved)
      ? saved
          .filter(
            (value) =>
              typeof value === "string" ||
              typeof value === "number",
          )
          .map(
            (value) =>
              String(value).trim(),
          )
          .filter(Boolean)
      : [];

    writeStorage(
      recentlyViewedKey,
      [
        ...new Set([
          String(productId),

          ...recentIds.filter(
            (value) =>
              value !== String(productId),
          ),
        ]),
      ].slice(0, 8),
    );
  }, [
    productId,
    recentlyViewedKey,
  ]);

  const related = rankRelated(
    product,
    products,
  )
    .filter(
      (item) =>
        item.isActive !== false &&
        item.delivery?.available !== false,
    )
    .slice(0, 5);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(
          window.location.href,
        );

        notify("Product link copied.");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        notify(
          "Copy this page's address to share the product.",
          "info",
        );
      }
    }
  }

  return (
    <div className="product-page">
      <nav
        className="breadcrumb"
        aria-label="Breadcrumb"
      >
        <Link to="/">Home</Link>

        <span aria-hidden="true">
          /
        </span>

        <Link
          to={
            product.category
              ? categoryPath(product.category)
              : "/shop"
          }
        >
          {product.category || "Shop"}
        </Link>

        <span aria-hidden="true">
          /
        </span>

        <span aria-current="page">
          {product.name}
        </span>
      </nav>

      <div className="product-detail-layout">
        <div className="gallery gd-color-gallery">
          <button
            className="main-photo"
            type="button"
            disabled={!activePhoto}
            onClick={() => setZoom(true)}
            aria-label={
              `Enlarge ${product.name} image`
            }
            aria-haspopup="dialog"
          >
            <ProductImage
              product={galleryProduct(
                activePhoto,
              )}
              eager
              fetchPriority="high"
            />
          </button>

          {images.length > 1 && (
            <div
              className="thumbnails"
              role="group"
              aria-label="Product photos"
            >
              {images.map(
                (source, index) => (
                  <button
                    key={source}
                    type="button"
                    aria-label={
                      `View ${
                        selectedColor || "product"
                      } photo ${index + 1}`
                    }
                    aria-pressed={
                      activePhoto === source
                    }
                    onClick={() =>
                      setPhoto({
                        color: selectedColor,
                        source,
                      })
                    }
                  >
                    <ProductImage
                      product={galleryProduct(
                        source,
                      )}
                      decorative
                    />
                  </button>
                ),
              )}
            </div>
          )}

          {selectedColor &&
            !hasColorPhotos && (
              <p
                className="muted"
                role="status"
              >
                Showing default product photos.
                Photos for {selectedColor} have
                not been added.
              </p>
            )}

          <p className="muted">
            {activePhoto
              ? "Select an image to view it larger."
              : "Product photography is currently unavailable."}
          </p>

          <ProductVideo product={product} />
        </div>

        <div className="product-info">
          <div className="product-title-meta">
            <p className="product-brand">
              {productText(product.brand) ||
                "Brand not listed"}
            </p>
          </div>

          <h1>{product.name}</h1>

          {description && (
            <p className="product-summary">
              {description}
            </p>
          )}

          {count > 0 ? (
            <a
              className="detail-rating"
              href="#product-reviews"
              aria-label={
                `${rating} out of 5 from ` +
                `${count} reviews. Jump to reviews.`
              }
            >
              <strong>{rating}</strong>{" "}

              <span aria-hidden="true">
                ★
              </span>

              {" · "}

              {count}{" "}
              {count === 1
                ? "review"
                : "reviews"}
            </a>
          ) : (
            <p className="muted">
              No customer reviews yet
            </p>
          )}

          <ProductOptions
            onColorChange={
              chooseGalleryColor
            }
            product={{
              ...product,
              selectedColor,

              returnPolicy:
                information.returns,

              delivery: {
                ...product.delivery,

                estimatedDays:
                  information.deliveryUnavailable
                    ? ""
                    : information.estimate,
              },
            }}
          />

          <div
            className="delivery-box"
            id="delivery-returns"
          >
            <h2>DELIVERY & RETURNS</h2>

            <DeliveryPincode
              product={product}
              storageKey={deliveryKey}
            />

            <p>
              <strong>
                Standard shipping:
              </strong>{" "}

              {money(STANDARD_SHIPPING)} below{" "}
              {money(FREE_SHIPPING_LIMIT)};
              free from{" "}
              {money(FREE_SHIPPING_LIMIT)} on
              the product subtotal after coupons.
            </p>

            <p>
              Express shipping:{" "}
              {money(EXPRESS_SHIPPING)} where
              offered. Checkout confirms the final
              charges and available delivery methods.
            </p>

            <p>
              <strong>Returns:</strong>{" "}
              {information.returns}
            </p>

            {information.returnDetails.map(
              (line, index) => (
                <p key={index}>
                  {line}
                </p>
              ),
            )}

            <Link
              className="text-link"
              to={
                `/help?product=${encodeURIComponent(
                  productId,
                )}`
              }
            >
              Ask about delivery or return conditions →
            </Link>
          </div>

          <details
            open
            className="product-description"
          >
            <summary>
              PRODUCT DETAILS
            </summary>

            {description ? (
              <p>{description}</p>
            ) : (
              <p>
                Detailed product information has
                not been supplied yet.
              </p>
            )}

            {highlights.length > 0 && (
              <>
                <h3>
                  Listed product features
                </h3>

                <ul>
                  {highlights.map(
                    (feature, index) => (
                      <li
                        key={`${index}-${feature}`}
                      >
                        {feature}
                      </li>
                    ),
                  )}
                </ul>
              </>
            )}

            {included && (
              <p>
                <strong>
                  What's included:
                </strong>{" "}

                {included}
              </p>
            )}

            <dl className="spec-grid">
              {specifications.map(
                ([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
              )}
            </dl>
          </details>

          {sizeChart && (
            <details className="product-description">
              <summary>
                SUPPLIER SIZE CHART
              </summary>

              <p className="muted">
                Use the units and measuring
                instructions supplied in this chart.
                Size labels can differ between brands.
              </p>

              <div
                className="comparison-scroll"
                tabIndex={0}
                role="region"
                aria-label="Supplier size chart; scroll to see all columns"
              >
                <table className="data-table">
                  <caption>
                    {sizeChart.caption}
                  </caption>

                  <thead>
                    <tr>
                      {sizeChart.columns.map(
                        (column, index) => (
                          <th
                            key={index}
                            scope="col"
                          >
                            {column}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {sizeChart.rows.map(
                      (row, index) => (
                        <tr key={index}>
                          {row.map(
                            (value, cell) =>
                              cell === 0 ? (
                                <th
                                  key={cell}
                                  scope="row"
                                >
                                  {value}
                                </th>
                              ) : (
                                <td key={cell}>
                                  {value}
                                </td>
                              ),
                          )}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <details className="product-description">
            <summary>
              CARE INSTRUCTIONS
            </summary>

            {careInstructions.length ? (
              <ul>
                {careInstructions.map(
                  (line, index) => (
                    <li key={`${index}-${line}`}>
                      {line}
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p>
                Follow the care label supplied
                with the product.
              </p>
            )}
          </details>

          <div className="bag-links">
            <button
              className="text-link"
              type="button"
              aria-pressed={isCompared}
              onClick={() =>
                toggleCompare(product)
              }
            >
              {isCompared
                ? "✓ Added to comparison"
                : "+ Compare product"}
            </button>

            <Link
              className="text-link"
              to={
                `/help?product=${encodeURIComponent(
                  productId,
                )}`
              }
            >
              Need help choosing?
            </Link>

            <button
              type="button"
              className="text-link"
              onClick={share}
            >
              Share product ↗
            </button>
          </div>
        </div>
      </div>

      <ProductReviews product={product} />

      {related.length > 0 && (
        <ProductRow
          title="RELATED PRODUCTS"
          products={related}
        />
      )}

      <RecentlyViewed exclude={productId} />

      {zoom && (
        <Modal
          title={product.name}
          onClose={() => setZoom(false)}
          className="image-modal"
        >
          <ProductImage
            product={galleryProduct(
              activePhoto,
            )}
            eager
          />

          {images.length > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => movePhoto(-1)}
              >
                Previous photo
              </button>

              <span role="status">
                {photoIndex + 1} / {images.length}
              </span>

              <button
                type="button"
                onClick={() => movePhoto(1)}
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

export default function ProductPage() {
  const { id } = useParams();

  const {
    shoppingKey,
  } = useStore();

  const {
    products,
    loading,
    loaded,
    error,
    refreshProducts,
  } = useCatalog();

  const catalog = Array.isArray(products)
    ? products
    : [];

  const product = catalog.find(
    (item) =>
      item &&
      item.isActive !== false &&
      [
        item.id,
        item._id,
        item.legacyId,
        item.slug,
      ].some(
        (value) =>
          value != null &&
          String(value) === String(id),
      ),
  );

  if (
    loading ||
    (
      loaded === false &&
      !error
    )
  ) {
    return (
      <div role="status">
        <EmptyState title="Loading product…">
          Getting the latest product information
          from GymDrobe.
        </EmptyState>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState title="Unable to load product">
        <p role="alert">
          {String(error)}
        </p>

        <button
          type="button"
          className="button"
          onClick={refreshProducts}
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

  if (!product) {
    return (
      <EmptyState title="Product not found">
        This product may no longer be available.{" "}

        <Link
          className="text-link"
          to="/shop"
        >
          Explore our current collection.
        </Link>
      </EmptyState>
    );
  }

  return (
    <ProductDetail
      key={
        `${shoppingKey(
          "gymdrobe-recently-viewed",
        )}:${product.id ?? product._id}`
      }
      product={product}
      products={catalog}
    />
  );
}