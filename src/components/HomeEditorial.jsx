import { Link } from "react-router-dom";

const departments = [
  { gender: "Women", photo: "/editorial/training-top-560.webp" },
  { gender: "Men", photo: "/media/campaign/hero-mobile.webp", sources: "/media/campaign/story-portrait.webp 432w, /media/campaign/hero-mobile.webp 900w" },
];

export default function HomeEditorial() {
  return (
    <section className="department-campaign" aria-labelledby="department-heading">
      <header>
        <h1 id="department-heading">Gear for every workout</h1>
        <p>Workout clothing and training essentials.</p>
      </header>
      <div className="department-tiles">
        {departments.map(({ gender, photo, sources }, index) => (
          <Link key={gender} className="department-tile" to={`/shop?gender=${gender}`}>
            <img src={photo} srcSet={sources} sizes={sources ? "(max-width: 700px) 94vw, 47vw" : undefined} alt="" width="640" height="640"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"} />
            <span>{gender}’s</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
