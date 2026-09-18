import { Link } from "react-router-dom";

function Navbar({
  cartCount = 0,
  wishlistCount = 0,
}) {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* LOGO */}
        <Link
          to="/"
          className="text-2xl font-bold"
        >
          GymDrobe
        </Link>

        {/* NAVIGATION */}
        <div className="hidden md:flex items-center gap-8">

          <Link
            to="/"
            className="hover:text-orange-600 transition"
          >
            Home
          </Link>

          <Link
            to="/shop"
            className="hover:text-orange-600 transition"
          >
            Shop
          </Link>

          <Link
            to="/shop?category=Workout%20Clothes"
            className="hover:text-orange-600 transition"
          >
            Categories
          </Link>

          <Link
            to="/shop"
            className="hover:text-orange-600 transition"
          >
            Offers
          </Link>

        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4">

          {/* WISHLIST */}
          <Link
            to="/wishlist"
            aria-label={`${wishlistCount} items in wishlist`}
            className="
              relative
              text-2xl
              hover:scale-110
              transition
            "
          >
            ❤️

            {wishlistCount > 0 && (
              <span
                className="
                  absolute
                  -top-2
                  -right-2
                  bg-orange-600
                  text-white
                  text-xs
                  font-bold
                  w-5
                  h-5
                  rounded-full
                  flex
                  items-center
                  justify-center
                "
              >
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* CART */}
          <Link
            to="/cart"
            aria-label={`${cartCount} items in cart`}
            className="
              relative
              text-2xl
              hover:scale-110
              transition
            "
          >
            🛒

            {cartCount > 0 && (
              <span
                className="
                  absolute
                  -top-2
                  -right-2
                  bg-orange-600
                  text-white
                  text-xs
                  font-bold
                  w-5
                  h-5
                  rounded-full
                  flex
                  items-center
                  justify-center
                "
              >
                {cartCount}
              </span>
            )}
          </Link>

        </div>
      </div>
    </nav>
  );
}

export default Navbar;