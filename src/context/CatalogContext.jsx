import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  allOrders,
} from "../utils/customerData.js";

import {
  applyReservations,
  reservedQuantity,
} from "../utils/inventory.js";

import {
  getTotalStock,
} from "../utils/cartUtils.js";

import {
  createProduct,
  getProducts,
  updateProduct,
} from "../services/productApi.js";

const CatalogContext =
  createContext(null);


// ======================================================
// NORMALIZE MONGODB PRODUCT
// ======================================================

function normalizeProduct(product) {
  if (!product) {
    return null;
  }

  return {
    ...product,

    // Existing frontend expects product.id.
    // MongoDB gives us product._id.
    id:
      product.id ||
      product._id,

    _id:
      product._id ||
      product.id,

    name:
      product.name ||
      "",

    slug:
      product.slug ||
      "",

    category:
      product.category ||
      "",

    subcategory:
      product.subcategory ||
      "",

    brand:
      product.brand ||
      "GymDrobe",

    gender:
      product.gender ||
      "Unisex",

    price:
      Number(
        product.price ?? 0
      ),

    discount:
      Number(
        product.discount ?? 0
      ),

    stock:
      Number(
        product.stock ?? 0
      ),

    rating:
      Number(
        product.rating ?? 0
      ),

    reviewCount:
      Number(
        product.reviewCount ?? 0
      ),

    sizes:
      Array.isArray(
        product.sizes
      )
        ? product.sizes.map(
            String
          )
        : [],

    colors:
      Array.isArray(
        product.colors
      )
        ? product.colors.map(
            String
          )
        : [],

    images:
      Array.isArray(
        product.images
      )
        ? product.images
        : [],

    tags:
      Array.isArray(
        product.tags
      )
        ? product.tags
        : [],

    highlights:
      Array.isArray(
        product.highlights
      )
        ? product.highlights
        : [],

    careInstructions:
      Array.isArray(
        product.careInstructions
      )
        ? product.careInstructions
        : [],

    reviews:
      Array.isArray(
        product.reviews
      )
        ? product.reviews
        : [],

    variants:
      product.variants &&
      typeof product.variants ===
        "object"
        ? product.variants
        : {},

    specifications:
      product.specifications &&
      typeof product.specifications ===
        "object"
        ? product.specifications
        : {},

    delivery:
      product.delivery &&
      typeof product.delivery ===
        "object"
        ? product.delivery
        : {},

    isFeatured:
      Boolean(
        product.isFeatured
      ),

    isBestSeller:
      Boolean(
        product.isBestSeller
      ),

    isNew:
      Boolean(
        product.isNew ??
        product.isNewArrival
      ),

    isActive:
      product.isActive !==
      false,
  };
}


// ======================================================
// PREPARE PRODUCT BEFORE SENDING TO BACKEND
// ======================================================

function prepareForApi(product) {
  const {
    id,
    _id,
    createdAt,
    updatedAt,
    __v,
    isNew,
    ...productData
  } = product;

  const reviews =
    Array.isArray(
      product.reviews
    )
      ? product.reviews.map(
          (review) => {
            const {
              _id,
              createdAt,
              updatedAt,
              __v,
              ...reviewData
            } = review;

            return reviewData;
          }
        )
      : [];

  return {
    ...productData,

    isNewArrival:
      Boolean(isNew),

    reviews,
  };
}


// ======================================================
// VALIDATE PRODUCT
// ======================================================

function validateProduct(product) {
  if (
    !String(
      product.name || ""
    ).trim()
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      Number(product.price)
    ) ||
    Number(product.price) <
      0
  ) {
    return false;
  }

  if (
    !Number.isFinite(
      Number(
        product.discount ?? 0
      )
    ) ||
    Number(
      product.discount ?? 0
    ) < 0 ||
    Number(
      product.discount ?? 0
    ) > 100
  ) {
    return false;
  }

  const stockValid = (
    value
  ) => {
    if (
      value &&
      typeof value ===
        "object"
    ) {
      return Object.values(
        value
      ).every(stockValid);
    }

    return (
      Number.isSafeInteger(
        Number(value)
      ) &&
      Number(value) >= 0
    );
  };

  if (
    product.variants &&
    !stockValid(
      product.variants
    )
  ) {
    return false;
  }

  if (
    !product.variants &&
    !stockValid(
      product.stock ?? 0
    )
  ) {
    return false;
  }

  return true;
}


// ======================================================
// PROVIDER
// ======================================================

