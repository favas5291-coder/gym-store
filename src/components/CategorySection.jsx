import CategoryCard from "./CategoryCard";

import categories from "../data/categories";
import products from "../data/products";

function CategorySection() {
  return (
    <section
      id="categories"
      className="
        bg-[#f8f8f8]
        py-10
        md:py-14
      "
    >
      <div
        className="
          mx-auto
          max-w-[1600px]
          px-4
          sm:px-6
          lg:px-8
        "
      >
        {/* HEADER */}

        <div className="mb-7 md:mb-9">
          <p
            className="
              text-[11px]
              font-bold
              uppercase
              tracking-[0.2em]
              text-orange-600
            "
          >
            Find Your Gear
          </p>

          <h2
            className="
              mt-2
              text-xl
              font-bold
              uppercase
              tracking-[0.06em]
              text-[#282c3f]
              sm:text-2xl
              md:text-[28px]
            "
          >
            Shop By Category
          </h2>
        </div>

        {/* CATEGORY GRID */}

        <div
          className="
            grid
            grid-cols-2
            gap-[2px]
            sm:grid-cols-3
            lg:grid-cols-4
          "
        >
          {categories.map((category) => {
            const categoryProducts =
              products.filter(
                (product) =>
                  product.category === category.name
              );

            const discounts =
              categoryProducts.map(
                (product) =>
                  Number(product.discount || 0)
              );

            const maxDiscount =
              discounts.length > 0
                ? Math.max(...discounts)
                : 0;

            const comingSoon =
              categoryProducts.length === 0;

            return (
              <CategoryCard
                key={category.name}
                name={category.name}
                icon={category.icon}
                comingSoon={comingSoon}
                offer={
                  maxDiscount > 0
                    ? `Up To ${maxDiscount}% Off`
                    : "Shop Collection"
                }
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default CategorySection;