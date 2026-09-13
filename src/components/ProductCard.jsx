function ProductCard({
  name,
  category,
  price,
  rating,
  onAddToCart
}) {
  return (
    <div
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

      <div className="h-48 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
        Product Image
      </div>

      <h3 className="text-xl font-bold mb-2">
        {name}
      </h3>

      <p className="text-gray-500 mb-2">
        {category}
      </p>

      <p className="text-lg font-bold mb-2">
        ₹{price.toLocaleString("en-IN")}
      </p>

      <p className="mb-4">
        ⭐ {rating}
      </p>

      <button
        onClick={onAddToCart}
        className="
        w-full
        bg-orange-600
        hover:bg-orange-700
        text-white
        py-3
        rounded-lg
        font-semibold
        transition
      "
      >
        ADD TO CART
      </button>

    </div>
  );
}

export default ProductCard;