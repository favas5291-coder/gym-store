import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext.jsx";

import {
  getTotalStock,
} from "../utils/cartUtils.js";

import {
  createProduct,
  getProducts,
  getProductPage,
  updateProduct,
} from "../services/productApi.js";

const CatalogContext = createContext(null);

const CATALOG_REFRESH_MS = 60000;
const FOCUS_REFRESH_MS = 15000;

function availabilityRoute(path) {
  return /^\/(?:checkout|order-success|orders|admin)(?:\/|$)/.test(
    path,
  );
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function objectValue(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value
    : {};
}

function normalizeProduct(product) {
  if (
    !product ||
    typeof product !== "object"
  ) {
    return null;
  }

  const id = product.id || product._id;

  if (!id) {
    return null;
  }

  return {
    ...product,

    id: String(id),
    _id: String(product._id || id),

    name: product.name || "",
    slug: product.slug || "",

    category: product.category || "",
    subcategory: product.subcategory || "",

    brand: product.brand || "GymDrobe",
    catalogueBrand: typeof product.brand === "string" ? product.brand.trim() : "",
    // Catalogue review: the public tumbler title and COITONIC brand disagree.
    brandNeedsReview: String(id) === "6ad26d85d8f991271e3d1fd3" &&
      /^cult\b/i.test(product.name || "") && /^coitonic$/i.test(product.brand || ""),
    gender: product.gender || "Unisex",

    price: numeric(product.price),
    discount: numeric(product.discount),
    stock: numeric(product.stock),

    rating: numeric(product.rating),
    reviewCount: numeric(product.reviewCount),

    sizes: Array.isArray(product.sizes)
      ? product.sizes.map(String)
      : [],

    colors: Array.isArray(product.colors)
      ? product.colors.map(String)
      : [],

    images: Array.isArray(product.images)
      ? product.images
      : [],

    tags: Array.isArray(product.tags)
      ? product.tags
      : [],

    highlights: Array.isArray(product.highlights)
      ? product.highlights
      : [],

    careInstructions: Array.isArray(
      product.careInstructions,
    )
      ? product.careInstructions
      : [],

    reviews: Array.isArray(product.reviews)
      ? product.reviews
      : [],

    variants: objectValue(product.variants),

    specifications: objectValue(
      product.specifications,
    ),

    delivery: objectValue(product.delivery),

    isFeatured: Boolean(product.isFeatured),
    isBestSeller: Boolean(product.isBestSeller),

    isNew: Boolean(
      product.isNew ?? product.isNewArrival,
    ),

    isActive: product.isActive !== false,
  };
}

function prepareForApi(product) {
  const {
    id,
    _id,
    createdAt,
    updatedAt,
    __v,
    isNew,
    stockStatus,
    totalStock,
    rating,
    reviewCount,
    ...productData
  } = product;

  const reviews = Array.isArray(product.reviews)
    ? product.reviews.map((review) => {
        const {
          _id,
          createdAt,
          updatedAt,
          __v,
          ...reviewData
        } = review;

        return reviewData;
      })
    : [];

  return {
    ...productData,

    isNewArrival: Boolean(
      isNew ?? product.isNewArrival,
    ),

    reviews,
  };
}

function validateProduct(product) {
  if (
    !product ||
    !String(product.name || "").trim()
  ) {
    return false;
  }

  if (
    product.price == null ||
    product.price === "" ||
    !Number.isFinite(Number(product.price)) ||
    Number(product.price) < 0
  ) {
    return false;
  }

  const discount = Number(
    product.discount ?? 0,
  );

  if (
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount > 100
  ) {
    return false;
  }

  function stockValid(value) {
    if (Array.isArray(value)) {
      return false;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      return Object.values(value).every(
        stockValid,
      );
    }

    return (
      value != null &&
      value !== "" &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= 0
    );
  }

  const variants = product.variants;

  if (
    variants != null &&
    (
      typeof variants !== "object" ||
      Array.isArray(variants)
    )
  ) {
    return false;
  }

  return variants &&
    Object.keys(variants).length
    ? stockValid(variants)
    : stockValid(product.stock ?? 0);
}

export default function CatalogProvider({
  children,
}) {
  const { user, token } = useAuth();
  const { pathname } = useLocation();
  // These workspaces load their own authoritative records and options.
  const separateCatalogue = /^\/supplier(?:\/|$)|^\/admin\/marketplace(?:\/|$)/.test(pathname);

  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");

  const productsRef = useRef([]);
  const mounted = useRef(false);

  const requestVersion = useRef(0);
  const inFlight = useRef(null);

  const loadedRef = useRef(false);
  const lastRefresh = useRef(0);
  const previousPath = useRef(null);
  const preview = useRef(null);
  const [homeProducts, setHomeProducts] = useState([]);

  const saveLock = useRef(false);

  const session =
    `${user?.id || user?._id || "guest"}:${token || ""}:${user?.role || ""}`;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  // A partial homepage catalogue may suggest categories, but must never
  // reconcile a cart, mark a wishlist item unavailable or validate a price.
  const firstPage = useCallback(() => {
    if (!preview.current) {
      const pending = getProductPage().then(page => {
        if (mounted.current && preview.current === pending && !loadedRef.current) {
          setHomeProducts(page.products.map(normalizeProduct).filter(product => product?.isActive));
        }
        return page;
      }).catch(failure => {
        if (preview.current === pending) preview.current = null;
        throw failure;
      });
      preview.current = pending;
    }
    return preview.current;
  }, []);

  const refreshProducts = useCallback((continuePreview = false) => {
    // Share a running request instead of starting
    // duplicate catalogue requests.
    if (
      inFlight.current?.version ===
      requestVersion.current
    ) {
      return inFlight.current.promise;
    }

    const version =
      ++requestVersion.current;

    if (mounted.current) {
      // Loading blocks the page only before the
      // first successful catalogue response.
      setLoading(!loadedRef.current);

      setRefreshing(loadedRef.current);
      setError("");
    }

    const promise = (async () => {
      try {
        let data;
        if (continuePreview === true && !loadedRef.current) {
          let page = await firstPage();
          data = [...page.products];
          let previous = "";
          while (page.nextCursor) {
            if (page.nextCursor <= previous) throw new Error("Catalogue changed. Please retry.");
            previous = page.nextCursor;
            page = await getProductPage(previous);
            data.push(...page.products);
          }
        } else {
          data = await getProducts();
        }

        if (!Array.isArray(data)) {
          throw new Error(
            "The catalog response was invalid. Please retry.",
          );
        }

        const next = data
          .map(normalizeProduct)
          .filter(
            (product) =>
              product &&
              product.isActive,
          );

        if (
          !mounted.current ||
          version !== requestVersion.current
        ) {
          return productsRef.current;
        }

        productsRef.current = next;
        loadedRef.current = true;
        preview.current = null;
        setHomeProducts([]);

        lastRefresh.current = Date.now();

        setProducts(next);
        setLoaded(true);

        return next;
      } catch (failure) {
        if (
          mounted.current &&
          version === requestVersion.current
        ) {
          setError(
            failure.message ||
              "Unable to load products.",
          );
        }

        // Preserve the previous successful
        // catalogue when the connection fails.
        return [];
      } finally {
        if (
          inFlight.current?.version === version
        ) {
          inFlight.current = null;
        }

        if (
          mounted.current &&
          version === requestVersion.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    inFlight.current = {
      version,
      promise,
    };

    return promise;
  }, [firstPage]);

  const ensureProducts = useCallback(() => {
    if (loadedRef.current || error) return Promise.resolve(productsRef.current);
    return refreshProducts(pathname === "/" || Boolean(preview.current));
  }, [pathname, refreshProducts, error]);

  const loadHomePreview = useCallback(() => {
    firstPage().then(page => {
      if (mounted.current && !loadedRef.current && page.nextCursor === null) {
        refreshProducts(true);
      }
    }).catch(failure => {
      if (mounted.current && !loadedRef.current && !inFlight.current) {
        setError(failure.message || "Unable to load products.");
        setLoading(false);
      }
    });
  }, [firstPage, refreshProducts]);

  useEffect(() => {
    const before = previousPath.current;

    previousPath.current = pathname;

    const changedRoute =
      before !== pathname;

    const needsRefresh =
      !loadedRef.current ||
      (
        changedRoute &&
        (
          availabilityRoute(before || "") ||
          availabilityRoute(pathname) ||
          Date.now() - lastRefresh.current >=
            CATALOG_REFRESH_MS
        )
      );

    if (!separateCatalogue && needsRefresh) {
      if (pathname === "/" && !loadedRef.current) loadHomePreview();
      else refreshProducts(Boolean(preview.current) && !availabilityRoute(pathname));
    }
  }, [pathname, separateCatalogue, refreshProducts, loadHomePreview]);

  useEffect(() => {
    if (separateCatalogue) return;
    let timer;

    function scheduleRefresh(event) {
      if (
        document.visibilityState === "hidden"
      ) {
        return;
      }

      const force =
        event?.type === "storage" ||
        event?.type === "online" ||
        event?.type ===
          "gymdrobe-orders-updated" ||
        event?.type ===
          "gymdrobe-catalog-updated";

      if (
        !force &&
        loadedRef.current &&
        Date.now() - lastRefresh.current <
          FOCUS_REFRESH_MS
      ) {
        return;
      }

      clearTimeout(timer);

      timer = setTimeout(() => {
        if (pathname === "/" && !loadedRef.current && !inFlight.current) {
          if (force) preview.current = null;
          loadHomePreview();
        } else refreshProducts();
      }, 150);
    }

    function syncStorage(event) {
      if (
        event.key === null ||
        event.key === "gymdrobe-orders" ||
        event.key ===
          "gymdrobe-catalog-updated"
      ) {
        scheduleRefresh(event);
      }
    }

    window.addEventListener(
      "gymdrobe-orders-updated",
      scheduleRefresh,
    );

    window.addEventListener(
      "gymdrobe-catalog-updated",
      scheduleRefresh,
    );

    window.addEventListener(
      "storage",
      syncStorage,
    );

    window.addEventListener(
      "focus",
      scheduleRefresh,
    );

    window.addEventListener(
      "online",
      scheduleRefresh,
    );

    document.addEventListener(
      "visibilitychange",
      scheduleRefresh,
    );

    const interval = setInterval(
      scheduleRefresh,
      CATALOG_REFRESH_MS,
    );

    return () => {
      clearTimeout(timer);
      clearInterval(interval);

      window.removeEventListener(
        "gymdrobe-orders-updated",
        scheduleRefresh,
      );

      window.removeEventListener(
        "gymdrobe-catalog-updated",
        scheduleRefresh,
      );

      window.removeEventListener(
        "storage",
        syncStorage,
      );

      window.removeEventListener(
        "focus",
        scheduleRefresh,
      );

      window.removeEventListener(
        "online",
        scheduleRefresh,
      );

      document.removeEventListener(
        "visibilitychange",
        scheduleRefresh,
      );
    };
  }, [pathname, refreshProducts, separateCatalogue, loadHomePreview]);

  const getLatestProducts = useCallback(
    () => productsRef.current,
    [],
  );

  const saveProduct = useCallback(
    async (product) => {
      if (saveLock.current) {
        return false;
      }

      if (
        !token ||
        user?.role !== "admin"
      ) {
        setSaveError(
          "Sign in with an admin account to save products.",
        );

        return false;
      }

      if (!validateProduct(product)) {
        setSaveError(
          "Check the product name, price, discount and whole-number stock quantities.",
        );

        return false;
      }

      const savingSession = session;

      saveLock.current = true;
      setSaveError("");

      try {
        const nextProduct =
          structuredClone(product);

        nextProduct.stock = getTotalStock({
          ...nextProduct,
          stockStatus: undefined,
        });

        const suppliedId =
          product._id || product.id;

        const existing =
          productsRef.current.find(
            (item) =>
              suppliedId &&
              (
                String(item.id) ===
                  String(suppliedId) ||
                String(item._id) ===
                  String(suppliedId)
              ),
          );

        const apiData =
          prepareForApi(nextProduct);

        const id =
          existing?._id ||
          existing?.id ||
          product._id ||
          (
            /^[a-f0-9]{24}$/i.test(
              String(suppliedId || ""),
            )
              ? suppliedId
              : null
          );

        const response = id
          ? await updateProduct(
              token,
              id,
              apiData,
            )
          : await createProduct(
              token,
              apiData,
            );

        const savedProduct =
          normalizeProduct(
            response?.product,
          );

        if (!savedProduct) {
          throw new Error(
            "The save response did not include a product. Refresh the admin list before retrying.",
          );
        }

        if (
          !mounted.current ||
          sessionRef.current !==
            savingSession
        ) {
          return false;
        }

        // An older catalogue response must not
        // replace this acknowledged update.
        requestVersion.current++;

        const current = productsRef.current;

        const exists = current.some(
          (item) =>
            String(item.id) ===
            String(savedProduct.id),
        );

        const next = (
          exists
            ? current.map((item) =>
                String(item.id) ===
                String(savedProduct.id)
                  ? savedProduct
                  : item,
              )
            : [...current, savedProduct]
        ).filter(
          (item) => item.isActive,
        );

        productsRef.current = next;

        setProducts(next);
        setLoading(false);

        // Refresh the complete public catalogue
        // after the save is acknowledged.
        await refreshProducts();

        return true;
      } catch (failure) {
        if (
          mounted.current &&
          sessionRef.current ===
            savingSession
        ) {
          setSaveError(
            failure.message ||
              "Unable to save the product.",
          );
        }

        return false;
      } finally {
        saveLock.current = false;
      }
    },
    [
      token,
      user?.role,
      session,
      refreshProducts,
    ],
  );

  const value = useMemo(
    () => ({
      products,
      homeProducts,
      ensureProducts,
      loading,
      loaded,
      refreshing,
      error,
      saveError,

      catalogReady:
        loaded && !loading && !error,

      saveProduct,
      refreshProducts,
      getLatestProducts,
    }),
    [
      products,
      homeProducts,
      ensureProducts,
      loading,
      loaded,
      refreshing,
      error,
      saveError,
      saveProduct,
      refreshProducts,
      getLatestProducts,
    ],
  );

  return (
    <CatalogContext.Provider value={value}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);

  if (!context) {
    throw new Error(
      "CatalogProvider is missing.",
    );
  }

  return context;
}