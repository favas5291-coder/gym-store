import { Link } from "react-router-dom";

function WishlistPage({
  wishlist,
  toggleWishlist,
}) {
  return (
    <section
      className="
        py-8
        sm:py-12
        md:py-20
        px-3
        sm:px-6
        bg-gray-100
        text-black
        min-h-screen
      "
    >
      <div className="max-w-7xl mx-auto">

        {/* PAGE HEADER */}

        <div className="mb-8 sm:mb-10">

          <h1
            className="
              text-3xl
              sm:text-4xl
              font-black
            "
          >
            MY WISHLIST ❤️
          </h1>

          {wishlist.length > 0 && (
            <p
              className="
                text-sm
                sm:text-base
                text-gray-500
                mt-2
              "
            >
              {wishlist.length} saved product
              {wishlist.length !== 1 ? "s" : ""}
            </p>
          )}

        </div>

        {/* EMPTY WISHLIST */}

        {wishlist.length === 0 ? (
          <div
            className="
              bg-white
              rounded-2xl
              sm:rounded-3xl
              text-center
              py-16
              sm:py-20
              px-4
            "
          >

            <div
              className="
                text-5xl
                sm:text-6xl
                mb-5
              "
            >
              🤍
            </div>

            <h2
              className="
                text-xl
                sm:text-2xl
                font-bold
                mb-2
              "
            >
              Your wishlist is empty
            </h2>

            <p
              className="
                text-sm
                sm:text-base
                text-gray-500
                mb-6
              "
            >
              Save products you love and
              find them here later.
            </p>

            <Link
              to="/shop"
              className="
                inline-flex
                items-center
                justify-center
                w-full
                sm:w-auto
                bg-orange-600
                hover:bg-orange-700
                text-white
                px-6
                py-3
                rounded-lg
                font-bold
                transition
                active:scale-[0.98]
              "
            >
              CONTINUE SHOPPING
            </Link>

          </div>
        ) : (

          /* WISHLIST PRODUCTS */

          <div
            className="
              grid
              grid-cols-1
              min-[380px]:grid-cols-2
              sm:grid-cols-2
              lg:grid-cols-3
              gap-3
              sm:gap-5
              lg:gap-6
            "
          >

            {wishlist.map((product) => {

              const discountedPrice =
                product.price -
                (product.price *
                  product.discount) /
                  100;

              return (
                <div
                  key={product.id}
                  className="
                    relative
                    bg-white
                    rounded-xl
                    sm:rounded-2xl
                    p-3
                    sm:p-5
                    shadow-sm
                    hover:shadow-lg
                    transition
                    overflow-hidden
                  "
                >

                  {/* REMOVE BUTTON */}

                  <button
                    type="button"
                    onClick={() =>
                      toggleWishlist(product)
                    }
                    aria-label={`Remove ${product.name} from wishlist`}
                    className="
                      absolute
                      top-5
                      right-5
                      z-10
                      w-9
                      h-9
                      sm:w-10
                      sm:h-10
                      rounded-full
                      bg-white
                      shadow-md
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
                    ❤️
                  </button>

                  {/* PRODUCT IMAGE */}

                  <Link
                    to={`/product/${product.id}`}
                    className="block"
                  >
                    <div
                      className="
                        bg-gray-100
                        rounded-lg
                        sm:rounded-xl
                        overflow-hidden
                      "
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="
                          w-full
                          h-40
                          sm:h-56
                          object-cover
                          hover:scale-105
                          transition
                          duration-500
                        "
                      />
                    </div>
                  </Link>

                  {/* PRODUCT INFO */}

                  <div className="pt-3 sm:pt-5">

                    <p
                      className="
                        text-[10px]
                        sm:text-xs
                        uppercase
                        tracking-wide
                        text-gray-500
                        mb-1
                      "
                    >
                      {product.category}
                    </p>

                    <Link
                      to={`/product/${product.id}`}
                    >
                      <h2
                        className="
                          text-sm
                          sm:text-xl
                          font-bold
                          leading-tight
                          line-clamp-2
                          min-h-[36px]
                          sm:min-h-[56px]
                          hover:text-orange-600
                          transition
                        "
                      >
                        {product.name}
                      </h2>
                    </Link>

                    {/* PRICE */}

                    <div
                      className="
                        flex
                        flex-wrap
                        items-center
                        gap-2
                        mt-3
                        mb-4
                      "
                    >

                      <p
                        className="
                          text-base
                          sm:text-lg
                          font-black
                        "
                      >
                        ₹
                        {Math.round(
                          discountedPrice
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </p>

                      {product.discount > 0 && (
                        <p
                          className="
                            text-xs
                            sm:text-sm
                            text-gray-400
                            line-through
                          "
                        >
                          ₹
                          {product.price.toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      )}

                    </div>

                    {/* ACTIONS */}

                    <div
                      className="
                        flex
                        gap-2
                        sm:gap-3
                      "
                    >

                      <Link
                        to={`/product/${product.id}`}
                        className="
                          flex-1
                          bg-orange-600
                          hover:bg-orange-700
                          text-white
                          py-2.5
                          sm:py-3
                          rounded-lg
                          font-bold
                          text-center
                          text-[11px]
                          sm:text-sm
                          transition
                          active:scale-[0.98]
                        "
                      >
                        VIEW PRODUCT
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          toggleWishlist(
                            product
                          )
                        }
                        aria-label={`Remove ${product.name}`}
                        className="
                          w-10
                          sm:w-12
                          shrink-0
                          bg-gray-200
                          hover:bg-gray-300
                          rounded-lg
                          flex
                          items-center
                          justify-center
                          text-base
                          sm:text-lg
                          transition
                          active:scale-95
                        "
                      >
                        ❤️
                      </button>

                    </div>

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