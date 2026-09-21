import { Link } from "react-router-dom";

function ProductCard({
  id,
  name,
  category,
  price,
  rating,
  discount = 0,
  image,
  wishlist = false,
  onWishlist,
}) {
  const discountedPrice =
    price - (price * discount) / 100;

  return (
    <div
      className="
        relative
        bg-white
        text-black
        rounded-2xl
        overflow-hidden
        border border-gray-200
        shadow-[0_2px_10px_rgba(15,23,42,0.05)]
        hover:shadow-[0_10px_25px_rgba(15,23,42,0.08)]
        hover:-translate-y-1
        transition-all
        duration-300
        group
      "
    >

      {/* Discount */}
      {discount > 0 && (
        <span
          className="
            absolute
            top-3
            left-3
            z-10
            bg-orange-600
            text-white
            text-[10px]
            sm:text-xs
            font-bold
            px-2
            py-1
            rounded-full
          "
        >
          {discount}% OFF
        </span>
      )}

      {/* Wishlist */}
      <button
        type="button"
        onClick={() => onWishlist?.()}
        aria-label={
          wishlist
            ? "Remove from wishlist"
            : "Add to wishlist"
        }
        className="
          absolute
          top-3
          right-3
          z-10
          w-9
          h-9
          sm:w-10
          sm:h-10
          rounded-full
          bg-white/90
          border border-gray-200
          backdrop-blur-sm
          flex
          items-center
          justify-center
          text-lg
          sm:text-xl
          hover:scale-110
          transition
          active:scale-95
        "
      >
        <span aria-hidden="true">{wishlist ? "❤️" : "♡"}</span>
      </button>

      {/* Product Image */}
      <Link to={`/product/${id}`}>
        <div
          className="
            h-44
            sm:h-52
            md:h-56
            bg-gray-100
            overflow-hidden
            flex
            items-center
            justify-center
          "
        >
          <img
            src={image}
            alt={name}
            className="
              w-full
              h-full
              object-cover
              group-hover:scale-105
              transition
              duration-500
            "
          />
        </div>
      </Link>

      {/* Product Details */}
      <div className="p-4 sm:p-4">

        {/* Category */}
        <p
          className="
            text-[10px]
            sm:text-[11px]
            uppercase
            tracking-[0.12em]
            text-gray-500
            mb-1
          "
        >
          {category}
        </p>

        {/* Product Name */}
        <Link to={`/product/${id}`}>
          <h3
            className="
              font-semibold
              text-sm
              sm:text-[15px]
              leading-5
              line-clamp-2
              min-h-[40px]
              sm:min-h-[46px]
              hover:text-orange-600
              transition
            "
          >
            {name}
          </h3>
        </Link>

        {/* Rating */}
        <div
          className="
            flex
            items-center
            gap-1
            mt-2
            text-xs
            sm:text-sm
            text-gray-600
          "
        >
          <span>⭐</span>
          <span className="font-medium">{rating}</span>
        </div>

        {/* Price */}
        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
            mt-3
          "
        >
          <span
            className="
              text-lg
              sm:text-xl
              font-bold
            "
          >
            ₹{Math.round(discountedPrice)}
          </span>

          {discount > 0 && (
            <span
              className="
                text-xs
                sm:text-sm
                text-gray-400
                line-through
              "
            >
              ₹{price}
            </span>
          )}
        </div>

        {/* Add to bag */}
        <div className="mt-4 flex items-center gap-2">
          <Link
            to={`/product/${id}`}
            className="
              flex-1
              flex
              items-center
              justify-center
              bg-[#111827]
              hover:bg-[#1f2937]
              text-white
              py-2.5
              rounded-xl
              text-sm
              font-semibold
              transition
              active:scale-[0.98]
            "
          >
            Add to Bag
          </Link>
        </div>

      </div>

    </div>
  );
}

export default ProductCard;