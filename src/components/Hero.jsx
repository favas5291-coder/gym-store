import { Link } from "react-router-dom";
import products from "../data/products";

function Hero() {
  const heroProducts = products
    .filter((product) => Number(product.stock || 0) > 0)
    .slice(0, 3);

  return (
    <section className="bg-white">
      {/* =========================================
          TOP OFFER STRIP
      ========================================= */}

      <Link
        to="/shop"
        className="
          block
          border-b
          border-orange-100
          bg-[#fff4e8]
          px-4
          py-3
          text-center
        "
      >
        <p
          className="
            text-[11px]
            font-semibold
            uppercase
            tracking-[0.08em]
            text-[#282c3f]
            sm:text-xs
          "
        >
          GymDrobe Training Sale
          <span className="mx-2 text-orange-600">•</span>
          Up To 10% Off
          <span className="mx-2 text-orange-600">•</span>
          Shop Now →
        </p>
      </Link>

      {/* =========================================
          MAIN HERO
      ========================================= */}

      <div
        className="
          mx-auto
          max-w-[1600px]
          px-0
          pt-4
          md:px-6
          md:pt-6
        "
      >
        <div
          className="
            grid
            overflow-hidden
            bg-[#f2ede7]
            md:min-h-[430px]
            md:grid-cols-[0.9fr_1.1fr]
          "
        >
          {/* LEFT */}

          <div
            className="
              flex
              flex-col
              justify-center
              px-6
              py-10
              sm:px-10
              md:px-14
              lg:px-20
            "
          >
            <p
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.2em]
                text-orange-600
              "
            >
              GymDrobe Training Edit
            </p>

            <h1
              className="
                mt-4
                max-w-[620px]
                text-[38px]
                font-extrabold
                leading-[1.02]
                tracking-[-0.04em]
                text-[#282c3f]
                sm:text-5xl
                lg:text-[64px]
              "
            >
              GEAR UP.
              <br />
              MOVE BETTER.
            </h1>

            <p
              className="
                mt-5
                max-w-[500px]
                text-sm
                leading-6
                text-[#696b79]
                sm:text-base
              "
            >
              Performance clothing, training shoes
              and workout essentials built for
              every session.
            </p>

            <div
              className="
                mt-7
                flex
                flex-wrap
                gap-3
              "
            >
              <Link
                to="/shop"
                className="
                  inline-flex
                  min-h-[46px]
                  items-center
                  justify-center
                  bg-orange-600
                  px-7
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.08em]
                  text-white
                  transition
                  hover:bg-orange-700
                "
              >
                Shop Collection
              </Link>

              <Link
                to="/shop?search=bestseller"
                className="
                  inline-flex
                  min-h-[46px]
                  items-center
                  justify-center
                  border
                  border-[#282c3f]
                  bg-transparent
                  px-7
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.08em]
                  text-[#282c3f]
                  transition
                  hover:bg-[#282c3f]
                  hover:text-white
                "
              >
                Bestsellers
              </Link>
            </div>
          </div>

          {/* RIGHT PRODUCT VISUAL */}

          <div
            className="
              grid
              min-h-[320px]
              grid-cols-3
              border-t
              border-white/60
              md:min-h-full
              md:border-l
              md:border-t-0
            "
          >
            {heroProducts.map((product, index) => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className={`
                  group
                  relative
                  overflow-hidden
                  ${
                    index !== heroProducts.length - 1
                      ? "border-r border-white/70"
                      : ""
                  }
                `}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="
                    absolute
                    inset-0
                    h-full
                    w-full
                    object-cover
                    transition
                    duration-700
                    group-hover:scale-105
                  "
                />

                <div
                  className="
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-black/70
                    via-black/10
                    to-transparent
                  "
                />

                <div
                  className="
                    absolute
                    bottom-0
                    left-0
                    right-0
                    p-3
                    text-white
                    sm:p-5
                  "
                >
                  {product.badge && (
                    <p
                      className="
                        text-[8px]
                        font-bold
                        uppercase
                        tracking-wider
                        text-orange-300
                        sm:text-[10px]
                      "
                    >
                      {product.badge}
                    </p>
                  )}

                  <p
                    className="
                      mt-1
                      line-clamp-2
                      text-[11px]
                      font-bold
                      leading-tight
                      text-white
                      sm:text-sm
                    "
                  >
                    {product.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* DOTS */}

        <div
          className="
            flex
            items-center
            justify-center
            gap-2
            py-3
          "
        >
          <span className="h-1.5 w-5 rounded-full bg-orange-600" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        </div>
      </div>

      {/* =========================================
          BENEFITS BAR
      ========================================= */}

      <div
        className="
          border-y
          border-[#eaeaec]
          bg-white
        "
      >
        <div
          className="
            mx-auto
            grid
            max-w-[1600px]
            grid-cols-1
            divide-y
            divide-[#eaeaec]
            sm:grid-cols-3
            sm:divide-x
            sm:divide-y-0
          "
        >
          <div className="px-5 py-4 text-center">
            <p className="text-xs font-bold uppercase text-[#282c3f]">
              Free Delivery
            </p>

            <p className="mt-1 text-[11px] text-[#696b79]">
              On qualifying orders above ₹500
            </p>
          </div>

          <div className="px-5 py-4 text-center">
            <p className="text-xs font-bold uppercase text-[#282c3f]">
              Easy Returns
            </p>

            <p className="mt-1 text-[11px] text-[#696b79]">
              Easy 7-day return & replacement
            </p>
          </div>

          <div className="px-5 py-4 text-center">
            <p className="text-xs font-bold uppercase text-[#282c3f]">
              Workout Ready
            </p>

            <p className="mt-1 text-[11px] text-[#696b79]">
              Gear selected for gym and training
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;