import {
  lazy,
  Suspense,
  useEffect,
} from "react";

import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  analyticsVisitKey,
  commercePayload,
  trackOnce,
} from "./utils/analytics.js";

import { useAuth } from "./context/AuthContext.jsx";

import StoreProvider, {
  useStore,
} from "./context/StoreContext.jsx";

import CatalogProvider from "./context/CatalogContext.jsx";
import ShoppingToolsProvider from "./context/ShoppingToolsContext.jsx";

import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Toast from "./components/Toast.jsx";
import EmptyState from "./components/EmptyState.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import StoreUtilityBar from "./components/StoreUtilityBar.jsx";
import PageLoading from "./components/PageLoading.jsx";
import AnalyticsController from "./components/AnalyticsController.jsx";
import SEOController from "./components/SEOController.jsx";
import DeferredFitnessGuide from "./components/DeferredFitnessGuide.jsx";

import Home from "./pages/Home.jsx";

const Shop = lazy(
  () => import("./pages/Shop.jsx"),
);

const ProductPage = lazy(
  () => import("./pages/ProductPage.jsx"),
);

const CartPage = lazy(
  () => import("./pages/CartPage.jsx"),
);

const WishlistPage = lazy(
  () => import("./pages/WishlistPage.jsx"),
);

const CheckoutPage = lazy(
  () => import("./pages/CheckoutPage.jsx"),
);

const LoginPage = lazy(
  () => import("./pages/LoginPage.jsx"),
);

const AccountPage = lazy(
  () => import("./pages/AccountPage.jsx"),
);

const AddressesPage = lazy(
  () => import("./pages/AddressesPage.jsx"),
);

const SecurityPage = lazy(
  () => import("./pages/SecurityPage.jsx"),
);

const OrderSuccessPage = lazy(
  () => import("./pages/OrderSuccessPage.jsx"),
);

const OrdersPage = lazy(
  () => import("./pages/OrdersPage.jsx"),
);

const OrderDetailsPage = lazy(
  () => import("./pages/OrderDetailsPage.jsx"),
);

const OrderTrackingPage = lazy(
  () => import("./pages/OrderTrackingPage.jsx"),
);

const ReceiptPage = lazy(
  () => import("./pages/ReceiptPage.jsx"),
);

const ReturnPage = lazy(
  () => import("./pages/ReturnPage.jsx"),
);

const ComparePage = lazy(
  () => import("./pages/ComparePage.jsx"),
);

const SavedPage = lazy(
  () => import("./pages/SavedPage.jsx"),
);

const NotificationsPage = lazy(
  () => import("./pages/NotificationsPage.jsx"),
);

const OffersPage = lazy(
  () => import("./pages/OffersPage.jsx"),
);

const HelpPage = lazy(
  () => import("./pages/HelpPage.jsx"),
);

const FitnessKitsPage = lazy(
  () => import("./pages/FitnessKitsPage.jsx"),
);

const AdminDashboardPage = lazy(
  () => import("./pages/AdminDashboardPage.jsx"),
);

const AdminCustomersPage = lazy(
  () => import("./pages/AdminCustomersPage.jsx"),
);

const AdminSupportPage = lazy(
  () => import("./pages/AdminSupportPage.jsx"),
);

const AdminOrdersPage = lazy(
  () => import("./pages/AdminOrdersPage.jsx"),
);

const AdminProductsPage = lazy(
  () => import("./pages/AdminProductsPage.jsx"),
);

const AdminReturnsPage = lazy(
  () => import("./pages/AdminReturnsPage.jsx"),
);

const AdminSuppliersPage = lazy(
  () => import("./pages/AdminSuppliersPage.jsx"),
);

const SupplierPortalPage = lazy(() => import("./pages/SupplierPortalPage.jsx"));
const AdminSupplierOnboardingPage = lazy(() => import("./pages/AdminSupplierOnboardingPage.jsx"));
const supplierPortalEnabled = import.meta.env.VITE_SUPPLIER_PORTAL_ENABLED === "true";

const AdminKitsPage = lazy(
  () => import("./pages/AdminKitsPage.jsx"),
);

const AdminPackingLocationsPage = lazy(
  () =>
    import("./pages/AdminPackingLocationsPage.jsx"),
);

const AdminShippingProfilesPage = lazy(
  () =>
    import("./pages/AdminShippingProfilesPage.jsx"),
);

const AdminPackagePlansPage = lazy(
  () =>
    import("./pages/AdminPackagePlansPage.jsx"),
);

const AdminKitPreviewPage = lazy(
  () => import("./pages/AdminKitPreviewPage.jsx"),
);

const AdminShippingSettingsPage = lazy(
  () =>
    import("./pages/AdminShippingSettingsPage.jsx"),
);

const AdminCartAddonSettingsPage = lazy(
  () =>
    import("./pages/AdminCartAddonSettingsPage.jsx"),
);

const StoreConsolePage = import.meta.env.DEV
  ? lazy(
      () => import("./pages/StoreConsolePage.jsx"),
    )
  : null;

