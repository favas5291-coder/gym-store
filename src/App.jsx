import {
  lazy,
  Suspense,
  useEffect,
} from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "./context/AuthContext.jsx";

import StoreProvider, {
  useStore,
} from "./context/StoreContext.jsx";

import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Toast from "./components/Toast.jsx";
import EmptyState from "./components/EmptyState.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Home from "./pages/Home.jsx";

import CatalogProvider from "./context/CatalogContext.jsx";

import ShoppingToolsProvider from "./context/ShoppingToolsContext.jsx";

import StoreUtilityBar from "./components/StoreUtilityBar.jsx";

import PageLoading from "./components/PageLoading.jsx";


// ======================================================
// LAZY PAGES
// ======================================================

const Shop =
  lazy(
    () =>
      import(
        "./pages/Shop.jsx"
      )
  );


const ProductPage =
  lazy(
    () =>
      import(
        "./pages/ProductPage.jsx"
      )
  );


const CartPage =
  lazy(
    () =>
      import(
        "./pages/CartPage.jsx"
      )
  );


const WishlistPage =
  lazy(
    () =>
      import(
        "./pages/WishlistPage.jsx"
      )
  );


const CheckoutPage =
  lazy(
    () =>
      import(
        "./pages/CheckoutPage.jsx"
      )
  );


const LoginPage =
  lazy(
    () =>
      import(
        "./pages/LoginPage.jsx"
      )
  );


const SignupPage =
  lazy(
    () =>
      import(
        "./pages/SignupPage.jsx"
      )
  );


const AccountPage =
  lazy(
    () =>
      import(
        "./pages/AccountPage.jsx"
      )
  );


const AddressesPage =
  lazy(
    () =>
      import(
        "./pages/AddressesPage.jsx"
      )
  );


const OrderSuccessPage =
  lazy(
    () =>
      import(
        "./pages/OrderSuccessPage.jsx"
      )
  );


const OrdersPage =
  lazy(
    () =>
      import(
        "./pages/OrdersPage.jsx"
      )
  );


const OrderDetailsPage =
  lazy(
    () =>
      import(
        "./pages/OrderDetailsPage.jsx"
      )
  );


const OrderTrackingPage =
  lazy(
    () =>
      import(
        "./pages/OrderTrackingPage.jsx"
      )
  );


const ComparePage =
  lazy(
    () =>
      import(
        "./pages/ComparePage.jsx"
      )
  );


const SavedPage =
  lazy(
    () =>
      import(
        "./pages/SavedPage.jsx"
      )
  );


const NotificationsPage =
  lazy(
    () =>
      import(
        "./pages/NotificationsPage.jsx"
      )
  );


const OffersPage =
  lazy(
    () =>
      import(
        "./pages/OffersPage.jsx"
      )
  );


const HelpPage =
  lazy(
    () =>
      import(
        "./pages/HelpPage.jsx"
      )
  );


const ReceiptPage =
  lazy(
    () =>
      import(
        "./pages/ReceiptPage.jsx"
      )
  );


const ReturnPage =
  lazy(
    () =>
      import(
        "./pages/ReturnPage.jsx"
      )
  );


const SecurityPage =
  lazy(
    () =>
      import(
        "./pages/SecurityPage.jsx"
      )
  );


// ======================================================
// ADMIN PAGES
// ======================================================

const AdminOrdersPage =
  lazy(
    () =>
      import(
        "./pages/AdminOrdersPage.jsx"
      )
  );


const AdminProductsPage =
  lazy(
    () =>
      import(
        "./pages/AdminProductsPage.jsx"
      )
  );


const AdminReturnsPage =
  lazy(
    () =>
      import(
        "./pages/AdminReturnsPage.jsx"
      )
  );


// ======================================================
// DEV PAGE
// ======================================================

const StoreConsolePage =
  import.meta.env.DEV
    ? lazy(
        () =>
          import(
            "./pages/StoreConsolePage.jsx"
          )
      )
    : null;


// ======================================================
// ACCOUNT REQUIRED
// ======================================================

function AccountRequired({
  children,
}) {
  const {
    user,
  } = useAuth();


  const location =
    useLocation();


  return user ? (
    children
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(
        location.pathname +
          location.search
      )}`}
      replace
    />
  );
}


// ======================================================
// ADMIN REQUIRED
// ======================================================

function AdminRequired({
  children,
}) {
  const {
    user,
  } = useAuth();


  const location =
    useLocation();


  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(
          location.pathname +
            location.search
        )}`}
        replace
      />
    );
  }


  if (
    user.role !==
    "admin"
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  return children;
}


// ======================================================
// SCROLL + PAGE TITLE
// ======================================================

function ScrollAndTitle() {
  const {
    pathname,
  } = useLocation();


  useEffect(
    () => {
      window.scrollTo({
        top: 0,
        behavior:
          "instant",
      });


      const names = {
        "/":
          "Everything for Every Workout",

        "/shop":
          "Shop",

        "/cart":
          "Shopping bag",

        "/wishlist":
          "Wishlist",

        "/checkout":
          "Checkout",

        "/login":
          "Login",

        "/signup":
          "Create account",

        "/account":
          "My account",

        "/orders":
          "My orders",

        "/addresses":
          "Saved addresses",

        "/offers":
          "Offers & coupons",

        "/compare":
          "Compare products",

        "/saved":
          "Saved for later",

        "/help":
          "Shopping help",

        "/notifications":
          "Price & stock watches",

        "/account/security":
          "Password & account data",

        "/admin/orders":
          "Admin orders",

        "/admin/products":
          "Admin products & inventory",

        "/admin/returns":
          "Admin returns & exchanges",

        "/dev/store":
          "Development store console",
      };


      document.title =
        `GymDrobe | ${
          names[
            pathname
          ] ||
          "Your workout essentials"
        }`;
    },

    [
      pathname,
    ]
  );


  return null;
}


