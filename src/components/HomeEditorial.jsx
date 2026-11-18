import { Link } from "react-router-dom";

const departments = [
  { gender: "Women", photo: "/editorial/training-top-560.webp" },
  { gender: "Men", photo: "/media/campaign/hero-mobile.webp" },
];

export default function HomeEditorial() {
  return (
    <section className="department-campaign" aria-labelledby="department-heading">
      <header>
        <h1 id="department-heading">Gear for every workout</h1>
        <p>Workout clothing and training essentials.</p>
      </header>
      <div className="department-tiles">
        {departments.map(({ gender, photo }, index) => (
          <Link key={gender} className="department-tile" to={`/shop?gender=${gender}`}>
            <img src={photo} alt="" width="640" height="640"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"} />
            <span>{gender}’s</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