function SessionError() {
  const {
    authError,
    retrySession,
  } = useAuth();

  return (
    <div className="page narrow">
      <h1>Unable to verify your account</h1>

      <p
        className="error-box"
        role="alert"
      >
        {authError}
      </p>

      <button
        type="button"
        className="button"
        onClick={retrySession}
      >
        Try again
      </button>
    </div>
  );
}

function AccountRequired({ children }) {
  const {
    user,
    loading,
    authError,
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return <PageLoading />;
  }

  if (authError) {
    return <SessionError />;
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(
          location.pathname + location.search,
        )}`}
        replace
      />
    );
  }

  return children;
}

function AdminRequired({ children }) {
  const {
    user,
    loading,
    authError,
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return <PageLoading />;
  }

  if (authError) {
    return <SessionError />;
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(
          location.pathname + location.search,
        )}`}
        replace
      />
    );
  }

  if (user.role !== "admin") {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}

function LegacyLoginRedirect() {
  const { search } = useLocation();

  const next =
    new URLSearchParams(search).get("next");

  return (
    <Navigate
      to={
        next
          ? `/login?next=${encodeURIComponent(
              next,
            )}`
          : "/login"
      }
      replace
    />
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, [pathname]);

  return null;
}

function CheckoutHeader() {
  return (
    <header
      aria-label="GymDrobe checkout"
      className="premium-checkout-header"
      style={{
        background: "#fff",
        borderBottom:
          "1px solid #e5e7eb",
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
          GYM
          <span
            style={{
              color: "#c2410c",
            }}
          >
            DROBE
          </span>
        </Link>

        <Link
          to="/cart"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "44px",
            padding: "0 14px",
            border:
              "1px solid #d1d5db",
            borderRadius: "6px",
            color: "#111827",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <span aria-hidden="true">
            ←&nbsp;
          </span>

          Back to bag
        </Link>
      </div>
    </header>
  );
}

function Layout() {
  const {
    cart,
    wishlist,
    toast,
    closeToast,
  } = useStore();

  const { user } = useAuth();

  const location = useLocation();

  const accountKey =
    user?.id ||
    user?._id ||
    "guest";

  const analyticsCartKey = JSON.stringify(
    cart.map((item) => [
      item.id,
      item.quantity,
      item.price,
    ]),
  );

  useEffect(() => {
    const path =
      location.pathname.replace(
        /\/+$/,
        "",
      ) || "/";

    if (
      path !== "/cart" ||
      !cart.length
    ) {
      return;
    }

    const track = () =>
      trackOnce(
        `cart:${analyticsVisitKey()}`,
        "view_cart",
        commercePayload(cart),
      );

    track();

    window.addEventListener(
      "gymdrobe-analytics-ready",
      track,
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-analytics-ready",
        track,
      );
    };
  }, [
    location.pathname,
    analyticsCartKey,
  ]);

  const currentPath =
    location.pathname.replace(
      /\/+$/,
      "",
    ) || "/";

  const isCheckout =
    currentPath === "/checkout";

  const isRecovery =
    currentPath === "/forgot-password" ||
    currentPath === "/reset-password";

  const internal = currentPath.startsWith("/admin") || currentPath.startsWith("/supplier") || currentPath.startsWith("/dev");

  return (
    <div className={internal ? "internal-workspace" : `premium-storefront${currentPath === "/" ? " storefront-home" : ""}${isCheckout ? " storefront-checkout" : ""}`}>
      <a
        className="skip-link"
        href="#main-content"
      >
        Skip to content
      </a>

      <ScrollToTop />
      <SEOController />

      {isCheckout ? (
        <CheckoutHeader />
      ) : (
        <>
          <Navbar
            cartCount={cart.reduce(
              (total, item) =>
                total +
                Number(item.quantity || 0),
              0,
            )}
            wishlistCount={
              wishlist.length
            }
          />

          <StoreUtilityBar />

          {user?.role === "admin" && (
            <nav
              aria-label="Admin quick access"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "20px",
                padding: "12px 20px",
                background: "#f3f4f6",
              }}
            >
              <Link
                className="text-link"
                to="/admin"
              >
                Admin dashboard
              </Link>

              <Link
                className="text-link"
                to="/admin/customers"
              >
                Customers
              </Link>

              <Link
                className="text-link"
                to="/admin/suppliers"
              >
                Suppliers
              </Link>

              <Link
                className="text-link"
                to="/admin/kits"
              >
                Fitness Kits
              </Link>

              <Link
                className="text-link"
                to="/admin/kits/preview"
              >
                Kit price preview
              </Link>

              <Link
                className="text-link"
                to="/admin/packing-locations"
              >
                Packing locations
              </Link>

              <Link
                className="text-link"
                to="/admin/shipping-profiles"
              >
                Shipping profiles
              </Link>

              <Link
                className="text-link"
                to="/admin/shipping-settings"
              >
                Free shipping offer
              </Link>

              <Link
                className="text-link"
                to="/admin/cart-addons"
              >
                Cart add-ons
              </Link>

              <Link
                className="text-link"
                to="/admin/package-plans"
              >
                Package plans
              </Link>
            </nav>
          )}
        </>
      )}

      <DeferredFitnessGuide />

      <main
        id="main-content"
        className="gd-storefront"
        tabIndex={-1}
      >
        <ErrorBoundary
          key={location.pathname}
        >
          <Suspense
            fallback={<PageLoading />}
          >
            <Routes>
              <Route
                path="/"
                element={<Home />}
              />

              {[
                ["/shop", Shop],
                [
                  "/product/:id",
                  ProductPage,
                ],
                [
                  "/kits",
                  FitnessKitsPage,
                ],
                [
                  "/kits/:kitId",
                  FitnessKitsPage,
                ],
                [
                  "/cart",
                  CartPage,
                ],
                [
                  "/wishlist",
                  WishlistPage,
                ],
                [
                  "/login",
                  LoginPage,
                ],
                [
                  "/compare",
                  ComparePage,
                ],
                [
                  "/saved",
                  SavedPage,
                ],
                [
                  "/notifications",
                  NotificationsPage,
                ],
                [
                  "/offers",
                  OffersPage,
                ],
                [
                  "/order-success",
                  OrderSuccessPage,
                ],
                [
                  "/orders",
                  OrdersPage,
                ],
                [
                  "/orders/:orderId",
                  OrderDetailsPage,
                ],
                [
                  "/orders/:orderId/track",
                  OrderTrackingPage,
                ],
                [
                  "/orders/:orderId/receipt",
                  ReceiptPage,
                ],
              ].map(([path, Page]) => (
                <Route
                  key={path}
                  path={path}
                  element={<Page />}
                />
              ))}

              <Route
                path="/checkout"
                element={
                  <CheckoutPage
                    key={accountKey}
                  />
                }
              />

              <Route
                path="/help"
                element={
                  <HelpPage
                    key={accountKey}
                  />
                }
              />

              <Route
                path="/orders/:orderId/return"
                element={
                  <ReturnPage
                    key={accountKey}
                  />
                }
              />

              {[
                "/signup",
                "/forgot-password",
                "/reset-password",
              ].map((path) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <LegacyLoginRedirect />
                  }
                />
              ))}

              {[
                ...(supplierPortalEnabled ? [["/supplier", SupplierPortalPage]] : []),
                [
                  "/account",
                  AccountPage,
                ],
                [
                  "/account/security",
                  SecurityPage,
                ],
                [
                  "/addresses",
                  AddressesPage,
                ],
              ].map(([path, Page]) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <AccountRequired>
                      <Page
                        key={accountKey}
                      />
                    </AccountRequired>
                  }
                />
              ))}

              {[
                ...(supplierPortalEnabled ? [["/admin/supplier-onboarding", AdminSupplierOnboardingPage]] : []),
                [
                  "/admin",
                  AdminDashboardPage,
                ],
                [
                  "/admin/customers",
                  AdminCustomersPage,
                ],
                [
                  "/admin/support",
                  AdminSupportPage,
                ],
                [
                  "/admin/orders",
                  AdminOrdersPage,
                ],
                [
                  "/admin/products",
                  AdminProductsPage,
                ],
                [
                  "/admin/returns",
                  AdminReturnsPage,
                ],
                [
                  "/admin/suppliers",
                  AdminSuppliersPage,
                ],
                [
                  "/admin/kits",
                  AdminKitsPage,
                ],
                [
                  "/admin/kits/preview",
                  AdminKitPreviewPage,
                ],
                [
                  "/admin/packing-locations",
                  AdminPackingLocationsPage,
                ],
                [
                  "/admin/shipping-profiles",
                  AdminShippingProfilesPage,
                ],
                [
                  "/admin/shipping-settings",
                  AdminShippingSettingsPage,
                ],
                [
                  "/admin/cart-addons",
                  AdminCartAddonSettingsPage,
                ],
                [
                  "/admin/package-plans",
                  AdminPackagePlansPage,
                ],
              ].map(([path, Page]) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <AdminRequired>
                      <Page
                        key={accountKey}
                      />
                    </AdminRequired>
                  }
                />
              ))}

              <Route
                path="/admin/dashboard"
                element={
                  <Navigate
                    to="/admin"
                    replace
                  />
                }
              />

              {import.meta.env.DEV &&
                StoreConsolePage && (
                  <Route
                    path="/dev/store"
                    element={
                      <StoreConsolePage />
                    }
                  />
                )}

              <Route
                path="*"
                element={
                  <EmptyState
                    title="This page isn’t in your wardrobe"
                    to="/"
                    label="Back to home"
                  >
                    The link may have changed.
                    Explore GymDrobe from the
                    homepage.
                  </EmptyState>
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {!isCheckout && <Footer />}

      {!isRecovery && (
        <AnalyticsController />
      )}

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={closeToast}
      />
    </div>
  );
}

function StorefrontApplication() {
  const { user } = useAuth();

  return (
    <StoreProvider
      key={
        user?.id ||
        user?._id ||
        "guest"
      }
    >
      <ShoppingToolsProvider>
        <Layout />
      </ShoppingToolsProvider>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CatalogProvider>
        <StorefrontApplication />
      </CatalogProvider>
    </BrowserRouter>
  );
}
