import { Link } from "react-router-dom";

function ProductCard({
  id,
  name,
  category,
  brand = "GymDrobe",
  price,
  rating,
  reviewCount = 0,
  discount = 0,
  image,
  badge,
  stock = 0,
  wishlist = false,
  onWishlist,
}) {
  const sellingPrice =
    Math.round(
      Number(price || 0) -
        (Number(price || 0) *
          Number(discount || 0)) /
          100
    );

  const outOfStock =
    Number(stock || 0) <= 0;

  function handleWishlist(
    event
  ) {
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
      "
    >
      {/* =========================================
          IMAGE
      ========================================= */}

      <div
        className="
          relative
          aspect-[3/4]
          overflow-hidden
          bg-[#f5f5f6]
        "
      >
        <Link
          to={`/product/${id}`}
          className="
            block
            h-full
            w-full
          "
        >
          <img
            src={image}
            alt={name}
            className="
              h-full
              w-full
              object-cover
              transition-transform
              duration-300
              group-hover:scale-[1.02]
            "
          />
        </Link>

        {/* BADGE */}

        {badge && (
          <span
            className="
              absolute
              left-2
              top-2
              bg-white/95
              px-2
              py-1
              text-[8px]
              font-bold
              uppercase
              tracking-wide
              text-[#282c3f]
            "
          >
            {badge}
          </span>
        )}

        {/* HEART */}

        <button
          type="button"
          onClick={
            handleWishlist
          }
          aria-label={
            wishlist
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
            text-[20px]
            text-[#282c3f]
            shadow-sm
            transition
            hover:scale-105
          "
        >
          {wishlist
            ? "♥"
            : "♡"}
        </button>

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
            font-semibold
            text-[#282c3f]
          "
        >
          <span>
            {rating} ★
          </span>

          {Number(
            reviewCount
          ) > 0 && (
            <>
              <span
                className="
                  text-[#d4d5d9]
                "
              >
                |
              </span>

              <span>
                {
                  reviewCount
                }
              </span>
            </>
          )}
        </div>

        {/* OUT OF STOCK */}

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
              tracking-[0.08em]
              text-red-600
            "
          >
            Out Of Stock
          </div>
        )}

        {/* DESKTOP HOVER WISHLIST */}

        {!outOfStock && (
          <div
            className="
              absolute
              inset-x-0
              bottom-0
              hidden
              translate-y-full
              bg-white
              p-3
              opacity-0
              transition-all
              duration-200
              group-hover:translate-y-0
              group-hover:opacity-100
              md:block
            "
          >
            <button
              type="button"
              onClick={
                handleWishlist
              }
              className="
                flex
                w-full
                items-center
                justify-center
                gap-2
                border
                border-[#d4d5d9]
                py-2
                text-[11px]
                font-bold
                uppercase
                text-[#282c3f]
                hover:border-[#282c3f]
              "
            >
              <span>
                {wishlist
                  ? "♥"
                  : "♡"}
              </span>

              Wishlist
            </button>
          </div>
        )}
      </div>

      {/* =========================================
          INFORMATION
      ========================================= */}

      <div
        className="
          px-1
          pb-5
          pt-3
        "
      >
        <Link
          to={`/product/${id}`}
        >
          <h3
            className="
              truncate
              text-[14px]
              font-bold
              text-[#282c3f]
            "
          >
            {brand}
          </h3>

          <p
            className="
              mt-1
              truncate
              text-[13px]
              font-normal
              text-[#696b79]
            "
          >
            {name}
          </p>
        </Link>

        <div
          className="
            mt-2
            flex
            flex-wrap
            items-center
            gap-x-2
            gap-y-1
          "
        >
          <span
            className="
              text-[13px]
              font-bold
              text-[#282c3f]
            "
          >
            ₹{sellingPrice.toLocaleString(
              "en-IN"
            )}
          </span>

          {Number(discount) >
            0 && (
            <>
              <span
                className="
                  text-[11px]
                  text-[#7e818c]
                  line-through
                "
              >
                ₹
                {Number(
                  price
                ).toLocaleString(
                  "en-IN"
                )}
              </span>

              <span
                className="
                  text-[11px]
                  font-medium
                  text-[#ff905a]
                "
              >
                (
                {discount}% OFF)
              </span>
            </>
          )}
        </div>

        <p
          className="
            mt-1.5
            truncate
            text-[10px]
            uppercase
            tracking-wide
            text-[#94969f]
          "
        >
          {category}
        </p>
      </div>
    </article>
  );
}

export default ProductCard;