// ======================================================
// LAYOUT
// ======================================================

function Layout() {
  const {
    cart,
    wishlist,
    toast,
    closeToast,
  } = useStore();


  const {
    user,
  } = useAuth();


  const location =
    useLocation();


  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
      >
        Skip to content
      </a>


      <ScrollAndTitle />


      <Navbar
        cartCount={
          cart.reduce(
            (
              total,
              item
            ) =>
              total +
              item.quantity,
            0
          )
        }
        wishlistCount={
          wishlist.length
        }
      />


      <StoreUtilityBar />


      <main
        id="main-content"
        className="gd-storefront"
        tabIndex="-1"
      >
        <ErrorBoundary
          key={
            location.pathname
          }
        >
          <Suspense
            fallback={
              <PageLoading />
            }
          >
            <Routes>
              {/* =========================================
                  HOME
              ========================================= */}

              <Route
                path="/"
                element={
                  <Home />
                }
              />


              {/* =========================================
                  SHOPPING TOOLS
              ========================================= */}

              <Route
                path="/compare"
                element={
                  <ComparePage />
                }
              />


              <Route
                path="/saved"
                element={
                  <SavedPage />
                }
              />


              <Route
                path="/notifications"
                element={
                  <NotificationsPage />
                }
              />


              <Route
                path="/offers"
                element={
                  <OffersPage />
                }
              />


              <Route
                path="/help"
                element={
                  <HelpPage
                    key={
                      user?.id ||
                      "guest"
                    }
                  />
                }
              />


              {/* =========================================
                  ACCOUNT
              ========================================= */}

              <Route
                path="/account/security"
                element={
                  <AccountRequired>
                    <SecurityPage
                      key={
                        user?.id
                      }
                    />
                  </AccountRequired>
                }
              />


              <Route
                path="/account"
                element={
                  <AccountRequired>
                    <AccountPage
                      key={
                        user?.id
                      }
                    />
                  </AccountRequired>
                }
              />


              <Route
                path="/addresses"
                element={
                  <AccountRequired>
                    <AddressesPage
                      key={
                        user?.id
                      }
                    />
                  </AccountRequired>
                }
              />


              {/* =========================================
                  ADMIN
              ========================================= */}

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


              {/* =========================================
                  ORDER RECEIPT
              ========================================= */}

              <Route
                path="/orders/:orderId/receipt"
                element={
                  <ReceiptPage />
                }
              />


              {/* =========================================
                  RETURN / EXCHANGE
              ========================================= */}

              <Route
                path="/orders/:orderId/return"
                element={
                  <ReturnPage
                    key={
                      user?.id ||
                      "guest"
                    }
                  />
                }
              />


              {/* =========================================
                  DEV STORE
              ========================================= */}

              {import.meta.env.DEV && (
                <Route
                  path="/dev/store"
                  element={
                    <StoreConsolePage />
                  }
                />
              )}


              {/* =========================================
                  STORE
              ========================================= */}

              <Route
                path="/shop"
                element={
                  <Shop />
                }
              />


              <Route
                path="/product/:id"
                element={
                  <ProductPage />
                }
              />


              <Route
                path="/cart"
                element={
                  <CartPage />
                }
              />


              <Route
                path="/wishlist"
                element={
                  <WishlistPage />
                }
              />


              {/* =========================================
                  CHECKOUT
              ========================================= */}

              <Route
                path="/checkout"
                element={
                  <CheckoutPage
                    key={
                      user?.id ||
                      "guest"
                    }
                  />
                }
              />


              {/* =========================================
                  AUTH
              ========================================= */}

              <Route
                path="/login"
                element={
                  <LoginPage />
                }
              />


              <Route
                path="/signup"
                element={
                  <SignupPage />
                }
              />


              {/* =========================================
                  ORDERS
              ========================================= */}

              <Route
                path="/order-success"
                element={
                  <OrderSuccessPage />
                }
              />


              <Route
                path="/orders"
                element={
                  <OrdersPage />
                }
              />


              <Route
                path="/orders/:orderId"
                element={
                  <OrderDetailsPage />
                }
              />


              <Route
                path="/orders/:orderId/track"
                element={
                  <OrderTrackingPage />
                }
              />


              {/* =========================================
                  NOT FOUND
              ========================================= */}

              <Route
                path="*"
                element={
                  <EmptyState
                    title="This page isn’t in your wardrobe"
                    to="/"
                    label="Back to home"
                  >
                    The link may have changed. Explore GymDrobe from the homepage.
                  </EmptyState>
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>


      <Footer />


      <Toast
        message={
          toast?.message
        }
        type={
          toast?.type
        }
        onClose={
          closeToast
        }
      />
    </>
  );
}


// ======================================================
// APP
// ======================================================

export default function App() {
  const {
    user,
  } = useAuth();


  return (
    <BrowserRouter>
      <CatalogProvider>
        <StoreProvider
          key={
            user?.id ||
            "guest"
          }
        >
          <ShoppingToolsProvider>
            <Layout />
          </ShoppingToolsProvider>
        </StoreProvider>
      </CatalogProvider>
    </BrowserRouter>
  );
}