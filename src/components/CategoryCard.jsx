import { Link } from "react-router-dom";

function CategoryCard({
  name,
  icon,
}) {
  return (
    <Link
      to={`/shop?category=${encodeURIComponent(
        name
      )}`}
      className="
        group
        flex
        w-[72px]
        shrink-0
        flex-col
        items-center
        sm:w-[88px]
        md:w-[100px]
      "
    >
      {/* CATEGORY IMAGE */}

      <div
        className="
          h-[64px]
          w-[64px]
          overflow-hidden
          rounded-full
          border
          border-gray-200
          bg-gray-100
          transition-all
          duration-300
          group-hover:border-orange-400
          group-hover:shadow-md

          sm:h-[76px]
          sm:w-[76px]

          md:h-[88px]
          md:w-[88px]
        "
      >
        {icon.includes("/") ? (
          <img
            src={icon}
            alt={name}
            className="
              h-full
              w-full
              object-cover
              transition-transform
              duration-300
              group-hover:scale-105
            "
          />
        ) : (
          <div
            className="
              flex
              h-full
              w-full
              items-center
              justify-center
              text-3xl
            "
          >
            {icon}
          </div>
        )}
      </div>

      {/* CATEGORY NAME */}

      <p
        className="
          mt-2
          line-clamp-2
          min-h-[30px]
          text-center
          text-[11px]
          font-semibold
          leading-[15px]
          text-gray-800
          transition
          group-hover:text-orange-600

          sm:text-xs
        "
      >
        {name}
      </p>
    </Link>
  );
}

export default CategoryCard;