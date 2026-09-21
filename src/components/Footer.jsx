function Footer() {
  return (
    <footer
      id="offers"
      className="bg-zinc-950 text-white"
    >
      <div className="max-w-7xl mx-auto px-6 py-16">

        <div className="grid md:grid-cols-3 gap-10">

          <div>
            <h2 className="text-2xl font-black mb-3">
              Gym
            </h2>

            <p className="text-zinc-400">
              Everything you need for every
              workout.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-4">
              Quick Links
            </h3>

            <div className="space-y-2 text-zinc-400">
              <p>Home</p>
              <p>Shop</p>
              <p>Categories</p>
              <p>Wishlist</p>
            </div>
          </div>

          <div>
            <h3 className="font-bold mb-4">
              Gym
            </h3>

            <p className="text-zinc-400">
              Your complete fitness shopping
              destination.
            </p>
          </div>

        </div>

        <div className="border-t border-zinc-800 mt-12 pt-6 text-sm text-zinc-500">
          © {new Date().getFullYear()} Gym.
          All rights reserved.
        </div>

      </div>
    </footer>
  );
}

export default Footer;
