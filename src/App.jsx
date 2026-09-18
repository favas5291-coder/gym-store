import { useState,useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import CheckoutPage from "./pages/CheckoutPage";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import CartPage from "./pages/CartPage";
import ProductPage from "./pages/ProductPage";
import WishlistPage from "./pages/WishlistPage";

function App() {
  const [cart, setCart] = useState(() => {
  const savedCart = localStorage.getItem("gymdrobe-cart");

  return savedCart
    ? JSON.parse(savedCart)
    : [];
});

const [wishlist, setWishlist] = useState(() => {
  const savedWishlist =
    localStorage.getItem("gymdrobe-wishlist");

  return savedWishlist
    ? JSON.parse(savedWishlist)
    : [];
});
useEffect(() => {
  localStorage.setItem(
    "gymdrobe-cart",
    JSON.stringify(cart)
  );
}, [cart]);

useEffect(() => {
  localStorage.setItem(
    "gymdrobe-wishlist",
    JSON.stringify(wishlist)
  );
}, [wishlist]);

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  function addToCart(
  product,
  quantity,
  selectedSize,
  selectedColor
) {
  setCart((currentCart) => {
    const existingProduct =
      currentCart.find(
        (item) =>
          item.id === product.id &&
          item.selectedSize === selectedSize &&
          item.selectedColor === selectedColor
      );

    if (existingProduct) {
      return currentCart.map((item) => {
        if (
          item.id === product.id &&
          item.selectedSize === selectedSize &&
          item.selectedColor === selectedColor
        ) {
          return {
            ...item,
            quantity:
              item.quantity + quantity,
          };
        }

        return item;
      });
    }

    const discountedPrice =
      product.price -
      (product.price * product.discount) / 100;

    return [
      ...currentCart,
      {
        ...product,
        price: discountedPrice,
        quantity,
        selectedSize,
        selectedColor,
      },
    ];
  });
}

  function toggleWishlist(product) {
    setWishlist((currentWishlist) => {
      const exists =
        currentWishlist.some(
          (item) => item.id === product.id
        );

      if (exists) {
        return currentWishlist.filter(
          (item) => item.id !== product.id
        );
      }

      return [
        ...currentWishlist,
        product,
      ];
    });
  }

  return (
    <BrowserRouter>
      
      <Navbar
  cartCount={cartCount}
  wishlistCount={wishlist.length}
/>

      <Routes>
        <Route
          path="/"
          element={
            <Home
              addToCart={addToCart}
              wishlist={wishlist}
              toggleWishlist={toggleWishlist}
            />
          }
        />

        <Route
          path="/shop"
          element={
            <Shop
              addToCart={addToCart}
              wishlist={wishlist}
              toggleWishlist={toggleWishlist}
            />
          }
        />

        <Route
          path="/cart"
          element={
            <CartPage
              cart={cart}
              setCart={setCart}
            />
          }
        />

        <Route
          path="/product/:id"
          element={
            <ProductPage
              addToCart={addToCart}
            />
          }
        />
        <Route
  path="/wishlist"
  element={
    <WishlistPage
      wishlist={wishlist}
      toggleWishlist={toggleWishlist}
    />
  }
/>
<Route
  path="/checkout"
  element={
    <CheckoutPage
      cart={cart}
      setCart={setCart}
    />
  }
/>
<Route
  path="/order-success"
  element={<OrderSuccessPage />}
/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;