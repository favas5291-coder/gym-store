import { Link } from "react-router-dom";

function WishlistPage({
  wishlist,
  toggleWishlist,
}) {
  return (
    <section className="py-20 px-6 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">

        {/* TITLE */}
        <h1 className="text-4xl font-bold mb-10">
          MY WISHLIST ❤️
        </h1>

        {/* EMPTY WISHLIST */}
        {wishlist.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-6">
              Your wishlist is empty.
            </p>

            <Link
              to="/shop"
              className="
                inline-block
                bg-orange-600
                hover:bg-orange-700
                text-white
                px-6
                py-3
                rounded-lg
                font-semibold
              "
            >
              CONTINUE SHOPPING
            </Link>
          </div>
        ) : (

          /* WISHLIST PRODUCTS */
          <div className="
            grid
            grid-cols-1
            md:grid-cols-2
            lg:grid-cols-3
            gap-6
          ">
            {wishlist.map((product) => {

              const discountedPrice =
                product.price -
                (product.price * product.discount) / 100;

              return (
                <div
                  key={product.id}
                  className="
                    bg-white
                    rounded-xl
                    p-5
                    shadow-sm
                    hover:shadow-lg
                    transition
                  "
                >

                  {/* IMAGE */}
                  <img
                    src={product.image}
                    alt={product.name}
                    className="
                      w-full
                      h-48
                      object-cover
                      rounded-lg
                      mb-4
                    "
                  />

                  {/* NAME */}
                  <h2 className="text-xl font-bold mb-2">
                    {product.name}
                  </h2>

                  {/* CATEGORY */}
                  <p className="text-gray-500 mb-2">
                    {product.category}
                  </p>

                  {/* PRICE */}
                  <p className="text-lg font-bold">
                    ₹
                    {discountedPrice.toLocaleString("en-IN")}
                  </p>

                  {/* ORIGINAL PRICE */}
                  <p className="text-sm text-gray-500 line-through mb-4">
                    ₹
                    {product.price.toLocaleString("en-IN")}
                  </p>

                  {/* BUTTONS */}
                  <div className="flex gap-3">

                    <Link
                      to={`/product/${product.id}`}
                      className="
                        flex-1
                        bg-orange-600
                        hover:bg-orange-700
                        text-white
                        py-3
                        rounded-lg
                        font-semibold
                        text-center
                      "
                    >
                      VIEW PRODUCT
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        toggleWishlist(product)
                      }
                      className="
                        px-4
                        py-3
                        bg-gray-200
                        hover:bg-gray-300
                        rounded-lg
                      "
                    >
                      ❤️
                    </button>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}

export default WishlistPage;