function Navbar({ cartCount = 0 }) {
  return (
    <nav className="bg-black text-white px-6 lg:px-16 h-20 flex items-center justify-between">

      <a
        href="#top"
        className="text-2xl font-bold tracking-wide"
      >
        Gym 
        
      </a>

      <div className="hidden md:flex gap-8">
        <a href="#top" className="hover:text-orange-500">Home</a>
        <a href="#products" className="hover:text-orange-500">Shop</a>
        <a href="#categories" className="hover:text-orange-500">Categories</a>
        <a href="#offers" className="hover:text-orange-500">Offers</a>
      </div>

      <div
        className="text-xl font-semibold"
        aria-label={`${cartCount} items in cart`}
      >
        🛒 {cartCount}
      </div>

    </nav>
  );
}

export default Navbar;