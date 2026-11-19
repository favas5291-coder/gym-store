import { Link } from "react-router-dom";

const departments = [
  { gender: "Women", image: "women-hoodie" },
  { gender: "Men", image: "men-hoodie" },
];

async function campaignLoaded(event) {
  const image = event.currentTarget;
  image.style.removeProperty("visibility");
  const tile = image.parentElement;
  if (!document.documentElement.hasAttribute("data-home-boot") || tile.dataset.homeLead !== "") return;

  const source = image.currentSrc;
  delete tile.dataset.homePhoto;
  try {
    await image.decode();
    if (image.isConnected && image.currentSrc === source) tile.dataset.homePhoto = "ready";
  } catch {
    // A viewport change can replace the responsive candidate during decoding.
    // Its own load handler will report the status of the replacement.
    if (image.isConnected && image.currentSrc === source) tile.dataset.homePhoto = "error";
  }
}

function campaignFailed(event) {
  const image = event.currentTarget;
  image.style.visibility = "hidden";
  const tile = image.parentElement;
  if (tile.dataset.homeLead === "") tile.dataset.homePhoto = "error";
}

export default function HomeEditorial() {
  return (
    <section className="department-campaign" aria-labelledby="department-heading">
      <h1 className="sr-only" id="department-heading">Gear for every workout.</h1>
      <div className="department-tiles">
        {departments.map(({ gender, image }, index) => (
          <Link key={gender} className="department-tile" data-home-lead={index === 0 ? "" : undefined} to={`/shop?gender=${gender}`}>
            <img src={`/media/campaign/${image}-736.webp?v=3`}
              srcSet={`/media/campaign/${image}-432.webp?v=3 432w, /media/campaign/${image}-736.webp?v=3 736w`}
              sizes="(max-width: 700px) calc(100vw - 26px), (max-width: 1466px) calc((100vw - 34px) / 2), 716px" alt="" width="640" height="640"
              loading={index === 0 ? "eager" : "lazy"}
              onLoad={campaignLoaded}
              onError={campaignFailed}
              fetchPriority={index === 0 ? "high" : "auto"} />
            <span>{gender}’s</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