export default function CatalogProvider({
  children,
}) {
  const [
    baseProducts,
    setBaseProducts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    revision,
    setRevision,
  ] = useState(0);


  // ======================================================
  // LOAD PRODUCTS FROM EXPRESS / MONGODB
  // ======================================================

  const refreshProducts =
    useCallback(
      async () => {
        try {
          setLoading(true);

          setError("");

          const data =
            await getProducts();

          const normalized =
            Array.isArray(data)
              ? data
                  .map(
                    normalizeProduct
                  )
                  .filter(Boolean)
              : [];

          setBaseProducts(
            normalized
          );

          return normalized;
        } catch (error) {
          console.error(
            "Catalog loading error:",
            error
          );

          setError(
            error.message ||
              "Unable to load products."
          );

          return [];
        } finally {
          setLoading(false);
        }
      },
      []
    );


  // ======================================================
  // INITIAL LOAD
  // ======================================================

  useEffect(() => {
    refreshProducts();
  }, [
    refreshProducts,
  ]);


  // ======================================================
  // APPLY LOCAL ORDER RESERVATIONS
  // ======================================================

  const products =
    useMemo(
      () =>
        applyReservations(
          baseProducts,
          allOrders()
        ),

      [
        baseProducts,
        revision,
      ]
    );


  // ======================================================
  // WATCH ORDER CHANGES
  // ======================================================

  useEffect(() => {
    const updateOrders =
      () => {
        setRevision(
          (value) =>
            value + 1
        );
      };

    const syncStorage = (
      event
    ) => {
      if (
        event.key ===
          "gymdrobe-orders" ||
        event.key === null
      ) {
        updateOrders();
      }
    };

    window.addEventListener(
      "gymdrobe-orders-updated",
      updateOrders
    );

    window.addEventListener(
      "storage",
      syncStorage
    );

    return () => {
      window.removeEventListener(
        "gymdrobe-orders-updated",
        updateOrders
      );

      window.removeEventListener(
        "storage",
        syncStorage
      );
    };
  }, []);


  // ======================================================
  // CREATE / UPDATE PRODUCT
  // ======================================================

  async function saveProduct(
    product
  ) {
    if (
      !validateProduct(
        product
      )
    ) {
      console.error(
        "Invalid product data."
      );

      return false;
    }

    try {
      const nextProduct =
        structuredClone(
          product
        );

      /*
        The frontend currently displays
        AVAILABLE inventory after local
        order reservations have been applied.

        Before saving to MongoDB we restore
        those reserved quantities.
      */

      const orders =
        allOrders();


      if (
        nextProduct.variants &&
        typeof nextProduct.variants ===
          "object"
      ) {
        const colors =
          product.colors
            ?.length
            ? product.colors
            : [null];

        const sizes =
          product.sizes
            ?.length
            ? product.sizes
            : [null];

        for (
          const color
          of colors
        ) {
          for (
            const size
            of sizes
          ) {
            const group =
              color
                ? nextProduct
                    .variants[
                    color
                  ]
                : nextProduct
                    .variants;

            if (
              group &&
              typeof group ===
                "object"
            ) {
              const key =
                size ||
                "default";

              group[key] =
                Number(
                  group[
                    key
                  ] || 0
                ) +
                reservedQuantity(
                  orders,
                  product,
                  size,
                  color
                );
            }
          }
        }
      } else {
        nextProduct.stock =
          Number(
            nextProduct.stock ||
              0
          ) +
          reservedQuantity(
            orders,
            product,
            null,
            null
          );
      }


      // Recalculate total inventory.
      nextProduct.stock =
        getTotalStock(
          nextProduct
        );


      // Find existing MongoDB product.
      const existing =
        baseProducts.find(
          (item) =>
            String(
              item.id
            ) ===
              String(
                product.id
              ) ||
            (
              product._id &&
              String(
                item._id
              ) ===
                String(
                  product._id
                )
            )
        );


      const apiData =
        prepareForApi(
          nextProduct
        );

      let response;


      // UPDATE
      if (existing) {
        response =
          await updateProduct(
            existing._id ||
              existing.id,

            apiData
          );
      }

      // CREATE
      else {
        response =
          await createProduct(
            apiData
          );
      }


      const savedProduct =
        normalizeProduct(
          response.product
        );


      if (!savedProduct) {
        return false;
      }


      // Update React state.
      setBaseProducts(
        (current) => {
          const exists =
            current.some(
              (item) =>
                String(
                  item.id
                ) ===
                  String(
                    savedProduct.id
                  )
            );

          if (exists) {
            return current.map(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  savedProduct.id
                )
                  ? savedProduct
                  : item
            );
          }

          return [
            ...current,
            savedProduct,
          ];
        }
      );

      return true;

    } catch (error) {
      console.error(
        "Product save error:",
        error
      );

      return false;
    }
  }


  // ======================================================
  // CURRENT CATALOG
  // ======================================================

  function getLatestProducts() {
    return applyReservations(
      baseProducts,
      allOrders()
    );
  }


  // ======================================================
  // PROVIDER VALUE
  // ======================================================

  const value =
    useMemo(
      () => ({
        products,

        loading,

        error,

        saveProduct,

        refreshProducts,

        getLatestProducts,
      }),

      [
        products,
        loading,
        error,
        baseProducts,
        refreshProducts,
      ]
    );


  return (
    <CatalogContext.Provider
      value={value}
    >
      {children}
    </CatalogContext.Provider>
  );
}


// ======================================================
// HOOK
// ======================================================

export function useCatalog() {
  const context =
    useContext(
      CatalogContext
    );

  if (!context) {
    throw new Error(
      "CatalogProvider is missing."
    );
  }

  return context;
}