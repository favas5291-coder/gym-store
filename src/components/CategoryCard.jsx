function CategoryCard({ name, icon }) {
  return (
    <div
      className="
      bg-white
      rounded-xl
      p-8
      text-center
      shadow-sm
      hover:-translate-y-1
      hover:shadow-lg
      transition
      cursor-pointer
    "
    >
      <div className="text-5xl mb-4">
        {icon}
      </div>

      <h3 className="font-semibold">
        {name}
      </h3>
    </div>
  );
}

export default CategoryCard;