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
import { getTotalStock } from "../utils/cartUtils.js";
import {
  createProduct,
  getProducts,
  updateProduct,
} from "../services/productApi.js";

const CatalogContext = createContext(null);
function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
function normalizeProduct(product) {
  if (!product || typeof product !== "object") return null;
  const id = product.id || product._id;
  if (!id) return null;
  return {
    ...product,
    id: String(id),
    _id: String(product._id || id),
    name: product.name || "",
    slug: product.slug || "",
    category: product.category || "",
    subcategory: product.subcategory || "",
    brand: product.brand || "GymDrobe",
    gender: product.gender || "Unisex",
    price: numeric(product.price),
    discount: numeric(product.discount),
    stock: numeric(product.stock),
    rating: numeric(product.rating),
    reviewCount: numeric(product.reviewCount),
    sizes: Array.isArray(product.sizes) ? product.sizes.map(String) : [],
    colors: Array.isArray(product.colors) ? product.colors.map(String) : [],
    images: Array.isArray(product.images) ? product.images : [],
    tags: Array.isArray(product.tags) ? product.tags : [],
    highlights: Array.isArray(product.highlights) ? product.highlights : [],
    careInstructions: Array.isArray(product.careInstructions)
      ? product.careInstructions
      : [],
    reviews: Array.isArray(product.reviews) ? product.reviews : [],
    variants: objectValue(product.variants),
    specifications: objectValue(product.specifications),
    delivery: objectValue(product.delivery),
    isFeatured: Boolean(product.isFeatured),
    isBestSeller: Boolean(product.isBestSeller),
    isNew: Boolean(product.isNew ?? product.isNewArrival),
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
        const { _id, createdAt, updatedAt, __v, ...reviewData } = review;
        return reviewData;
      })
    : [];
  return {
    ...productData,
    isNewArrival: Boolean(isNew ?? product.isNewArrival),
    reviews,
  };
}
function validateProduct(product) {
  if (!product || !String(product.name || "").trim()) return false;
  if (
    product.price == null ||
    product.price === "" ||
    !Number.isFinite(Number(product.price)) ||
    Number(product.price) < 0
  )
    return false;
  const discount = Number(product.discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100)
    return false;
  function stockValid(value) {
    if (Array.isArray(value)) return false;
    if (value && typeof value === "object")
      return Object.values(value).every(stockValid);
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
    (typeof variants !== "object" || Array.isArray(variants))
  )
    return false;
  return variants && Object.keys(variants).length
    ? stockValid(variants)
    : stockValid(product.stock ?? 0);
}

export default function CatalogProvider({ children }) {
  const { user, token } = useAuth();
  const { pathname } = useLocation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const productsRef = useRef([]);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const saveLock = useRef(false);
  const session = `${user?.id || user?._id || "guest"}:${token || ""}:${user?.role || ""}`;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current++;
    };
  }, []);

  const refreshProducts = useCallback(async () => {
    const version = ++requestVersion.current;
    if (mounted.current) {
      setLoading(true);
      setError("");
    }
    try {
      const data = await getProducts();
      if (!Array.isArray(data))
        throw new Error("The catalog response was invalid. Please retry.");
      const next = data
        .map(normalizeProduct)
        .filter((product) => product && product.isActive);
      if (!mounted.current || version !== requestVersion.current)
        return productsRef.current;
      productsRef.current = next;
      setProducts(next);
      setLoaded(true);
      return next;
    } catch (failure) {
      if (mounted.current && version === requestVersion.current) {
        setError(failure.message || "Unable to load products.");
      }
      // Preserve the last successful catalog instead of emptying saved bags.
      return [];
    } finally {
      if (mounted.current && version === requestVersion.current)
        setLoading(false);
    }
  }, []);

  // A route change refreshes availability when leaving checkout or admin pages.
  useEffect(() => {
    refreshProducts();
  }, [pathname, refreshProducts]);

  useEffect(() => {
    let timer;
    function scheduleRefresh() {
      if (document.visibilityState === "hidden") return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        refreshProducts();
      }, 150);
    }
    function syncStorage(event) {
      if (
        event.key === null ||
        event.key === "gymdrobe-orders" ||
        event.key === "gymdrobe-catalog-updated"
      )
        scheduleRefresh();
    }
    window.addEventListener("gymdrobe-orders-updated", scheduleRefresh);
    window.addEventListener("gymdrobe-catalog-updated", scheduleRefresh);
    window.addEventListener("storage", syncStorage);
    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("online", scheduleRefresh);
    document.addEventListener("visibilitychange", scheduleRefresh);
    const interval = setInterval(scheduleRefresh, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("gymdrobe-orders-updated", scheduleRefresh);
      window.removeEventListener("gymdrobe-catalog-updated", scheduleRefresh);
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("online", scheduleRefresh);
      document.removeEventListener("visibilitychange", scheduleRefresh);
    };
  }, [refreshProducts]);

  const getLatestProducts = useCallback(() => productsRef.current, []);

  const saveProduct = useCallback(
    async (product) => {
      if (saveLock.current) return false;
      if (!token || user?.role !== "admin") {
        setSaveError("Sign in with an admin account to save products.");
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
        const nextProduct = structuredClone(product);
        // The entered stock is already available server stock. Add no local reservations.
        nextProduct.stock = getTotalStock({
          ...nextProduct,
          stockStatus: undefined,
        });
        const suppliedId = product._id || product.id;
        const existing = productsRef.current.find(
          (item) =>
            suppliedId &&
            (String(item.id) === String(suppliedId) ||
              String(item._id) === String(suppliedId)),
        );
        const apiData = prepareForApi(nextProduct);
        // Preserve update intent even when the product was archived or is absent from the public catalog.
        const id =
          existing?._id ||
          existing?.id ||
          product._id ||
          (/^[a-f0-9]{24}$/i.test(String(suppliedId || ""))
            ? suppliedId
            : null);
        const response = id
          ? await updateProduct(token, id, apiData)
          : await createProduct(token, apiData);
        const savedProduct = normalizeProduct(response?.product);
        if (!savedProduct)
          throw new Error(
            "The save response did not include a product. Refresh the admin list before retrying.",
          );
        if (!mounted.current || sessionRef.current !== savingSession)
          return false;
        // An older catalog request must not overwrite this acknowledged update.
        requestVersion.current++;
        const current = productsRef.current;
        const exists = current.some(
          (item) => String(item.id) === String(savedProduct.id),
        );
        const next = (
          exists
            ? current.map((item) =>
                String(item.id) === String(savedProduct.id)
                  ? savedProduct
                  : item,
              )
            : [...current, savedProduct]
        ).filter((item) => item.isActive);
        productsRef.current = next;
        setProducts(next);
        setLoading(false);
        // A single-product response does not establish that the whole catalog loaded.
        await refreshProducts();
        return true;
      } catch (failure) {
        if (mounted.current && sessionRef.current === savingSession)
          setSaveError(failure.message || "Unable to save the product.");
        return false;
      } finally {
        saveLock.current = false;
      }
    },
    [token, user?.role, session, refreshProducts],
  );

  const value = useMemo(
    () => ({
      products,
      loading,
      loaded,
      error,
      saveError,
      catalogReady: loaded && !loading && !error,
      saveProduct,
      refreshProducts,
      getLatestProducts,
    }),
    [
      products,
      loading,
      loaded,
      error,
      saveError,
      saveProduct,
      refreshProducts,
      getLatestProducts,
    ],
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("CatalogProvider is missing.");
  return context;
}
