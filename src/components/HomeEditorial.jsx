import { Link } from "react-router-dom";

const departments = [
  { gender: "Women", image: "women-hoodie" },
  { gender: "Men", image: "men-hoodie" },
];

export default function HomeEditorial() {
  return (
    <section className="department-campaign" aria-labelledby="department-heading">
      <header>
        <h1 id="department-heading">Gear for every workout.</h1>
        <p>Workout clothing, accessories and essentials for every training journey.</p>
        <Link className="opening-shop-link" to="/shop">Shop now</Link>
      </header>
      <div className="department-tiles">
        {departments.map(({ gender, image }, index) => (
          <Link key={gender} className="department-tile" to={`/shop?gender=${gender}`}>
            <img src={`/media/campaign/${image}-736.webp`}
              srcSet={`/media/campaign/${image}-432.webp 432w, /media/campaign/${image}-736.webp 736w`}
              sizes="(max-width: 700px) 94vw, 47vw" alt="" width="640" height="640"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"} />
            <span>{gender}’s</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
