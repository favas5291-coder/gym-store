import { Link } from "react-router-dom";

const departments = [
  { gender: "Women", image: "women-hoodie" },
  { gender: "Men", image: "men-hoodie" },
];

export default function HomeEditorial() {
  return (
    <section className="department-campaign" aria-labelledby="department-heading">
      <h1 className="sr-only" id="department-heading">Gear for every workout.</h1>
      <div className="department-tiles">
        {departments.map(({ gender, image }, index) => (
          <Link key={gender} className="department-tile" to={`/shop?gender=${gender}`}>
            <img src={`/media/campaign/${image}-736.webp?v=3`}
              srcSet={`/media/campaign/${image}-432.webp?v=3 432w, /media/campaign/${image}-736.webp?v=3 736w`}
              sizes="(max-width: 700px) calc(100vw - 26px), (max-width: 1466px) calc((100vw - 34px) / 2), 716px" alt="" width="640" height="640"
              loading={index === 0 ? "eager" : "lazy"}
              onError={event => { event.currentTarget.style.visibility = "hidden"; }}
              fetchPriority={index === 0 ? "high" : "auto"} />
            <span>{gender}’s</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
