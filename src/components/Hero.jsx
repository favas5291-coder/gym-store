import { Link } from "react-router-dom";

function Hero() {
  return (
    <section className="bg-white px-4 py-4">

      {/* Top Offer Banner */}

      <div
        className="
          bg-gradient-to-r
          from-orange-500
          via-orange-600
          to-red-500
          text-white
          rounded-3xl
          p-5
          flex
          items-center
          justify-between
          mb-5
          shadow-lg
        "
      >
        <div>
          <p className="text-xs uppercase tracking-[3px] opacity-90">
            GymDrobe Exclusive
          </p>

          <h3 className="text-2xl font-bold mt-1">
            Up To 70% OFF
          </h3>

          <p className="text-sm opacity-90 mt-1">
            Premium Gym Wear & Accessories
          </p>
        </div>

        <div className="text-5xl animate-pulse">
          🔥
        </div>
      </div>

      {/* Main Banner */}

      <div
        className="
          relative
          overflow-hidden
          rounded-[32px]
          h-[500px]
          shadow-xl
        "
      >
        <img
          src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438"
          alt="GymDrobe"
          className="
            absolute
            inset-0
            w-full
            h-full
            object-cover
            scale-105
          "
        />

        <div
          className="
            absolute
            inset-0
            bg-gradient-to-r
            from-black/90
            via-black/60
            to-black/20
          "
        />

        <div
          className="
            relative
            z-10
            h-full
            flex
            items-center
          "
        >
          <div className="max-w-2xl px-8 md:px-14">

            <span
              className="
                inline-block
                bg-orange-600
                px-4
                py-2
                rounded-full
                text-xs
                font-bold
                tracking-wider
                mb-5
              "
            >
              NEW ARRIVALS
            </span>

            <h1
              className="
                text-5xl
                md:text-7xl
                font-black
                text-white
                leading-tight
              "
            >
              EVERYTHING
              <br />
              YOU NEED
              <br />
              FOR EVERY
              <br />
              WORKOUT
            </h1>

            <p
              className="
                mt-6
                text-gray-300
                text-lg
                max-w-xl
              "
            >
              Discover premium gym clothing,
              shoes, bottles, towels,
              accessories and supplements
              designed for performance.
            </p>

            <div className="flex flex-wrap gap-4 mt-8">

              <Link
                to="/shop"
                className="
                  bg-orange-600
                  hover:bg-orange-700
                  px-8
                  py-4
                  rounded-xl
                  font-bold
                  transition
                "
              >
                SHOP NOW
              </Link>

              <Link
                to="/wishlist"
                className="
                  border-2
                  border-white
                  hover:bg-white
                  hover:text-black
                  px-8
                  py-4
                  rounded-xl
                  font-bold
                  transition
                "
              >
                WISHLIST
              </Link>

            </div>

          </div>
        </div>

        {/* Stats */}

        <div
          className="
            absolute
            bottom-6
            left-6
            right-6
            bg-white/10
            backdrop-blur-md
            rounded-2xl
            p-4
            grid
            grid-cols-3
            gap-4
            text-white
          "
        >
          <div className="text-center">
            <h4 className="font-bold text-xl">
              10K+
            </h4>
            <p className="text-xs">
              Customers
            </p>
          </div>

          <div className="text-center">
            <h4 className="font-bold text-xl">
              500+
            </h4>
            <p className="text-xs">
              Products
            </p>
          </div>

          <div className="text-center">
            <h4 className="font-bold text-xl">
              4.9★
            </h4>
            <p className="text-xs">
              Rating
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}

export default Hero;