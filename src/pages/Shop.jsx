import ProductSection from "../components/ProductSection";

function Shop({
  addToCart,
  wishlist,
  toggleWishlist,
}) {
  return (
    <ProductSection
      onAddToCart={addToCart}
      wishlist={wishlist}
      toggleWishlist={toggleWishlist}
    />
  );
}

export default Shop;