import { Link } from "react-router-dom";

function CategoryCard({
  name,
  icon,
  offer,
  comingSoon = false,
}) {
  return (
    <Link
      to={`/shop?category=${encodeURIComponent(name)}`}
      className="
        group
        block
        overflow-hidden
        bg-white
      "
    >
      <div
        className="
          relative
          aspect-[3/4]
          overflow-hidden
          bg-[#f5f5f6]
        "
      >
        <img
          src={icon}
          alt={name}
          className="
            h-full
            w-full
            object-cover
            transition
            duration-500
            group-hover:scale-[1.04]
          "
        />

        <div
          className="
            absolute
            inset-x-0
            bottom-0
            bg-gradient-to-t
            from-black/85
            via-black/45
            to-transparent
            px-3
            pb-4
            pt-16
            text-center
          "
        >
          <h3
            className="
              text-sm
              font-bold
              uppercase
              leading-tight
              text-white
              sm:text-base
            "
          >
            {name}
          </h3>

          <p
            className="
              mt-1
              text-[10px]
              font-bold
              uppercase
              tracking-[0.08em]
              text-orange-300
              sm:text-xs
            "
          >
            {comingSoon ? "Coming Soon" : offer}
          </p>

          {!comingSoon && (
            <p
              className="
                mt-2
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-white
              "
            >
              Shop Now →
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default CategoryCard;