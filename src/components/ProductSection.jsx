import ProductCard from "./ProductCard";
import { useState, useEffect } from "react";
import products from "../data/products";
import { useSearchParams } from "react-router-dom";

function ProductSection({
  onAddToCart,
  wishlist,
  toggleWishlist,
}) {  
const [search, setSearch] = useState("");
const [sort, setSort] = useState("default");

const [minPrice, setMinPrice] = useState("");
const [maxPrice, setMaxPrice] = useState("");

const [minRating, setMinRating] = useState("0");
const [minDiscount, setMinDiscount] = useState("0");

  const [searchParams] = useSearchParams();

  const categoryFromURL =
    searchParams.get("category");

  const [category, setCategory] = useState(
    categoryFromURL || "All"
  );

  useEffect(() => {
    setCategory(categoryFromURL || "All");
  }, [categoryFromURL]);

  const filteredProducts = products
  .filter((product) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      product.name
        .toLowerCase()
        .includes(searchText) ||
      product.category
        .toLowerCase()
        .includes(searchText) ||
      product.brand
        .toLowerCase()
        .includes(searchText);

    const matchesCategory =
      category === "All" ||
      product.category === category;

    const discountedPrice =
      product.price -
      (product.price * product.discount) / 100;

    const matchesMinPrice =
      minPrice === "" ||
      discountedPrice >= Number(minPrice);

    const matchesMaxPrice =
      maxPrice === "" ||
      discountedPrice <= Number(maxPrice);

    const matchesRating =
      product.rating >= Number(minRating);

    const matchesDiscount =
      product.discount >= Number(minDiscount);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesMinPrice &&
      matchesMaxPrice &&
      matchesRating &&
      matchesDiscount
    );
  })
  .sort((a, b) => {
    if (sort === "low") {
      const priceA =
        a.price - (a.price * a.discount) / 100;

      const priceB =
        b.price - (b.price * b.discount) / 100;

      return priceA - priceB;
    }

    if (sort === "high") {
      const priceA =
        a.price - (a.price * a.discount) / 100;

      const priceB =
        b.price - (b.price * b.discount) / 100;

      return priceB - priceA;
    }

    if (sort === "rating") {
      return b.rating - a.rating;
    }

    if (sort === "discount") {
      return b.discount - a.discount;
    }

    return 0;
  })
    
  return (
    <section
      id="products"
      className="py-20 px-6 bg-gray-100"
    >
     <h2 className="text-4xl font-bold text-center mb-4">
  {category === "All"
    ? "ALL PRODUCTS"
    : category.toUpperCase()}
</h2>

<p className="text-center text-gray-500 mb-12">
  {filteredProducts.length} product
  {filteredProducts.length !== 1 ? "s" : ""} found
</p>

      {/* SEARCH + SORT */}
      <div className="max-w-6xl mx-auto mb-10">
  <div className="flex flex-col md:flex-row gap-4 mb-6">
    <input
      type="text"
      placeholder="Search products..."
      value={search}
      onChange={(e) =>
        setSearch(e.target.value)
      }
      className="flex-1 p-3 border rounded-lg bg-white"
    />

    <select
      value={sort}
      onChange={(e) =>
        setSort(e.target.value)
      }
      className="p-3 border rounded-lg bg-white"
    >
      <option value="default">
        Sort By
      </option>

      <option value="low">
        Price: Low to High
      </option>

      <option value="high">
        Price: High to Low
      </option>

      <option value="rating">
        Rating: High to Low
      </option>

      <option value="discount">
        Discount: High to Low
      </option>
    </select>
  </div>

  <div className="bg-white rounded-xl p-5 shadow-sm">
    <h3 className="font-bold text-lg mb-4">
      FILTERS
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

      {/* Minimum Price */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Minimum Price
        </label>

        <input
          type="number"
          placeholder="₹0"
          value={minPrice}
          onChange={(e) =>
            setMinPrice(e.target.value)
          }
          className="w-full p-3 border rounded-lg"
        />
      </div>

      {/* Maximum Price */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Maximum Price
        </label>

        <input
          type="number"
          placeholder="₹5000"
          value={maxPrice}
          onChange={(e) =>
            setMaxPrice(e.target.value)
          }
          className="w-full p-3 border rounded-lg"
        />
      </div>

      {/* Rating */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Minimum Rating
        </label>

        <select
          value={minRating}
          onChange={(e) =>
            setMinRating(e.target.value)
          }
          className="w-full p-3 border rounded-lg"
        >
          <option value="0">
            All Ratings
          </option>

          <option value="4">
            ⭐ 4.0+
          </option>

          <option value="4.5">
            ⭐ 4.5+
          </option>

          <option value="4.7">
            ⭐ 4.7+
          </option>

          <option value="4.8">
            ⭐ 4.8+
          </option>
        </select>
      </div>

      {/* Discount */}
      <div>
        <label className="block text-sm font-semibold mb-2">
          Minimum Discount
        </label>

        <select
          value={minDiscount}
          onChange={(e) =>
            setMinDiscount(e.target.value)
          }
          className="w-full p-3 border rounded-lg"
        >
          <option value="0">
            All Discounts
          </option>

          <option value="5">
            5%+
          </option>

          <option value="10">
            10%+
          </option>

          <option value="20">
            20%+
          </option>

          <option value="30">
            30%+
          </option>
        </select>
      </div>

    </div>

    {/* Clear Filters */}
    <button
      type="button"
      onClick={() => {
        setSearch("");
        setCategory("All");
        setSort("default");
        setMinPrice("");
        setMaxPrice("");
        setMinRating("0");
        setMinDiscount("0");
      }}
      className="mt-5 px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
    >
      CLEAR ALL FILTERS
    </button>
  </div>
</div>

      {/* CATEGORY FILTER */}
      <div className="flex flex-wrap justify-center gap-3 mb-10">

        <button
          type="button"
          onClick={() => setCategory("All")}
          className="px-4 py-2 bg-black text-white rounded-lg"
        >
          All
        </button>

        {[
          ...new Set(
            products.map(
              (product) => product.category
            )
          ),
        ].map((categoryName) => (
          <button
            key={categoryName}
            type="button"
            onClick={() =>
              setCategory(categoryName)
            }
            className="px-4 py-2 bg-white rounded-lg border"
          >
            {categoryName}
          </button>
        ))}

      </div>

      {/* PRODUCTS */}
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
        {filteredProducts.length === 0 ? (
          <p className="col-span-full text-center text-gray-500">
            No products found.
          </p>
        ) : (
          filteredProducts.map(
            (product) => (
              <ProductCard
  key={product.id}
  id={product.id}
  name={product.name}
  category={product.category}
  price={product.price}
  discount={product.discount}
  rating={product.rating}
  image={product.image}
  wishlist={wishlist}
  toggleWishlist={toggleWishlist}
  onSelect={() => {}}
/>
            )
          )
        )}
      </div>
    </section>
  );
}

export default ProductSection;