function Hero() {
  return (
    <section
      id="top"
      className="min-h-screen bg-zinc-900 text-white flex items-center justify-center text-center px-6"
    >
      <div className="max-w-3xl">

        <p className="tracking-[4px] text-gray-400 mb-4">
          YOUR FITNESS. YOUR STYLE.
        </p>

        <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
          TRAIN HARD.
          <br />
          SHOP SMART.
        </h1>

        <p className="text-lg md:text-xl text-gray-300 mb-8">
          Everything you need for every workout.
        </p>

        <a
          href="#products"
          className="inline-block bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-lg font-semibold transition"
        >
          EXPLORE PRODUCTS
        </a>

      </div>
    </section>
  );
}

export default Hero;