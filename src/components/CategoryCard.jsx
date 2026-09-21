import { Link } from "react-router-dom";

function CategoryCard({ name, icon }) {
  return (
    <Link
      to={`/shop?category=${encodeURIComponent(name)}`}
      className="
        block
        bg-white
        text-black
        rounded-xl
        p-4
        sm:p-6
        md:p-8
        text-center
        shadow-sm
        hover:-translate-y-1
        hover:shadow-lg
        transition
        active:scale-[0.98]
      "
    >

      <div
        className="
          mb-3 sm:mb-4
          overflow-hidden
          rounded-xl
          bg-gray-50
          p-2
          sm:p-3
        "
      >
        {icon.includes("/") ? (
          <img
            src={icon}
            alt=""
            aria-hidden="true"
            className="mx-auto h-20 w-full object-cover rounded-lg sm:h-24"
          />
        ) : (
          <div className="text-4xl sm:text-5xl">{icon}</div>
        )}
      </div>

      <h3
        className="
          text-sm
          sm:text-base
          font-semibold
          leading-tight
        "
      >
        {name}
      </h3>

    </Link>
  );
}

export default CategoryCard;