import { Link } from "react-router-dom";

function ProductCard({
  id,
  name,
  category,
  brand,
  price,
  rating = 0,
  reviewCount = 0,
  discount = 0,
  image,
  badge,
  wishlist = false,
  onWishlist,
}) {
  const originalPrice = Number(price || 0);
  const discountPercentage = Number(discount || 0);

  const discountedPrice = Math.round(
    originalPrice -
      (originalPrice * discountPercentage) / 100
  );

  function handleWishlist(event) {
    event.preventDefault();
    event.stopPropagation();
    onWishlist?.();
  }

  return (
    <article
      className="
        group
        relative
        min-w-0
        bg-white
        text-gray-900
      "
    >
      {/* =========================================
          PRODUCT IMAGE
      ========================================= */}

      <div
        className="
          relative
          overflow-hidden
          bg-[#f5f5f5]
          aspect-[3/4]
        "
      >
        <Link
          to={`/product/${id}`}
          aria-label={`View ${name}`}
          className="block h-full w-full"
        >
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="
              h-full
              w-full
              object-cover
              transition-transform
              duration-500
              ease-out
              group-hover:scale-[1.04]
            "
          />
        </Link>

        {/* =========================================
            TOP LEFT BADGES
        ========================================= */}

        <div
          className="
            absolute
            left-2
            top-2
            z-10
            flex
            flex-col
            items-start
            gap-1.5
          "
        >
          {badge && (
            <span
              className="
                rounded-sm
                bg-black
                px-2
                py-1
                text-[9px]
                font-bold
                uppercase
                tracking-wide
                text-white
                sm:text-[10px]
              "
            >
              {badge}
            </span>
          )}

          {discountPercentage > 0 && (
            <span
              className="
                rounded-sm
                bg-orange-600
                px-2
                py-1
                text-[9px]
                font-bold
                text-white
                sm:text-[10px]
              "
            >
              {discountPercentage}% OFF
            </span>
          )}
        </div>

        {/* =========================================
            WISHLIST
        ========================================= */}

        <button
          type="button"
          onClick={handleWishlist}
          aria-label={
            wishlist
              ? `Remove ${name} from wishlist`
              : `Add ${name} to wishlist`
          }
          className="
            absolute
            right-2
            top-2
            z-20
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-full
            bg-white
            text-[20px]
            shadow-sm
            transition-all
            duration-200
            hover:scale-110
            hover:shadow-md
            active:scale-95
          "
        >
          <span
            aria-hidden="true"
            className={
              wishlist
                ? "text-red-500"
                : "text-gray-800"
            }
          >
            {wishlist ? "♥" : "♡"}
          </span>
        </button>

        {/* =========================================
            RATING BADGE
        ========================================= */}

        {Number(rating) > 0 && (
          <div
            className="
              absolute
              bottom-2
              left-2
              z-10
              flex
              items-center
              gap-1
              rounded-sm
              bg-white/95
              px-2
              py-1
              text-[10px]
              font-semibold
              shadow-sm
              backdrop-blur
              sm:text-xs
            "
          >
            <span>{Number(rating).toFixed(1)}</span>

            <span className="text-green-600">
              ★
            </span>

            {Number(reviewCount) > 0 && (
              <>
                <span className="text-gray-300">
                  |
                </span>

                <span className="text-gray-500">
                  {reviewCount}
                </span>
              </>
            )}
          </div>
        )}

        {/* =========================================
            DESKTOP QUICK ACTION
        ========================================= */}

        <div
          className="
            absolute
            bottom-0
            left-0
            right-0
            hidden
            translate-y-full
            bg-white
            p-3
            opacity-0
            transition-all
            duration-300
            group-hover:translate-y-0
            group-hover:opacity-100
            md:block
          "
        >
          <Link
            to={`/product/${id}`}
            className="
              flex
              w-full
              items-center
              justify-center
              border
              border-gray-900
              bg-white
              px-4
              py-2.5
              text-xs
              font-bold
              uppercase
              tracking-wide
              text-gray-900
              transition
              hover:bg-gray-900
              hover:text-white
            "
          >
            View Product
          </Link>
        </div>
      </div>

      {/* =========================================
          PRODUCT INFORMATION
      ========================================= */}

      <div className="px-1 pb-4 pt-3 sm:px-2">
        {/* Brand */}

        {brand && (
          <p
            className="
              mb-0.5
              truncate
              text-sm
              font-bold
              text-gray-900
              sm:text-[15px]
            "
          >
            {brand}
          </p>
        )}

        {/* Product Name */}

        <Link to={`/product/${id}`}>
          <h3
            className="
              truncate
              text-xs
              font-normal
              text-gray-600
              transition
              hover:text-orange-600
              sm:text-sm
            "
            title={name}
          >
            {name}
          </h3>
        </Link>

        {/* Category */}

        {!brand && category && (
          <p
            className="
              mt-0.5
              truncate
              text-[11px]
              text-gray-400
            "
          >
            {category}
          </p>
        )}

        {/* =========================================
            PRICE
        ========================================= */}

        <div
          className="
            mt-2
            flex
            flex-wrap
            items-baseline
            gap-x-1.5
            gap-y-1
          "
        >
          <span
            className="
              text-sm
              font-bold
              text-gray-900
              sm:text-base
            "
          >
            ₹{discountedPrice.toLocaleString("en-IN")}
          </span>

          {discountPercentage > 0 && (
            <>
              <span
                className="
                  text-[11px]
                  text-gray-400
                  line-through
                  sm:text-xs
                "
              >
                ₹{originalPrice.toLocaleString("en-IN")}
              </span>

              <span
                className="
                  text-[11px]
                  font-medium
                  text-orange-600
                  sm:text-xs
                "
              >
                ({discountPercentage}% OFF)
              </span>
            </>
          )}
        </div>

        {/* =========================================
            MOBILE ACTION
        ========================================= */}

        <Link
          to={`/product/${id}`}
          className="
            mt-3
            flex
            w-full
            items-center
            justify-center
            rounded-md
            border
            border-gray-200
            py-2
            text-[11px]
            font-bold
            uppercase
            tracking-wide
            text-gray-800
            transition
            hover:border-gray-900
            md:hidden
          "
        >
          View Product
        </Link>
      </div>
    </article>
  );
}

export default ProductCard;