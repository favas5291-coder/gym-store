import ProductSection from "../components/ProductSection";

function Shop({
  wishlist,
  toggleWishlist,
}) {
  return (
    <ProductSection
      wishlist={wishlist}
      toggleWishlist={
        toggleWishlist
      }
    />
  );
}

export default Shop;