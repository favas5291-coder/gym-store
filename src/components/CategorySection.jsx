import CategoryCard from "./CategoryCard";
import categories from "../data/categories";

function CategorySection() {
  return (
    <section
      id="categories"
      className="
        py-14
        sm:py-16
        md:py-20
        px-4
        sm:px-6
        bg-gray-100
        text-black
      "
    >

      <div className="max-w-6xl mx-auto">

        <h2
          className="
            text-3xl
            sm:text-4xl
            font-bold
            text-center
            mb-8
            sm:mb-12
          "
        >
          SHOP BY CATEGORY
        </h2>

        <div
          className="
            grid
            grid-cols-2
            md:grid-cols-3
            lg:grid-cols-4
            gap-3
            sm:gap-5
            md:gap-6
          "
        >
          {categories.map((category) => (
            <CategoryCard
              key={category.name}
              name={category.name}
              icon={category.icon}
            />
          ))}
        </div>

      </div>

    </section>
  );
}

export default CategorySection;