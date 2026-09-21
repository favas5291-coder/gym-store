import { Link } from "react-router-dom";

function Hero() {
  const videoUrl = "https://www.youtube.com/embed/D9Bm30l0BWA?autoplay=1&mute=1&loop=1&playlist=D9Bm30l0BWA&controls=0&showinfo=0&rel=0&playsinline=1";

  return (
    <section
      id="top"
      className="
        hero-video
        relative
        min-h-[calc(100vh-73px)]
        text-white
        flex
        items-center
        justify-center
        text-center
        px-4
        sm:px-6
        py-16
        overflow-hidden
      "
    >
      <div className="absolute inset-0 overflow-hidden">
        <iframe
          title="Workout background video"
          src={videoUrl}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen={false}
          className="hero-video-frame absolute pointer-events-none brightness-75 contrast-125 saturate-75"
          loading="lazy"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(8,9,13,0.68),rgba(8,9,13,0.82))]" />

      <div className="relative z-10 max-w-3xl w-full">
        <p
          className="
            tracking-[3px]
            sm:tracking-[4px]
            text-gray-400
            text-xs
            sm:text-sm
            mb-4
          "
        >
          YOUR FITNESS. YOUR STYLE.
        </p>

        <h1
          className="
            text-4xl
            sm:text-5xl
            md:text-7xl
            font-bold
            leading-[1.1]
            mb-6
          "
        >
          TRAIN HARD
          <br />
          SHOP SMART
        </h1>

        <p
          className="
            text-base
            sm:text-lg
            md:text-xl
            text-gray-300
            max-w-xl
            mx-auto
            mb-8
          "
        >
          Everything you need for every workout.
        </p>

        <Link
          to="/shop"
          className="
            inline-flex
            items-center
            justify-center
            w-full
            sm:w-auto
            bg-orange-600
            hover:bg-orange-700
            px-7
            sm:px-8
            py-4
            rounded-lg
            font-semibold
            transition
            active:scale-95
          "
        >
          EXPLORE PRODUCTS
        </Link>
      </div>
    </section>
  );
}

export default Hero;