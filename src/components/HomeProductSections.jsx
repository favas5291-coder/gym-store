import { Link } from "react-router-dom";

import products from "../data/products";

function getSellingPrice(product) {
  const price = Number(product.price || 0);
  const discount = Number(product.discount || 0);

  return Math.round(
    price - (price * discount) / 100
  );
}

function HomeProductCard({
  product,
  wishlist,
  toggleWishlist,
}) {
  const isWishlisted =
    wishlist?.some(
      (item) =>
        String(item.id) ===
        String(product.id)
    );

  const sellingPrice =
    getSellingPrice(product);

  const outOfStock =
    Number(product.stock || 0) <= 0 ||
    product.stockStatus === "out-of-stock";

  return (
    <article
      className="
        group
        relative
        min-w-0
        bg-white
      "
    >
      {/* IMAGE */}

      <div
        className="
          relative
          aspect-[3/4]
          overflow-hidden
          bg-[#f5f5f6]
        "
      >
        <Link to={`/product/${product.id}`}>
          <img
            src={product.image}
            alt={product.name}
            className="
              h-full
              w-full
              object-cover
              transition
              duration-500
              group-hover:scale-[1.03]
            "
          />
        </Link>

        {/* WISHLIST */}

        <button
          type="button"
          onClick={() =>
            toggleWishlist?.(product)
          }
          aria-label={
            isWishlisted
              ? "Remove from wishlist"
              : "Add to wishlist"
          }
          className="
            absolute
            right-3
            top-3
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            bg-white
            text-lg
            text-[#282c3f]
            shadow-sm
            transition
            hover:scale-105
          "
        >
          {isWishlisted ? "♥" : "♡"}
        </button>

        {/* BADGE */}

        {product.badge && (
          <span
            className="
              absolute
              left-0
              top-3
              bg-[#282c3f]
              px-2.5
              py-1
              text-[9px]
              font-bold
              uppercase
              tracking-wide
              text-white
            "
          >
            {product.badge}
          </span>
        )}

        {/* RATING */}

        <div
          className="
            absolute
            bottom-2
            left-2
            flex
            items-center
            gap-1
            bg-white/95
            px-2
            py-1
            text-[10px]
            font-bold
            text-[#282c3f]
          "
        >
          {product.rating} ★

          {Number(product.reviewCount || 0) > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="font-normal">
                {product.reviewCount}
              </span>
            </>
          )}
        </div>

        {outOfStock && (
          <div
            className="
              absolute
              inset-x-0
              bottom-0
              bg-white/95
              py-2
              text-center
              text-[10px]
              font-bold
              uppercase
              tracking-wider
              text-red-600
            "
          >
            Out Of Stock
          </div>
        )}
      </div>

      {/* CONTENT */}

      <div className="px-1 pb-5 pt-3">
        <p
          className="
            text-sm
            font-bold
            text-[#282c3f]
          "
        >
          {product.brand || "GymDrobe"}
        </p>

        <Link to={`/product/${product.id}`}>
          <h3
            className="
              mt-1
              truncate
              text-[13px]
              font-normal
              text-[#696b79]
            "
          >
            {product.name}
          </h3>
        </Link>

        <div
          className="
            mt-2
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <span
            className="
              text-sm
              font-bold
              text-[#282c3f]
            "
          >
            ₹{sellingPrice}
          </span>

          {Number(product.discount || 0) > 0 && (
            <>
              <span
                className="
                  text-xs
                  text-[#7e818c]
                  line-through
                "
              >
                ₹{product.price}
              </span>

              <span
                className="
                  text-xs
                  font-medium
                  text-[#ff905a]
                "
              >
                ({product.discount}% OFF)
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ProductRow({
  eyebrow,
  title,
  productsToShow,
  wishlist,
  toggleWishlist,
}) {
  if (!productsToShow.length) {
    return null;
  }

  return (
    <section
      className="
        border-b
        border-[#eaeaec]
        bg-white
        py-10
        md:py-14
      "
    >
      <div
        className="
          mx-auto
          max-w-[1600px]
          px-4
          sm:px-6
          lg:px-8
        "
      >
        {/* HEADER */}

        <div
          className="
            mb-6
            flex
            items-end
            justify-between
            gap-4
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.2em]
                text-orange-600
              "
            >
              {eyebrow}
            </p>

            <h2
              className="
                mt-2
                text-xl
                font-bold
                uppercase
                tracking-[0.05em]
                text-[#282c3f]
                md:text-[26px]
              "
            >
              {title}
            </h2>
          </div>

          <Link
            to="/shop"
            className="
              shrink-0
              text-[11px]
              font-bold
              uppercase
              tracking-wide
              text-orange-600
            "
          >
            View All →
          </Link>
        </div>

        {/* PRODUCTS */}

        <div
          className="
            hide-scrollbar
            flex
            gap-3
            overflow-x-auto
            md:grid
            md:grid-cols-4
            md:gap-4
            md:overflow-visible
            xl:grid-cols-5
          "
        >
          {productsToShow.map((product) => (
            <div
              key={`${title}-${product.id}`}
              className="
                w-[68%]
                shrink-0
                sm:w-[42%]
                md:w-auto
              "
            >
              <HomeProductCard
                product={product}
                wishlist={wishlist}
                toggleWishlist={
                  toggleWishlist
                }
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeProductSections({
  wishlist = [],
  toggleWishlist,
}) {
  const availableProducts =
    products.filter(
      (product) =>
        Number(product.stock || 0) > 0
    );

  const featured =
    availableProducts.filter(
      (product) =>
        product.isFeatured
    );

  const bestSellers =
    availableProducts.filter(
      (product) =>
        product.isBestSeller
    );

  const newArrivals =
    products.filter(
      (product) =>
        product.isNew
    );

  return (
    <>
      <ProductRow
        eyebrow="Featured"
        title="Trending Now"
        productsToShow={
          featured.length
            ? featured
            : availableProducts
        }
        wishlist={wishlist}
        toggleWishlist={
          toggleWishlist
        }
      />

      <ProductRow
        eyebrow="Most Loved"
        title="Bestsellers"
        productsToShow={
          bestSellers.length
            ? bestSellers
            : availableProducts
        }
        wishlist={wishlist}
        toggleWishlist={
          toggleWishlist
        }
      />

      <ProductRow
        eyebrow="Just Dropped"
        title="New Arrivals"
        productsToShow={
          newArrivals
        }
        wishlist={wishlist}
        toggleWishlist={
          toggleWishlist
        }
      />
    </>
  );
}

export default HomeProductSections;