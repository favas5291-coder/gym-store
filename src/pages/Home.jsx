import Hero from "../components/Hero";
import CategorySection from "../components/CategorySection";
import ProductSection from "../components/ProductSection";
import Footer from "../components/Footer";

function Home({
  addToCart,
  wishlist,
  toggleWishlist,
}) {
  return (
    <>
      <Hero />

      <CategorySection />

      <ProductSection
        onAddToCart={addToCart}
        wishlist={wishlist}
        toggleWishlist={toggleWishlist}
      />

      <Footer />
    </>
  );
}

export default Home;