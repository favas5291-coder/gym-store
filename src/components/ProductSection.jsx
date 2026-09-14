import ProductCard from "./ProductCard";

function ProductSection({ onAddToCart }) {
  const products = [
    {
      id: 1,
      name: "Gym Training T-Shirt",
      category: "Workout Clothes",
      price: 799,
      rating: 4.8
    },
    {
      id: 2,
      name: "Performance Gym Shoes",
      category: "Gym Shoes",
      price: 2499,
      rating: 4.7
    },
    {
      id: 3,
      name: "Premium Shaker Bottle",
      category: "Shaker Bottles",
      price: 599,
      rating: 4.6
    }
  ];

  return (
    <section
      id="products"
      className="py-20 px-6 bg-gray-100"
    >
      <h2 className="text-4xl font-bold text-center mb-12">
        FEATURED PRODUCTS
      </h2>

      <div
        className="
        max-w-6xl
        mx-auto
        grid
        grid-cols-1
        md:grid-cols-2
        lg:grid-cols-3
        gap-6
      "
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            name={product.name}
            category={product.category}
            price={product.price}
            rating={product.rating}
            onAddToCart={() => onAddToCart(product)}
          />
        ))}
      </div>
    </section>
  );
}

export default ProductSection;