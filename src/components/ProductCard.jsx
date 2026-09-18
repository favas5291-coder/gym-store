import { Link } from "react-router-dom";

function ProductCard({
  id,
  name,
  category,
  price,
  discount,
  rating,
  image,
  wishlist,
  toggleWishlist,
  onSelect,
}) {
  return (
    <div
      onClick={onSelect}
      className="
        bg-white
        rounded-xl
        p-6
        shadow-sm
        hover:shadow-xl
        hover:-translate-y-1
        transition
      "
    >
      {/* PRODUCT IMAGE */}
      <div className="relative h-48 bg-gray-200 rounded-lg mb-4 overflow-hidden flex items-center justify-center">

        {/* DISCOUNT */}
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full z-10">
            {discount}% OFF
          </span>
        )}

        {/* WISHLIST */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();

            const product = {
              id,
              name,
              category,
              price,
              discount,
              rating,
              image,
            };

            toggleWishlist(product);
          }}
          className="
            absolute
            top-3
            right-3
            bg-white
            rounded-full
            w-10
            h-10
            shadow
            text-xl
            z-10
            hover:scale-110
            transition
          "
        >
          {wishlist?.some(
            (item) => item.id === id
          )
            ? "❤️"
            : "🤍"}
        </button>

        {/* IMAGE */}
        <img
          src={image}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* PRODUCT NAME */}
      <Link
        to={`/product/${id}`}
        onClick={(e) => e.stopPropagation()}
        className="
          text-xl
          font-bold
          mb-2
          block
          hover:text-orange-600
        "
      >
        {name}
      </Link>

      {/* CATEGORY */}
      <p className="text-gray-500 mb-2">
        {category}
      </p>

      {/* DISCOUNTED PRICE */}
      <p className="text-lg font-bold">
        ₹
        {(
          price -
          (price * discount) / 100
        ).toLocaleString("en-IN")}
      </p>

      {/* ORIGINAL PRICE */}
      <p className="text-sm text-gray-500 line-through">
        ₹{price.toLocaleString("en-IN")}
      </p>

      {/* RATING */}
      <p className="mb-4">
        ⭐ {rating}
      </p>

      {/* VIEW PRODUCT */}
      <Link
        to={`/product/${id}`}
        onClick={(e) => e.stopPropagation()}
        className="
          block
          w-full
          bg-orange-600
          hover:bg-orange-700
          text-white
          py-3
          rounded-lg
          font-semibold
          transition
          text-center
        "
      >
        VIEW PRODUCT
      </Link>
    </div>
  );
}

export default ProductCard;