import Hero from "../components/Hero";

import CategorySection from "../components/CategorySection";

import HomeProductSections from "../components/HomeProductSections";

import Footer from "../components/Footer";

function Home({
  wishlist = [],
  toggleWishlist,
}) {
  return (
    <main className="bg-white">
      <Hero />

      <CategorySection />

      <HomeProductSections
        wishlist={wishlist}
        toggleWishlist={
          toggleWishlist
        }
      />

      <Footer />
    </main>
  );
}

export default Home;