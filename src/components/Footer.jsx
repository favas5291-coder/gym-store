import { Link } from "react-router-dom";

function Footer() {
  const currentYear =
    new Date().getFullYear();

  const popularSearches = [
    "Gym T-Shirts",
    "Gym Shoes",
    "Training Socks",
    "Protein",
    "Shaker Bottles",
    "Water Bottles",
    "Gym Towels",
    "Headphones",
    "Workout Clothes",
    "Training Shoes",
    "Sports Bottles",
    "Protein Shakers",
  ];

  return (
    <footer
      id="offers"
      className="
        border-t
        border-[#eaeaec]
        bg-[#fafafa]
        text-[#282c3f]
      "
    >
      <div
        className="
          mx-auto
          max-w-[1400px]
          px-5
          py-12
          sm:px-6
          lg:px-8
          lg:py-16
        "
      >
        {/* =========================================
            MAIN FOOTER GRID
        ========================================= */}

        <div
          className="
            grid
            grid-cols-2
            gap-x-8
            gap-y-10
            md:grid-cols-4
            lg:grid-cols-[1.2fr_1fr_1fr_1.4fr]
          "
        >
          {/* SHOP */}

          <div>
            <h3
              className="
                mb-5
                text-xs
                font-bold
                uppercase
                tracking-[0.05em]
                text-[#282c3f]
              "
            >
              Online Shopping
            </h3>

            <div
              className="
                space-y-2.5
                text-[13px]
                text-[#696b79]
              "
            >
              <Link
                to="/shop?category=Workout%20Clothes"
                className="block hover:text-orange-600"
              >
                Workout Clothes
              </Link>

              <Link
                to="/shop?category=Gym%20Shoes"
                className="block hover:text-orange-600"
              >
                Gym Shoes
              </Link>

              <Link
                to="/shop?category=Protein"
                className="block hover:text-orange-600"
              >
                Protein
              </Link>

              <Link
                to="/shop?category=Socks"
                className="block hover:text-orange-600"
              >
                Socks
              </Link>

              <Link
                to="/shop?category=Water%20Bottles"
                className="block hover:text-orange-600"
              >
                Water Bottles
              </Link>

              <Link
                to="/shop?category=Shaker%20Bottles"
                className="block hover:text-orange-600"
              >
                Shaker Bottles
              </Link>

              <Link
                to="/shop?category=Gym%20Towels"
                className="block hover:text-orange-600"
              >
                Gym Towels
              </Link>

              <Link
                to="/shop?category=Headphones"
                className="block hover:text-orange-600"
              >
                Headphones
              </Link>
            </div>
          </div>

          {/* CUSTOMER POLICIES */}

          <div>
            <h3
              className="
                mb-5
                text-xs
                font-bold
                uppercase
                tracking-[0.05em]
                text-[#282c3f]
              "
            >
              Customer Policies
            </h3>

            <div
              className="
                space-y-2.5
                text-[13px]
                text-[#696b79]
              "
            >
              <p>Contact Us</p>

              <p>FAQ</p>

              <p>Shipping</p>

              <p>Returns</p>

              <p>Cancellation</p>

              <p>Terms Of Use</p>

              <p>Privacy Policy</p>
            </div>
          </div>

          {/* ACCOUNT */}

          <div>
            <h3
              className="
                mb-5
                text-xs
                font-bold
                uppercase
                tracking-[0.05em]
                text-[#282c3f]
              "
            >
              Your Account
            </h3>

            <div
              className="
                space-y-2.5
                text-[13px]
                text-[#696b79]
              "
            >
              <Link
                to="/login"
                className="block hover:text-orange-600"
              >
                Login
              </Link>

              <Link
                to="/signup"
                className="block hover:text-orange-600"
              >
                Create Account
              </Link>

              <Link
                to="/account"
                className="block hover:text-orange-600"
              >
                My Account
              </Link>

              <Link
                to="/orders"
                className="block hover:text-orange-600"
              >
                My Orders
              </Link>

              <Link
                to="/wishlist"
                className="block hover:text-orange-600"
              >
                Wishlist
              </Link>

              <Link
                to="/addresses"
                className="block hover:text-orange-600"
              >
                Addresses
              </Link>
            </div>
          </div>

          {/* GYMDROBE PROMISE */}

          <div>
            <h3
              className="
                mb-5
                text-xs
                font-bold
                uppercase
                tracking-[0.05em]
                text-[#282c3f]
              "
            >
              The GymDrobe Promise
            </h3>

            <div className="space-y-6">
              {/* ORIGINAL */}

              <div
                className="
                  flex
                  items-start
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#d4d5d9]
                    bg-white
                    text-lg
                  "
                >
                  ✓
                </div>

                <div>
                  <p
                    className="
                      text-sm
                      font-bold
                      text-[#282c3f]
                    "
                  >
                    Quality Focused
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-[#696b79]
                    "
                  >
                    Fitness products selected
                    for everyday training and
                    workout use.
                  </p>
                </div>
              </div>

              {/* RETURNS */}

              <div
                className="
                  flex
                  items-start
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#d4d5d9]
                    bg-white
                    text-lg
                  "
                >
                  ↻
                </div>

                <div>
                  <p
                    className="
                      text-sm
                      font-bold
                      text-[#282c3f]
                    "
                  >
                    Easy 7-Day Returns
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-[#696b79]
                    "
                  >
                    Eligible products support
                    easy return and replacement.
                  </p>
                </div>
              </div>

              {/* DELIVERY */}

              <div
                className="
                  flex
                  items-start
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#d4d5d9]
                    bg-white
                    text-lg
                  "
                >
                  🚚
                </div>

                <div>
                  <p
                    className="
                      text-sm
                      font-bold
                      text-[#282c3f]
                    "
                  >
                    Free Delivery
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-[#696b79]
                    "
                  >
                    Free standard delivery on
                    qualifying orders above ₹500.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            BRAND + FOLLOW
        ========================================= */}

        <div
          className="
            mt-12
            grid
            gap-8
            border-t
            border-[#eaeaec]
            pt-10
            md:grid-cols-2
          "
        >
          <div>
            <h2
              className="
                text-2xl
                font-black
                uppercase
                tracking-[-0.03em]
                text-[#282c3f]
              "
            >
              GymDrobe
            </h2>

            <p
              className="
                mt-3
                max-w-md
                text-sm
                leading-6
                text-[#696b79]
              "
            >
              Everything you need for every
              workout. Discover training wear,
              gym shoes, hydration products and
              fitness essentials in one place.
            </p>
          </div>

          <div
            className="
              md:text-right
            "
          >
            <h3
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.06em]
                text-[#282c3f]
              "
            >
              Keep In Touch
            </h3>

            <div
              className="
                mt-4
                flex
                flex-wrap
                gap-3
                md:justify-end
              "
            >
              <span
                className="
                  border
                  border-[#d4d5d9]
                  bg-white
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-[#696b79]
                "
              >
                Instagram
              </span>

              <span
                className="
                  border
                  border-[#d4d5d9]
                  bg-white
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-[#696b79]
                "
              >
                Facebook
              </span>

              <span
                className="
                  border
                  border-[#d4d5d9]
                  bg-white
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-[#696b79]
                "
              >
                YouTube
              </span>
            </div>
          </div>
        </div>

        {/* =========================================
            POPULAR SEARCHES
        ========================================= */}

        <div
          className="
            mt-10
            border-t
            border-[#eaeaec]
            pt-8
          "
        >
          <div
            className="
              flex
              items-center
              gap-4
            "
          >
            <h3
              className="
                shrink-0
                text-xs
                font-bold
                uppercase
                tracking-[0.05em]
                text-[#282c3f]
              "
            >
              Popular Searches
            </h3>

            <div
              className="
                h-px
                flex-1
                bg-[#eaeaec]
              "
            />
          </div>

          <div
            className="
              mt-5
              flex
              flex-wrap
              text-[13px]
              leading-7
              text-[#696b79]
            "
          >
            {popularSearches.map(
              (search, index) => (
                <Link
                  key={search}
                  to={`/shop?search=${encodeURIComponent(
                    search
                  )}`}
                  className="
                    hover:text-orange-600
                  "
                >
                  {search}

                  {index !==
                    popularSearches.length -
                      1 && (
                    <span
                      className="
                        mx-2
                        text-[#d4d5d9]
                      "
                    >
                      |
                    </span>
                  )}
                </Link>
              )
            )}
          </div>
        </div>

        {/* =========================================
            COPYRIGHT
        ========================================= */}

        <div
          className="
            mt-8
            flex
            flex-col
            gap-3
            border-t
            border-[#eaeaec]
            pt-6
            text-xs
            text-[#94969f]
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <p>
            © {currentYear} GymDrobe.
            All rights reserved.
          </p>

          <p>
            Everything You Need for Every Workout.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;