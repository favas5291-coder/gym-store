import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import OrdersPage from "./pages/OrdersPage";
import Toast from "./components/Toast";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import CartPage from "./pages/CartPage";
import ProductPage from "./pages/ProductPage";
import WishlistPage from "./pages/WishlistPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";

function App() {
  // ==============================
  // TOAST
  // ==============================

  const [toast, setToast] = useState({
    message: "",
    type: "success",
  });

  function showToast(message, type = "success") {
    setToast({
      message,
      type,
    });

    setTimeout(() => {
      setToast({
        message: "",
        type: "success",
      });
    }, 3000);
  }

  // ==============================
  // CART
  // ==============================

  const [cart, setCart] = useState(() => {
    const savedCart =
      localStorage.getItem("gymdrobe-cart");

    try {
      return savedCart
        ? JSON.parse(savedCart)
        : [];
    } catch {
      return [];
    }
  });

  // ==============================
  // WISHLIST
  // ==============================

  const [wishlist, setWishlist] = useState(() => {
    const savedWishlist =
      localStorage.getItem("gymdrobe-wishlist");

    try {
      return savedWishlist
        ? JSON.parse(savedWishlist)
        : [];
    } catch {
      return [];
    }
  });

  // ==============================
  // CART COUNT
  // ==============================

  const cartCount = cart.reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0
  );

  // ==============================
  // SAVE CART
  // ==============================

  useEffect(() => {
    localStorage.setItem(
      "gymdrobe-cart",
      JSON.stringify(cart)
    );
  }, [cart]);

  // ==============================
  // SAVE WISHLIST
  // ==============================

  useEffect(() => {
    localStorage.setItem(
      "gymdrobe-wishlist",
      JSON.stringify(wishlist)
    );
  }, [wishlist]);

  // ==============================
  // GET VARIANT STOCK
  // ==============================

  function getVariantStock(
    product,
    selectedSize,
    selectedColor
  ) {
    // --------------------------------
    // Product has no variants
    // --------------------------------

    if (!product.variants) {
      return product.stock ?? 0;
    }

    // --------------------------------
    // Size + Color
    // --------------------------------

    if (
      selectedColor &&
      selectedSize
    ) {
      return (
        product.variants?.[
          selectedColor
        ]?.[selectedSize] ?? 0
      );
    }

    // --------------------------------
    // Color Only
    // --------------------------------

    if (selectedColor) {
      return (
        product.variants?.[
          selectedColor
        ]?.default ?? 0
      );
    }

    // --------------------------------
    // Nothing Selected
    // --------------------------------

    return 0;
  }

  // ==============================
  // BUY NOW ITEM
  // ==============================

  const [buyNowItem, setBuyNowItem] =
    useState(null);

  // ==============================
  // BUY NOW
  // ==============================

  function buyNow(
    product,
    quantity = 1,
    selectedSize = null,
    selectedColor = null
  ) {
    // --------------------------------
    // GET STOCK
    // --------------------------------

    const stock = getVariantStock(
      product,
      selectedSize,
      selectedColor
    );

    // --------------------------------
    // OUT OF STOCK
    // --------------------------------

    if (stock <= 0) {
      showToast(
        "This product is out of stock.",
        "error"
      );

      return false;
    }

    // --------------------------------
    // QUANTITY CHECK
    // --------------------------------

    if (quantity > stock) {
      showToast(
        `Only ${stock} item${
          stock > 1 ? "s" : ""
        } available.`,
        "warning"
      );

      return false;
    }

    // --------------------------------
    // CALCULATE SELLING PRICE
    // --------------------------------

    const discountedPrice =
      product.price -
      (product.price * product.discount) /
        100;

    // --------------------------------
    // CREATE BUY NOW ITEM
    // --------------------------------

    setBuyNowItem({
      ...product,
      price: discountedPrice,
      quantity,
      selectedSize,
      selectedColor,
    });

    return true;
  }

  // ==============================
  // CLEAR BUY NOW
  // ==============================

  function clearBuyNow() {
    setBuyNowItem(null);
  }

  // ==============================
  // ADD TO CART
  // ==============================

  function addToCart(
    product,
    quantity = 1,
    selectedSize = null,
    selectedColor = null
  ) {
    // --------------------------------
    // GET STOCK
    // --------------------------------

    const stock = getVariantStock(
      product,
      selectedSize,
      selectedColor
    );

    // --------------------------------
    // OUT OF STOCK
    // --------------------------------

    if (stock <= 0) {
      showToast(
        "This product is out of stock.",
        "error"
      );

      return;
    }

    // --------------------------------
    // UPDATE CART
    // --------------------------------

    setCart((currentCart) => {
      const existingProduct =
        currentCart.find(
          (item) =>
            item.id === product.id &&
            item.selectedSize ===
              selectedSize &&
            item.selectedColor ===
              selectedColor
        );

      // ==============================
      // EXISTING VARIANT
      // ==============================

      if (existingProduct) {
        const newQuantity =
          existingProduct.quantity +
          quantity;

        // --------------------------------
        // DON'T EXCEED STOCK
        // --------------------------------

        if (newQuantity > stock) {
          showToast(
            `Only ${stock} item${
              stock > 1 ? "s" : ""
            } available.`,
            "warning"
          );

          return currentCart;
        }

        showToast(
          "Cart quantity updated.",
          "success"
        );

        return currentCart.map((item) => {
          if (
            item.id === product.id &&
            item.selectedSize ===
              selectedSize &&
            item.selectedColor ===
              selectedColor
          ) {
            return {
              ...item,
              quantity: newQuantity,
            };
          }

          return item;
        });
      }

      // ==============================
      // NEW VARIANT
      // ==============================

      if (quantity > stock) {
        showToast(
          `Only ${stock} item${
            stock > 1 ? "s" : ""
          } available.`,
          "warning"
        );

        return currentCart;
      }

      // ==============================
      // CALCULATE DISCOUNTED PRICE
      // ==============================

      const discountedPrice =
        product.price -
        (product.price * product.discount) /
          100;

      // ==============================
      // ADD PRODUCT
      // ==============================

      showToast(
        "Product added to cart.",
        "success"
      );

      return [
        ...currentCart,
        {
          ...product,

          // Current selling price
          price: discountedPrice,

          quantity,

          selectedSize,
          selectedColor,
        },
      ];
    });
  }

  // ==============================
  // WISHLIST
  // ==============================

  function toggleWishlist(product) {
    setWishlist((currentWishlist) => {
      const exists =
        currentWishlist.some(
          (item) =>
            item.id === product.id
        );

      // ==============================
      // REMOVE
      // ==============================

      if (exists) {
        showToast(
          "Removed from wishlist.",
          "info"
        );

        return currentWishlist.filter(
          (item) =>
            item.id !== product.id
        );
      }

      // ==============================
      // ADD
      // ==============================

      showToast(
        "Added to wishlist.",
        "success"
      );

      return [
        ...currentWishlist,
        product,
      ];
    });
  }

  // ==============================
  // APP
  // ==============================

  return (
    <BrowserRouter>

      {/* ==============================
          NAVBAR
          ============================== */}

      <Navbar
        cartCount={cartCount}
        wishlistCount={wishlist.length}
      />

      {/* ==============================
          TOAST
          ============================== */}

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() =>
          setToast({
            message: "",
            type: "success",
          })
        }
      />

      {/* ==============================
          ROUTES
          ============================== */}

      <Routes>

        {/* ==============================
            HOME
            ============================== */}

        <Route
          path="/"
          element={
            <Home
              addToCart={addToCart}
              wishlist={wishlist}
              toggleWishlist={
                toggleWishlist
              }
            />
          }
        />

        {/* ==============================
            SHOP
            ============================== */}

        <Route
          path="/shop"
          element={
            <Shop
              addToCart={addToCart}
              wishlist={wishlist}
              toggleWishlist={
                toggleWishlist
              }
            />
          }
        />

        {/* ==============================
            CART
            ============================== */}

        <Route
          path="/cart"
          element={
            <CartPage
              cart={cart}
              setCart={setCart}
            />
          }
        />

        {/* ==============================
            PRODUCT
            ============================== */}

        <Route
          path="/product/:id"
          element={
            <ProductPage
              addToCart={addToCart}
              buyNow={buyNow}
              wishlist={wishlist}
              toggleWishlist={
                toggleWishlist
              }
            />
          }
        />

        {/* ==============================
            WISHLIST
            ============================== */}

        <Route
          path="/wishlist"
          element={
            <WishlistPage
              wishlist={wishlist}
              toggleWishlist={
                toggleWishlist
              }
            />
          }
        />

        {/* ==============================
            CHECKOUT
            ============================== */}

        <Route
          path="/checkout"
          element={
            <CheckoutPage
              cart={cart}
              setCart={setCart}
              buyNowItem={buyNowItem}
              setBuyNowItem={
                setBuyNowItem
              }
              clearBuyNow={clearBuyNow}
            />
          }
        />

        {/* ==============================
            ORDER SUCCESS
            ============================== */}

        <Route
          path="/order-success"
          element={
            <OrderSuccessPage />
          }
        />

        {/* ==============================
            ORDERS
            ============================== */}

        <Route
          path="/orders"
          element={
            <OrdersPage />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

// ==============================
// EXPORT APP
// ==============================

export default App;