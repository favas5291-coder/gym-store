import { useState } from "react";
import { Link } from "react-router-dom";
import logoImage from "../assets/logo.png";

function Navbar({
  cartCount = 0,
  wishlistCount = 0,
}) {
  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <nav className="bg-white text-gray-900 shadow-sm sticky top-0 z-50">

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">

        {/* ==============================
            MAIN NAVBAR
        ============================== */}

        <div className="flex items-center justify-between">

          {/* LOGO */}

          <Link
            to="/"
            onClick={closeMenu}
            className="
              text-2xl
              md:text-3xl
              font-black
              tracking-tight
            "
          >
            <img
              src={logoImage}
              alt="Gymdrobe"
              className="h-10 w-10 scale-200 object-contain invert"
            />
          </Link>

          {/* ==============================
              DESKTOP NAVIGATION
          ============================== */}

          <div className="hidden md:flex items-center gap-3">

            <Link
              to="/"
              className="
                px-4 py-2 rounded-full
                text-sm font-semibold tracking-[0.12em]
                uppercase text-gray-800
                transition-all duration-200
                hover:text-orange-600 hover:bg-orange-50
                hover:-translate-y-0.5
              "
            >
              Home
            </Link>

            <Link
              to="/shop"
              className="
                px-4 py-2 rounded-full
                text-sm font-semibold tracking-[0.12em]
                uppercase text-gray-800
                transition-all duration-200
                hover:text-orange-600 hover:bg-orange-50
                hover:-translate-y-0.5
              "
            >
              Shop
            </Link>

            <Link
              to="/shop?category=Workout%20Clothes"
              className="
                px-4 py-2 rounded-full
                text-sm font-semibold tracking-[0.12em]
                uppercase text-gray-800
                transition-all duration-200
                hover:text-orange-600 hover:bg-orange-50
                hover:-translate-y-0.5
              "
            >
              Categories
            </Link>

            <Link
              to="/shop"
              className="
                px-4 py-2 rounded-full
                text-sm font-semibold tracking-[0.12em]
                uppercase text-gray-800
                transition-all duration-200
                hover:text-orange-600 hover:bg-orange-50
                hover:-translate-y-0.5
              "
            >
              Offers
            </Link>

          </div>

          {/* ==============================
              RIGHT SIDE
          ============================== */}

          <div className="flex items-center gap-2 md:gap-3">

            {/* WISHLIST */}

            <Link
              to="/wishlist"
              aria-label={`${wishlistCount} items in wishlist`}
              className="
                relative
                flex items-center justify-center
                w-9 h-9
                rounded-full
                border border-slate-700
                bg-slate-900
                text-xl text-white
                shadow-sm
                hover:border-orange-400 hover:bg-slate-800 hover:text-orange-300
                transition-all duration-200
              "
            >
              <span aria-hidden="true" className="leading-none text-lg">♡</span>

              {wishlistCount > 0 && (
                <span
                  className="
                    absolute
                    -top-1.5 -right-1.5
                    bg-orange-500
                    text-slate-950
                    text-[9px]
                    font-bold
                    min-w-[18px] h-[18px]
                    px-1
                    rounded-full
                    flex items-center justify-center
                    border border-slate-900
                    leading-none
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
                inline-flex items-center justify-center
                gap-2
                px-4 py-2
                rounded-xl
                border border-slate-700
                bg-slate-900
                text-sm font-semibold tracking-[0.08em]
                uppercase text-white
                shadow-sm
                hover:border-orange-400 hover:bg-slate-800 hover:text-orange-300
                transition-all duration-200
              "
            >
              <span aria-hidden="true" className="text-base">👜</span>
              <span>Bag</span>

              {cartCount > 0 && (
                <span
                  className="
                    inline-flex items-center justify-center
                    bg-orange-500
                    text-slate-950
                    text-[9px]
                    font-bold
                    min-w-[18px] h-[18px]
                    px-1
                    rounded-full
                    border border-slate-900
                    leading-none
                  "
                >
                  {cartCount}
                </span>
              )}

            </Link>

            {/* ==============================
                MOBILE MENU BUTTON
            ============================== */}

            <button
              type="button"
              onClick={() =>
                setIsMenuOpen(
                  (current) => !current
                )
              }
              aria-label={
                isMenuOpen
                  ? "Close menu"
                  : "Open menu"
              }
              aria-expanded={isMenuOpen}
              className="
                md:hidden
                text-2xl
                w-10
                h-10
                flex
                items-center
                justify-center
                rounded-lg
                hover:bg-gray-100
                transition
              "
            >
              {isMenuOpen ? "✕" : "☰"}
            </button>

          </div>

        </div>

        {/* ==============================
            MOBILE MENU
        ============================== */}

        {isMenuOpen && (
          <div
            className="
              md:hidden
              border-t
              border-gray-100
              mt-4
              pt-4
              pb-2
            "
          >

            <div className="flex flex-col">

              <Link
                to="/"
                onClick={closeMenu}
                className="
                  px-4 py-3 rounded-xl
                  font-semibold tracking-[0.12em] uppercase
                  text-gray-800
                  hover:bg-orange-50 hover:text-orange-600
                  transition-all duration-200
                "
              >
                Home
              </Link>

              <Link
                to="/shop"
                onClick={closeMenu}
                className="
                  px-4 py-3 rounded-xl
                  font-semibold tracking-[0.12em] uppercase
                  text-gray-800
                  hover:bg-orange-50 hover:text-orange-600
                  transition-all duration-200
                "
              >
                Shop
              </Link>

              <Link
                to="/shop?category=Workout%20Clothes"
                onClick={closeMenu}
                className="
                  px-4 py-3 rounded-xl
                  font-semibold tracking-[0.12em] uppercase
                  text-gray-800
                  hover:bg-orange-50 hover:text-orange-600
                  transition-all duration-200
                "
              >
                Categories
              </Link>

              <Link
                to="/shop"
                onClick={closeMenu}
                className="
                  px-4 py-3 rounded-xl
                  font-semibold tracking-[0.12em] uppercase
                  text-gray-800
                  hover:bg-orange-50 hover:text-orange-600
                  transition-all duration-200
                "
              >
                Offers
              </Link>

              <div className="border-t border-gray-100 my-2" />

              <Link
                to="/wishlist"
                onClick={closeMenu}
                className="
                  px-3
                  py-3
                  rounded-lg
                  bg-slate-900
                  text-white
                  border border-slate-700
                  hover:bg-slate-800
                  hover:text-orange-300
                  transition
                  flex
                  items-center
                  justify-between
                "
              >
                <span>Wishlist</span>

                {wishlistCount > 0 && (
                  <span
                    className="
                      bg-orange-500
                      text-slate-950
                      text-xs
                      font-bold
                      px-2
                      py-1
                      rounded-full
                    "
                  >
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <Link
                to="/cart"
                onClick={closeMenu}
                className="
                  px-3
                  py-3
                  rounded-lg
                  hover:bg-gray-100
                  hover:text-orange-600
                  transition
                  flex
                  items-center
                  justify-between
                "
              >
                <span>Cart</span>

                {cartCount > 0 && (
                  <span
                    className="
                      bg-orange-600
                      text-white
                      text-xs
                      font-bold
                      px-2
                      py-1
                      rounded-full
                    "
                  >
                    {cartCount}
                  </span>
                )}
              </Link>

            </div>

          </div>
        )}

      </div>

    </nav>
  );
}

export default Navbar;