import {
  commercePayload,
  trackEvent,
} from "../utils/analytics.js";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useCatalog } from "./CatalogContext.jsx";
import { useAuth } from "./AuthContext.jsx";

import {
  getCartItemKey,
  normalizeCartItem,
  revalidateCart,
  validateCartItem,
} from "../utils/cartUtils.js";

import {
  readStorage,
  writeStorage,
} from "../utils/storage.js";

import {
  shoppingKey,
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";

import {
  resolveCoupon,
} from "../utils/orderCalculations.js";

const StoreContext = createContext(null);

// ======================================================
// STORAGE HELPERS
// ======================================================

function readArray(key) {
  const saved = readStorage(key, []);

  return Array.isArray(saved)
    ? saved.filter(Boolean)
    : [];
}

function readBuyNow(key) {
  const saved = readSession(key, []);

  return Array.isArray(saved)
    ? saved[0] || null
    : null;
}

function idsFor(value) {
  const values =
    value && typeof value === "object"
      ? [
          value.id,
          value._id,
          value.legacyId,
        ]
      : [value];

  return values
    .filter(
      (id) =>
        ["string", "number"].includes(
          typeof id,
        ) &&
        String(id).trim(),
    )
    .map(String);
}

function wishlistIds(rows) {
  return [
    ...new Set(
      (Array.isArray(rows) ? rows : [])
        .flatMap((item) =>
          idsFor(item).slice(0, 1),
        ),
    ),
  ];
}

function findProduct(products, value) {
  const ids = new Set(idsFor(value));

  return (
    Array.isArray(products) ? products : []
  ).find(
    (product) =>
      product &&
      idsFor(product).some((id) =>
        ids.has(id),
      ),
  );
}

function resolveWishlist(saved, products) {
  const ids = new Set(wishlistIds(saved));

  return (
    Array.isArray(products) ? products : []
  ).filter(
    (product) =>
      product &&
      product.isActive !== false &&
      idsFor(product).some((id) =>
        ids.has(id),
      ),
  );
}

function sameValue(a, b) {
  try {
    return (
      JSON.stringify(a) === JSON.stringify(b)
    );
  } catch {
    return false;
  }
}

// Each account has its own temporary memory.
// Failed saves cannot carry into another account.
function makeMemory() {
  return {
    cart: [],
    wishlist: [],
    coupon: null,
    buyNow: null,

    cartMemory: false,
    wishlistMemory: false,
    couponMemory: false,
    buyNowMemory: false,
  };
}

// ======================================================
// SHARED STOCK VALIDATION
// ======================================================

function validateBagQuantity(
  product,
  quantity,
  size,
  color,
  rows,
  replacingKey,
) {
  const result = validateCartItem(
    product,
    quantity,
    size,
    color,
  );

  if (!result.valid) {
    return result;
  }

  const hasVariantInventory =
    product.variants &&
    typeof product.variants === "object" &&
    !Array.isArray(product.variants) &&
    Object.keys(product.variants).length > 0;

  if (hasVariantInventory) {
    return result;
  }

  // Without variant inventory, all options use the
  // same product.stock quantity.
  const ids = new Set(idsFor(product));

  const otherQuantity = rows.reduce(
    (sum, row) => {
      if (
        !row ||
        getCartItemKey(row) === replacingKey ||
        !idsFor(row).some((id) => ids.has(id))
      ) {
        return sum;
      }

      return sum + Number(row.quantity || 0);
    },
    0,
  );

  const remaining = Math.max(
    0,
    result.stock - otherQuantity,
  );

  if (Number(quantity) > remaining) {
    return {
      valid: false,
      stock: result.stock,
      message:
        `Only ${remaining} available for this selection after the other options in your bag.`,
    };
  }

  return result;
}

// ======================================================
// SHOPPING ANALYTICS
// ======================================================

function trackShopping(name, rows) {
  try {
    trackEvent(
      name,
      commercePayload(rows),
    );
  } catch {
    // Analytics must not interrupt shopping.
  }
}

// ======================================================
// STORE PROVIDER
// ======================================================

export default function StoreProvider({
  children,
}) {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const memoryByScope = useRef(new Map());

  const keys = {
    cart: shoppingKey(
      "gymdrobe-cart",
      user,
    ),

    wishlist: shoppingKey(
      "gymdrobe-wishlist",
      user,
    ),

    coupon: shoppingKey(
      "gymdrobe-coupon",
      user,
    ),

    buyNow: shoppingKey(
      "gymdrobe-buy-now",
      user,
    ),
  };

  const scope = JSON.stringify([
    keys.cart,
    keys.wishlist,
    keys.coupon,
    keys.buyNow,
  ]);

  if (!memoryByScope.current.has(scope)) {
    memoryByScope.current.set(
      scope,
      makeMemory(),
    );
  }

  // Changing accounts creates fresh displayed state.
  // Unsaved data remains attached to its original scope.
  return (
    <ScopedStoreProvider
      key={scope}
      user={user}
      authLoading={Boolean(authLoading)}
      keys={keys}
      memory={memoryByScope.current.get(scope)}
    >
      {children}
    </ScopedStoreProvider>
  );
}

// ======================================================
// ACCOUNT-SPECIFIC STORE
// ======================================================

function ScopedStoreProvider({
  children,
  user,
  authLoading,
  keys,
  memory,
}) {
  const {
    products,
    loading,
    loaded,
    error,
    getLatestProducts,
  } = useCatalog();

  const cartKey = keys.cart;
  const wishlistKey = keys.wishlist;
  const couponKey = keys.coupon;
  const buyNowKey = keys.buyNow;

  const catalogReady =
    !loading &&
    !error &&
    loaded !== false &&
    Array.isArray(products);

  const mounted = useRef(true);

  const [cart, setCartState] = useState(() => {
    const value = memory.cartMemory
      ? memory.cart
      : readArray(cartKey);

    memory.cart = value;

    return value;
  });

  const [
    savedWishlist,
    setWishlistState,
  ] = useState(() => {
    const value = memory.wishlistMemory
      ? memory.wishlist
      : wishlistIds(readArray(wishlistKey));

    memory.wishlist = value;

    return value;
  });

  const [coupon, setCouponState] = useState(
    () => {
      const value = memory.couponMemory
        ? memory.coupon
        : resolveCoupon(
            readStorage(couponKey, null),
          );

      memory.coupon = value;

      return value;
    },
  );

  const [
    buyNowItem,
    setBuyNowItem,
  ] = useState(() => {
    const value = memory.buyNowMemory
      ? memory.buyNow
      : readBuyNow(buyNowKey);

    memory.buyNow = value;

    return value;
  });

  const [toast, setToast] = useState(null);
  const toastId = useRef(0);

  const wishlist = useMemo(
    () =>
      resolveWishlist(
        savedWishlist,
        products,
      ),
    [savedWishlist, products],
  );

  // ====================================================
  // NOTIFICATIONS
  // ====================================================

  const notify = useCallback(
    (message, type = "success") => {
      if (!mounted.current) {
        return;
      }

      setToast({
        message,
        type,
        id: ++toastId.current,
      });
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(
      () => setToast(null),
      4500,
    );

    return () => clearTimeout(timer);
  }, [toast?.id]);

  // ====================================================
  // CURRENT CATALOGUE / ACCOUNT GUARDS
  // ====================================================

  const latestProducts = useCallback(() => {
    const value =
      typeof getLatestProducts === "function"
        ? getLatestProducts()
        : products;

    return Array.isArray(value)
      ? value
      : null;
  }, [getLatestProducts, products]);

  const accountAvailable = useCallback(() => {
    // Ignore callbacks belonging to an old account.
    if (!mounted.current) {
      return false;
    }

    if (authLoading) {
      notify(
        "Checking your account. Please wait a moment.",
        "info",
      );

      return false;
    }

    return true;
  }, [authLoading, notify]);

  const requireCatalog = useCallback(() => {
    if (!accountAvailable()) {
      return false;
    }

    if (
      catalogReady &&
      latestProducts() !== null
    ) {
      return true;
    }

    notify(
      error
        ? "Products could not be loaded. Please retry before changing your bag."
        : "Products are loading. Please wait a moment.",
      error ? "error" : "info",
    );

    return false;
  }, [
    accountAvailable,
    catalogReady,
    latestProducts,
    error,
    notify,
  ]);

  // ====================================================
  // READ / SAVE BAG
  // ====================================================

  const rawCart = useCallback(() => {
    if (!mounted.current) {
      return [];
    }

    return memory.cartMemory
      ? memory.cart
      : readArray(cartKey);
  }, [memory, cartKey]);

  const latestCart = useCallback(() => {
    const rows = rawCart();
    const catalogue = latestProducts();

    if (
      catalogReady &&
      catalogue !== null
    ) {
      return revalidateCart(
        rows,
        catalogue,
      ).cart;
    }

    return rows;
  }, [
    rawCart,
    catalogReady,
    latestProducts,
  ]);

  const commitCart = useCallback(
    (next) => {
      if (!accountAvailable()) {
        return false;
      }

      const saved = writeStorage(
        cartKey,
        next,
      );

      memory.cart = next;
      memory.cartMemory = !saved;

      setCartState(next);

      if (!saved) {
        notify(
          "Bag updated for this visit. Browser storage is unavailable.",
          "warning",
        );
      }

      return saved;
    },
    [
      accountAvailable,
      cartKey,
      memory,
      notify,
    ],
  );

  // ====================================================
  // BUY NOW STORAGE
  // ====================================================

  const refreshBuyNow = useCallback(
    (item) => {
      if (!accountAvailable()) {
        return false;
      }

      const next = item || null;

      const saved = writeSession(
        buyNowKey,
        next ? [next] : [],
      );

      memory.buyNow = next;
      memory.buyNowMemory = !saved;

      setBuyNowItem(next);

      if (!saved) {
        notify(
          "Buy Now updated for this visit. Browser session storage is unavailable.",
          "warning",
        );
      }

      return saved;
    },
    [
      accountAvailable,
      buyNowKey,
      memory,
      notify,
    ],
  );

  const clearBuyNow = useCallback(
    () => refreshBuyNow(null),
    [refreshBuyNow],
  );

  // ====================================================
  // RECONCILE WITH A SUCCESSFUL CATALOGUE RESPONSE
  // ====================================================

  useEffect(() => {
    if (
      authLoading ||
      !catalogReady
    ) {
      return;
    }

    const savedCart = rawCart();

    const checked = revalidateCart(
      savedCart,
      products,
    );

    memory.cart = checked.cart;
    setCartState(checked.cart);

    if (
      !sameValue(savedCart, checked.cart)
    ) {
      const saved = commitCart(
        checked.cart,
      );

      if (
        saved &&
        checked.changes.length
      ) {
        notify(
          "Your bag was updated to current prices and available stock.",
          "info",
        );
      }
    }

    const savedBuyNow = memory.buyNowMemory
      ? memory.buyNow
      : readBuyNow(buyNowKey);

    const nextBuyNow = savedBuyNow
      ? revalidateCart(
          [savedBuyNow],
          products,
        ).cart[0] || null
      : null;

    memory.buyNow = nextBuyNow;
    setBuyNowItem(nextBuyNow);

    if (
      !sameValue(savedBuyNow, nextBuyNow)
    ) {
      refreshBuyNow(nextBuyNow);
    }
  }, [
    authLoading,
    catalogReady,
    products,
    rawCart,
    commitCart,
    refreshBuyNow,
    buyNowKey,
    memory,
    notify,
  ]);

  // ====================================================
  // SYNC LOCAL STORAGE CHANGES FROM OTHER TABS
  //
  // Synchronization does not send shopping events.
  // Unsaved changes stay in this account's memory.
  // ====================================================

  useEffect(() => {
    function sync(event) {
      if (
        !mounted.current ||
        authLoading
      ) {
        return;
      }

      if (
        event.storageArea &&
        event.storageArea !==
          window.localStorage
      ) {
        return;
      }

      if (
        (event.key === cartKey ||
          event.key === null) &&
        !memory.cartMemory
      ) {
        const rows = readArray(cartKey);
        const catalogue = latestProducts();

        const checked =
          catalogReady &&
          catalogue !== null
            ? revalidateCart(
                rows,
                catalogue,
              )
            : {
                cart: rows,
                changes: [],
              };

        memory.cart = checked.cart;
        setCartState(checked.cart);

        if (
          !sameValue(rows, checked.cart)
        ) {
          commitCart(checked.cart);
        }
      }

      if (
        (event.key === wishlistKey ||
          event.key === null) &&
        !memory.wishlistMemory
      ) {
        const next = wishlistIds(
          readArray(wishlistKey),
        );

        memory.wishlist = next;
        setWishlistState(next);
      }

      if (
        (event.key === couponKey ||
          event.key === null) &&
        !memory.couponMemory
      ) {
        const next = resolveCoupon(
          readStorage(couponKey, null),
        );

        memory.coupon = next;
        setCouponState(next);
      }
    }

    window.addEventListener(
      "storage",
      sync,
    );

    return () => {
      window.removeEventListener(
        "storage",
        sync,
      );
    };
  }, [
    authLoading,
    cartKey,
    wishlistKey,
    couponKey,
    catalogReady,
    latestProducts,
    commitCart,
    memory,
  ]);

  // ====================================================
  // REPLACE / UPDATE BAG
  // ====================================================

  function setCart(value) {
    if (!requireCatalog()) {
      return false;
    }

    const next =
      typeof value === "function"
        ? value(latestCart())
        : value;

    if (!Array.isArray(next)) {
      notify(
        "Your bag could not be updated. Please retry.",
        "error",
      );

      return false;
    }

    const checked = revalidateCart(
      next,
      latestProducts(),
    );

    const saved = commitCart(
      checked.cart,
    );

    if (
      saved &&
      checked.changes.length
    ) {
      notify(
        "Your bag was updated to current prices and available stock.",
        "info",
      );
    }

    return saved;
  }

  // ====================================================
  // ADD TO BAG
  // ====================================================

  function addToCart(
    product,
    quantity = 1,
    size = null,
    color = null,
  ) {
    if (!requireCatalog()) {
      return false;
    }

    const canonical = findProduct(
      latestProducts(),
      product,
    );

    const basic = validateCartItem(
      canonical,
      quantity,
      size,
      color,
    );

    if (!basic.valid) {
      notify(basic.message, "error");
      return false;
    }

    const rows = latestCart();

    const preview = normalizeCartItem(
      canonical,
      Number(quantity),
      size,
      color,
    );

    const itemKey = getCartItemKey(
      preview,
    );

    const existing = rows.find(
      (row) =>
        getCartItemKey(row) === itemKey,
    );

    const total =
      Number(quantity) +
      Number(existing?.quantity || 0);

    const check = validateBagQuantity(
      canonical,
      total,
      size,
      color,
      rows,
      itemKey,
    );

    if (!check.valid) {
      notify(check.message, "error");
      return false;
    }

    const item = normalizeCartItem(
      canonical,
      total,
      size,
      color,
    );

    const next = existing
      ? rows.map((row) =>
          getCartItemKey(row) === itemKey
            ? item
            : row,
        )
      : [...rows, item];

    const saved = commitCart(next);

    trackShopping(
      "add_to_cart",
      [
        {
          ...item,
          quantity: Number(quantity),
        },
      ],
    );

    if (saved) {
      notify("Added to your bag.");
    }

    // The action still succeeds for this visit
    // when browser storage is unavailable.
    return true;
  }

  // ====================================================
  // UPDATE QUANTITY
  // ====================================================

  function updateQuantity(
    itemKey,
    quantity,
  ) {
    if (!requireCatalog()) {
      return false;
    }

    const rows = latestCart();

    const row = rows.find(
      (item) =>
        getCartItemKey(item) === itemKey,
    );

    if (!row) {
      notify(
        "This bag item is no longer available.",
        "info",
      );

      return false;
    }

    const product = findProduct(
      latestProducts(),
      row,
    );

    const check = validateBagQuantity(
      product,
      quantity,
      row.selectedSize,
      row.selectedColor,
      rows,
      itemKey,
    );

    if (!check.valid) {
      notify(check.message, "error");
      return false;
    }

    const updated = normalizeCartItem(
      product,
      quantity,
      row.selectedSize,
      row.selectedColor,
    );

    commitCart(
      rows.map((item) =>
        getCartItemKey(item) === itemKey
          ? updated
          : item,
      ),
    );

    const difference =
      updated.quantity -
      Number(row.quantity);

    if (difference !== 0) {
      trackShopping(
        difference > 0
          ? "add_to_cart"
          : "remove_from_cart",
        [
          {
            ...updated,
            quantity: Math.abs(difference),
          },
        ],
      );
    }

    return true;
  }

  // ====================================================
  // REMOVE FROM BAG
  // ====================================================

  function removeFromCart(itemKey) {
    // Removal works even when the catalogue API fails.
    if (!accountAvailable()) {
      return false;
    }

    const rows = rawCart();

    const removed = rows.filter(
      (item) =>
        getCartItemKey(item) === itemKey,
    );

    if (!removed.length) {
      return false;
    }

    const saved = commitCart(
      rows.filter(
        (item) =>
          getCartItemKey(item) !== itemKey,
      ),
    );

    trackShopping(
      "remove_from_cart",
      removed,
    );

    if (saved) {
      notify(
        "Removed from your bag.",
        "info",
      );
    }

    return true;
  }

  // ====================================================
  // WISHLIST
  // ====================================================

  function toggleWishlist(product) {
    if (!requireCatalog()) {
      return false;
    }

    const canonical = findProduct(
      latestProducts(),
      product,
    );

    if (
      !canonical ||
      canonical.isActive === false
    ) {
      notify(
        "This product is no longer available.",
        "error",
      );

      return false;
    }

    const rows = memory.wishlistMemory
      ? memory.wishlist
      : wishlistIds(
          readArray(wishlistKey),
        );

    const ids = new Set(
      idsFor(canonical),
    );

    const exists = rows.some(
      (id) => ids.has(id),
    );

    const next = exists
      ? rows.filter(
          (id) => !ids.has(id),
        )
      : [
          ...rows,
          idsFor(canonical)[0],
        ];

    const saved = writeStorage(
      wishlistKey,
      next,
    );

    memory.wishlist = next;
    memory.wishlistMemory = !saved;

    setWishlistState(next);

    notify(
      saved
        ? exists
          ? "Removed from wishlist."
          : "Saved to wishlist."
        : "Wishlist updated for this visit. Browser storage is unavailable.",
      saved ? "success" : "warning",
    );

    return saved;
  }

  // ====================================================
  // COUPONS
  // ====================================================

  function setCoupon(value) {
    if (!accountAvailable()) {
      return false;
    }

    const next = resolveCoupon(value);

    const saved = writeStorage(
      couponKey,
      next ? { code: next.code } : null,
    );

    memory.coupon = next;
    memory.couponMemory = !saved;

    setCouponState(next);

    if (!saved) {
      notify(
        "Coupon updated for this visit. Browser storage is unavailable.",
        "warning",
      );
    }

    return saved;
  }

  // ====================================================
  // BUY NOW
  // ====================================================

  function buyNow(
    product,
    quantity = 1,
    size = null,
    color = null,
  ) {
    if (!requireCatalog()) {
      return false;
    }

    const canonical = findProduct(
      latestProducts(),
      product,
    );

    const result = validateCartItem(
      canonical,
      quantity,
      size,
      color,
    );

    if (!result.valid) {
      notify(result.message, "error");
      return false;
    }

    refreshBuyNow(
      normalizeCartItem(
        canonical,
        quantity,
        size,
        color,
      ),
    );

    return true;
  }

  // ====================================================
  // CONTEXT VALUE
  // ====================================================

  return (
    <StoreContext.Provider
      value={{
        cart,
        setCart,
        addToCart,
        updateQuantity,
        removeFromCart,

        wishlist,
        toggleWishlist,

        coupon,
        setCoupon,

        buyNowItem,
        buyNow,
        clearBuyNow,
        refreshBuyNow,

        notify,
        toast,

        closeToast: () => setToast(null),

        shoppingKey: (name) =>
          shoppingKey(name, user),

        latestCart,
        catalogReady,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

// ======================================================
// STORE HOOK
// ======================================================

export function useStore() {
  const value = useContext(StoreContext);

  if (!value) {
    throw new Error(
      "StoreProvider is missing.",
    );
  }

  return value;
}