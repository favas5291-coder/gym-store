
import {
  useEffect,
  useState,
} from "react";

import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

// ==========================================
// DATA
// ==========================================

import products from "./data/products";

// ==========================================
// UTILITIES
// ==========================================

import {
  getCartItemKey,
  normalizeCartItem,
  revalidateCart,
  validateCartItem,
} from "./utils/cartUtils";

// ==========================================
// COMPONENTS
// ==========================================

import Toast from "./components/Toast";
import Navbar from "./components/Navbar";

// ==========================================
// PAGES
// ==========================================

import Home from "./pages/Home";
import Shop from "./pages/Shop";
import CartPage from "./pages/CartPage";
import ProductPage from "./pages/ProductPage";
import WishlistPage from "./pages/WishlistPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AccountPage from "./pages/AccountPage";
import AddressesPage from "./pages/AddressesPage";

// ==========================================
// APP
// ==========================================

function App() {
  // ==========================================
  // TOAST
  // ==========================================

  const [toast, setToast] = useState({
    message: "",
    type: "success",
  });

  function showToast(
    message,
    type = "success"
  ) {
    setToast({
      message,
      type,
    });
  }

  function closeToast() {
    setToast({
      message: "",
      type: "success",
    });
  }

  // ==========================================
  // AUTO CLEAR TOAST
  // ==========================================

  useEffect(() => {
    if (!toast.message) {
      return;
    }

    const timer = setTimeout(() => {
      setToast({
        message: "",
        type: "success",
      });
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [toast.message]);

  // ==========================================
  // CART
  // ==========================================

  const [cart, setCart] = useState(() => {
    try {
      const savedCart =
        localStorage.getItem(
          "gymdrobe-cart"
        );

      const parsedCart = savedCart
        ? JSON.parse(savedCart)
        : [];

      // Revalidate cart against
      // current product and stock data.
      return revalidateCart(
        parsedCart,
        products
      ).cart;
    } catch {
      return [];
    }
  });

  // ==========================================
  // WISHLIST
  // ==========================================

  const [wishlist, setWishlist] = useState(
    () => {
      try {
        const savedWishlist =
          localStorage.getItem(
            "gymdrobe-wishlist"
          );

        return savedWishlist
          ? JSON.parse(savedWishlist)
          : [];
      } catch {
        return [];
      }
    }
  );

  // ==========================================
  // BUY NOW ITEM
  // ==========================================

  const [buyNowItem, setBuyNowItem] =
    useState(null);

  // ==========================================
  // CART REVALIDATION
  // ==========================================

  useEffect(() => {
    setCart((currentCart) => {
      const result = revalidateCart(
        currentCart,
        products
      );

      return result.cart;
    });
  }, []);

  // ==========================================
  // CART COUNT
  // ==========================================

  const cartCount = cart.reduce(
    (total, item) => {
      return (
        total +
        Number(item.quantity || 0)
      );
    },
    0
  );

  // ==========================================
  // WISHLIST COUNT
  // ==========================================

  const wishlistCount =
    wishlist.length;

  // ==========================================
  // SAVE CART
  // ==========================================

  useEffect(() => {
    try {
      localStorage.setItem(
        "gymdrobe-cart",
        JSON.stringify(cart)
      );
    } catch (error) {
      console.error(
        "Unable to save cart:",
        error
      );
    }
  }, [cart]);

  // ==========================================
  // SAVE WISHLIST
  // ==========================================

  useEffect(() => {
    try {
      localStorage.setItem(
        "gymdrobe-wishlist",
        JSON.stringify(wishlist)
      );
    } catch (error) {
      console.error(
        "Unable to save wishlist:",
        error
      );
    }
  }, [wishlist]);

  // ==========================================
  // BUY NOW
  // ==========================================

  function buyNow(
    product,
    quantity = 1,
    selectedSize = null,
    selectedColor = null
  ) {
    // ------------------------------------------
    // VALIDATE PRODUCT
    // ------------------------------------------

    const validation =
      validateCartItem(
        product,
        quantity,
        selectedSize,
        selectedColor
      );

    // ------------------------------------------
    // VALIDATION FAILED
    // ------------------------------------------

    if (!validation.valid) {
      showToast(
        validation.message,
        validation.stock <= 0
          ? "error"
          : "warning"
      );

      return false;
    }

    // ------------------------------------------
    // CREATE BUY NOW ITEM
    // ------------------------------------------

    const item =
      normalizeCartItem(
        product,
        quantity,
        selectedSize,
        selectedColor
      );

    // ------------------------------------------
    // SAVE BUY NOW ITEM
    // ------------------------------------------

    setBuyNowItem(item);

    return true;
  }

  // ==========================================
  // CLEAR BUY NOW
  // ==========================================

  function clearBuyNow() {
    setBuyNowItem(null);
  }

  // ==========================================
  // ADD TO CART
  // ==========================================

  function addToCart(
    product,
    quantity = 1,
    selectedSize = null,
    selectedColor = null
  ) {
    // ------------------------------------------
    // VALIDATE PRODUCT
    // ------------------------------------------

    const validation =
      validateCartItem(
        product,
        quantity,
        selectedSize,
        selectedColor
      );

    // ------------------------------------------
    // VALIDATION FAILED
    // ------------------------------------------

    if (!validation.valid) {
      showToast(
        validation.message,
        validation.stock <= 0
          ? "error"
          : "warning"
      );

      return false;
    }

    // ------------------------------------------
    // UPDATE CART
    // ------------------------------------------

    let operationSuccessful = true;

    setCart((currentCart) => {
      // ----------------------------------------
      // TEMPORARY ITEM
      // ----------------------------------------

      const newItem = {
        ...product,
        selectedSize,
        selectedColor,
      };

      // ----------------------------------------
      // FIND SAME PRODUCT + VARIANT
      // ----------------------------------------

      const existingIndex =
        currentCart.findIndex(
          (item) =>
            getCartItemKey(item) ===
            getCartItemKey(newItem)
        );

      // ----------------------------------------
      // EXISTING ITEM
      // ----------------------------------------

      if (existingIndex !== -1) {
        const existingItem =
          currentCart[existingIndex];

        const currentQuantity =
          Number(
            existingItem.quantity || 0
          );

        const requestedQuantity =
          Number(quantity) || 0;

        const newQuantity =
          currentQuantity +
          requestedQuantity;

        // --------------------------------------
        // STOCK CHECK
        // --------------------------------------

        if (
          newQuantity >
          validation.stock
        ) {
          operationSuccessful = false;

          showToast(
            `Only ${validation.stock} item${
              validation.stock > 1
                ? "s"
                : ""
            } available.`,
            "warning"
          );

          return currentCart;
        }

        // --------------------------------------
        // UPDATE ITEM
        // --------------------------------------

        showToast(
          "Cart quantity updated.",
          "success"
        );

        return currentCart.map(
          (item, index) => {
            if (
              index !== existingIndex
            ) {
              return item;
            }

            return normalizeCartItem(
              product,
              newQuantity,
              selectedSize,
              selectedColor
            );
          }
        );
      }

      // ----------------------------------------
      // NEW ITEM
      // ----------------------------------------

      showToast(
        "Product added to cart.",
        "success"
      );

      return [
        ...currentCart,
        normalizeCartItem(
          product,
          quantity,
          selectedSize,
          selectedColor
        ),
      ];
    });

    return operationSuccessful;
  }

  // ==========================================
  // TOGGLE WISHLIST
  // ==========================================

  function toggleWishlist(product) {
    if (!product) {
      return;
    }

    setWishlist((currentWishlist) => {
      // ----------------------------------------
      // CHECK EXISTING
      // ----------------------------------------

      const exists =
        currentWishlist.some(
          (item) =>
            String(item.id) ===
            String(product.id)
        );

      // ----------------------------------------
      // REMOVE
      // ----------------------------------------

      if (exists) {
        showToast(
          "Removed from wishlist.",
          "info"
        );

        return currentWishlist.filter(
          (item) =>
            String(item.id) !==
            String(product.id)
        );
      }

      // ----------------------------------------
      // ADD
      // ----------------------------------------

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

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <BrowserRouter>

      {/* ======================================
          NAVBAR
      ====================================== */}

      <Navbar
        cartCount={cartCount}
        wishlistCount={wishlistCount}
      />

      {/* ======================================
          TOAST
      ====================================== */}

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

      {/* ======================================
          ROUTES
      ====================================== */}

      <Routes>

        {/* ====================================
            HOME
        ==================================== */}

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

        {/* ====================================
            SHOP
        ==================================== */}

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

        {/* ====================================
            CART
        ==================================== */}

        <Route
          path="/cart"
          element={
            <CartPage
              cart={cart}
              setCart={setCart}
            />
          }
        />

        {/* ====================================
            PRODUCT DETAILS
        ==================================== */}

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

        {/* ====================================
            WISHLIST
        ==================================== */}

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

        {/* ====================================
            CHECKOUT
        ==================================== */}

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
              clearBuyNow={
                clearBuyNow
              }
            />
          }
        />

        {/* ====================================
            ORDER SUCCESS
        ==================================== */}

        <Route
          path="/order-success"
          element={
            <OrderSuccessPage />
          }
        />

        {/* ====================================
            ORDERS
        ==================================== */}

        <Route
          path="/orders"
          element={
            <OrdersPage />
          }
        />

        {/* ====================================
            ORDER TRACKING
            IMPORTANT:
            Keep this before /orders/:orderId
        ==================================== */}

        <Route
          path="/orders/:orderId/track"
          element={
            <OrderTrackingPage />
          }
        />

        {/* ====================================
            ORDER DETAILS
        ==================================== */}

        <Route
          path="/orders/:orderId"
          element={
            <OrderDetailsPage />
          }
        />

        {/* ====================================
            LOGIN
        ==================================== */}

        <Route
          path="/login"
          element={
            <LoginPage />
          }
        />

        {/* ====================================
            SIGNUP
        ==================================== */}

        <Route
          path="/signup"
          element={
            <SignupPage />
          }
        />

        {/* ====================================
            ACCOUNT
        ==================================== */}

        <Route
          path="/account"
          element={
            <AccountPage />
          }
        />

        {/* ====================================
            ADDRESSES
        ==================================== */}

        <Route
          path="/addresses"
          element={
            <AddressesPage />
          }
        />

        {/* ====================================
            404 / PAGE NOT FOUND
        ==================================== */}

        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
              <div className="text-center">

                <p className="text-sm font-semibold uppercase tracking-widest text-orange-500 mb-3">
                  GymDrobe
                </p>

                <h1 className="text-6xl font-bold text-gray-900 mb-4">
                  404
                </h1>

                <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                  Page Not Found
                </h2>

                <p className="text-gray-500 max-w-md mx-auto mb-8">
                  The page you're looking for
                  doesn't exist or may have
                  been moved.
                </p>

                <a
                  href="/"
                  className="
                    inline-flex
                    items-center
                    justify-center
                    px-6
                    py-3
                    rounded-xl
                    bg-black
                    text-white
                    font-semibold
                    hover:bg-gray-800
                    transition
                  "
                >
                  Back to Home
                </a>

              </div>
            </div>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

// ==========================================
// EXPORT
// ==========================================

export default App;

