import { useState } from "react";

import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import CategorySection from "./components/CategorySection";
import ProductSection from "./components/ProductSection";
import Cart from "./components/Cart";
import Footer from "./components/Footer";

function App() {
  const [cart, setCart] = useState([]);

  function addToCart(product) {
    setCart((currentCart) => [
      ...currentCart,
      product
    ]);
  }

  return (
    <>
      <Navbar cartCount={cart.length} />

      <Hero />

      <CategorySection />

      <ProductSection
        onAddToCart={addToCart}
      />

      <Cart cart={cart} />

      <Footer />
    </>
  );
}

export default App;