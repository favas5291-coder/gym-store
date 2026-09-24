import { Link } from "react-router-dom";

import CategoryCard from "./CategoryCard";
import categories from "../data/categories";

function CategorySection() {
  return (
    <section
      id="categories"
      className="
        border-b
        border-gray-100
        bg-white
        py-5
        sm:py-6
        md:py-8
      "
    >
      <div
        className="
          mx-auto
          max-w-[1440px]
        "
      >
        {/* ===============================
            SECTION HEADER
        =============================== */}

        <div
          className="
            mb-4
            flex
            items-center
            justify-between
            px-4
            sm:px-6
            md:mb-6
            md:px-8
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-bold
                uppercase
                tracking-[0.18em]
                text-orange-600
                sm:text-xs
              "
            >
              GymDrobe
            </p>

            <h2
              className="
                mt-1
                text-lg
                font-bold
                text-gray-900
                sm:text-xl
                md:text-2xl
              "
            >
              Shop By Category
            </h2>
          </div>

          <Link
            to="/shop"
            className="
              shrink-0
              text-xs
              font-bold
              text-orange-600
              transition
              hover:text-orange-700
              sm:text-sm
            "
          >
            VIEW ALL →
          </Link>
        </div>

        {/* ===============================
            CATEGORY ROW
        =============================== */}

        <div
          className="
            flex
            gap-3
            overflow-x-auto
            scroll-smooth
            px-4
            pb-2

            sm:gap-5
            sm:px-6

            md:gap-7
            md:px-8

            lg:justify-start

            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          {categories.map(
            (category) => (
              <CategoryCard
                key={category.name}
                name={category.name}
                icon={category.icon}
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}

export default CategorySection;