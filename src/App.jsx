import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext.jsx";
import StoreProvider, { useStore } from "./context/StoreContext.jsx";
import CatalogProvider from "./context/CatalogContext.jsx";
import ShoppingToolsProvider from "./context/ShoppingToolsContext.jsx";

import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Toast from "./components/Toast.jsx";
import EmptyState from "./components/EmptyState.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import StoreUtilityBar from "./components/StoreUtilityBar.jsx";
import PageLoading from "./components/PageLoading.jsx";
import Home from "./pages/Home.jsx";

// Pages
const Shop = lazy(() => import("./pages/Shop.jsx"));
const ProductPage = lazy(() => import("./pages/ProductPage.jsx"));
const CartPage = lazy(() => import("./pages/CartPage.jsx"));
const WishlistPage = lazy(() => import("./pages/WishlistPage.jsx"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const SignupPage = lazy(() => import("./pages/SignupPage.jsx"));
const AccountPage = lazy(() => import("./pages/AccountPage.jsx"));
const AddressesPage = lazy(() => import("./pages/AddressesPage.jsx"));
const OrderSuccessPage = lazy(() => import("./pages/OrderSuccessPage.jsx"));
const OrdersPage = lazy(() => import("./pages/OrdersPage.jsx"));
const OrderDetailsPage = lazy(() => import("./pages/OrderDetailsPage.jsx"));
const OrderTrackingPage = lazy(() => import("./pages/OrderTrackingPage.jsx"));
const ComparePage = lazy(() => import("./pages/ComparePage.jsx"));
const SavedPage = lazy(() => import("./pages/SavedPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const OffersPage = lazy(() => import("./pages/OffersPage.jsx"));
const HelpPage = lazy(() => import("./pages/HelpPage.jsx"));
const ReceiptPage = lazy(() => import("./pages/ReceiptPage.jsx"));
const ReturnPage = lazy(() => import("./pages/ReturnPage.jsx"));
const SecurityPage = lazy(() => import("./pages/SecurityPage.jsx"));

// Admin pages
const AdminOrdersPage = lazy(() => import("./pages/AdminOrdersPage.jsx"));
const AdminProductsPage = lazy(() => import("./pages/AdminProductsPage.jsx"));
const AdminReturnsPage = lazy(() => import("./pages/AdminReturnsPage.jsx"));

// Development page
const StoreConsolePage = import.meta.env.DEV
  ? lazy(() => import("./pages/StoreConsolePage.jsx"))
  : null;

function AccountRequired({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  return user ? (
    children
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(
        location.pathname + location.search
      )}`}
      replace
    />
  );
}

function AdminRequired({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(
          location.pathname + location.search
        )}`}
        replace
      />
    );
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ScrollAndTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    const names = {
      "/": "Everything for Every Workout",
      "/shop": "Shop",
      "/cart": "Shopping bag",
      "/wishlist": "Wishlist",
      "/checkout": "Checkout",
      "/login": "Login",
      "/signup": "Create account",
      "/account": "My account",
      "/orders": "My orders",
      "/addresses": "Saved addresses",
      "/offers": "Offers & coupons",
      "/compare": "Compare products",
      "/saved": "Saved for later",
      "/help": "Shopping help",
      "/notifications": "Price & stock watches",
      "/account/security": "Password & account data",
      "/admin/orders": "Admin orders",
      "/admin/products": "Admin products & inventory",
      "/admin/returns": "Admin returns & exchanges",
      "/dev/store": "Development store console",
    };

    document.title = `GymDrobe | ${
      names[pathname] || "Your workout essentials"
    }`;
  }, [pathname]);

  return null;
}

// Kept in this file so this step needs no additional CSS file.
function CheckoutHeader() {
  return (
    <header
      aria-label="GymDrobe checkout"
      style={{
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <Link
          to="/"
          aria-label="GymDrobe home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: "44px",
            color: "#111827",
            textDecoration: "none",
            fontSize: "22px",
            fontWeight: 900,
            letterSpacing: "-1px",
          }}
        >
          GYM<span style={{ color: "#c2410c" }}>DROBE</span>
        </Link>

        <Link
          to="/cart"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "44px",
            padding: "0 14px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            color: "#111827",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <span aria-hidden="true">←&nbsp;</span>
          Back to bag
        </Link>
      </div>
    </header>
  );
}

function Layout() {
  const { cart, wishlist, toast, closeToast } = useStore();
  const { user } = useAuth();
  const location = useLocation();

  // Handles /checkout and /checkout/; query parameters do not
  // affect pathname, so Buy Now checkout uses the same layout.
  const isCheckout =
    location.pathname.replace(/\/+$/, "") === "/checkout";

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <ScrollAndTitle />

      {isCheckout ? (
        <CheckoutHeader />
      ) : (
        <>
          <Navbar
            cartCount={cart.reduce(
              (total, item) => total + item.quantity,
              0
            )}
            wishlistCount={wishlist.length}
          />
          <StoreUtilityBar />
        </>
      )}

      <main
        id="main-content"
        className="gd-storefront"
        tabIndex="-1"
      >
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Shopping tools */}
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route
                path="/notifications"
                element={<NotificationsPage />}
              />
              <Route path="/offers" element={<OffersPage />} />
              <Route
                path="/help"
                element={<HelpPage key={user?.id || "guest"} />}
              />

              {/* Account */}
              <Route
                path="/account/security"
                element={
                  <AccountRequired>
                    <SecurityPage key={user?.id} />
                  </AccountRequired>
                }
              />
              <Route
                path="/account"
                element={
                  <AccountRequired>
                    <AccountPage key={user?.id} />
                  </AccountRequired>
                }
              />
              <Route
                path="/addresses"
                element={
                  <AccountRequired>
                    <AddressesPage key={user?.id} />
                  </AccountRequired>
                }
              />

              {/* Admin */}
              <Route
                path="/admin/orders"
                element={
                  <AdminRequired>
                    <AdminOrdersPage />
                  </AdminRequired>
                }
              />
              <Route
                path="/admin/products"
                element={
                  <AdminRequired>
                    <AdminProductsPage />
                  </AdminRequired>
                }
              />
              <Route
                path="/admin/returns"
                element={
                  <AdminRequired>
                    <AdminReturnsPage />
                  </AdminRequired>
                }
              />

              {/* Receipt and returns */}
              <Route
                path="/orders/:orderId/receipt"
                element={<ReceiptPage />}
              />
              <Route
                path="/orders/:orderId/return"
                element={<ReturnPage key={user?.id || "guest"} />}
              />

              {/* Development */}
              {import.meta.env.DEV && (
                <Route
                  path="/dev/store"
                  element={<StoreConsolePage />}
                />
              )}

              {/* Store */}
              <Route path="/shop" element={<Shop />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />

              {/* Checkout */}
              <Route
                path="/checkout"
                element={<CheckoutPage key={user?.id || "guest"} />}
              />

              {/* Authentication */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Orders */}
              <Route
                path="/order-success"
                element={<OrderSuccessPage />}
              />
              <Route path="/orders" element={<OrdersPage />} />
              <Route
                path="/orders/:orderId"
                element={<OrderDetailsPage />}
              />
              <Route
                path="/orders/:orderId/track"
                element={<OrderTrackingPage />}
              />

              {/* Not found */}
              <Route
                path="*"
                element={
                  <EmptyState
                    title="This page isn’t in your wardrobe"
                    to="/"
                    label="Back to home"
                  >
                    The link may have changed. Explore GymDrobe
                    from the homepage.
                  </EmptyState>
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isCheckout && <Footer />}

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={closeToast}
      />
    </>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <CatalogProvider>
        <StoreProvider key={user?.id || "guest"}>
          <ShoppingToolsProvider>
            <Layout />
          </ShoppingToolsProvider>
        </StoreProvider>
      </CatalogProvider>
    </BrowserRouter>
  );
}