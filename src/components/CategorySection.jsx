import CategoryCard from "./CategoryCard";

function CategorySection() {
  const categories = [
    { name: "Workout Clothes", icon: "👕" },
    { name: "Shoes", icon: "👟" },
    { name: "Protein", icon: "🥚" },
    { name: "Socks", icon: "🧦" },
    { name: "Water Bottles", icon: "💧" },
    { name: "Shaker Bottles", icon: "🥤" },
    { name: "Gym Towels", icon: "🧖" },
    { name: "Headphones", icon: "🎧" },
    { name: "Padlocks", icon: "🔒" }
  ];

  return (
    <section
      id="categories"
      className="py-20 px-6 bg-gray-100"
    >
      <h2 className="text-4xl font-bold text-center mb-12">
        SHOP BY CATEGORY
      </h2>

      <div
        className="
        max-w-6xl
        mx-auto
        grid
        grid-cols-2
        md:grid-cols-3
        lg:grid-cols-4
        gap-6
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
    </section>
  );
}

export default CategorySection;