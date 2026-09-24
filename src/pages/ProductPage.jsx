import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import products from "../data/products";

import {
  getDiscountedPrice,
} from "../utils/productPricing";

import ProductCard from "../components/ProductCard";
import Footer from "../components/Footer";

/* =========================================================
   HELPERS
========================================================= */

function getTotalProductStock(product) {
  if (!product) {
    return 0;
  }

  if (
    product.variants &&
    typeof product.variants === "object"
  ) {
    let total = 0;

    Object.values(
      product.variants
    ).forEach((variant) => {
      if (
        typeof variant === "number"
      ) {
        total += Number(
          variant || 0
        );

        return;
      }

      if (
        variant &&
        typeof variant === "object"
      ) {
        Object.values(
          variant
        ).forEach((value) => {
          total += Number(
            value || 0
          );
        });
      }
    });

    return Math.max(
      total,
      0
    );
  }

  return Math.max(
    Number(
      product.stock || 0
    ),
    0
  );
}

function getColorHex(color) {
  const colors = {
    Black: "#111111",
    White: "#ffffff",
    Blue: "#2563eb",
    Grey: "#9ca3af",
    Gray: "#9ca3af",
    Red: "#dc2626",
    Green: "#16a34a",
    Orange: "#f97316",
    Yellow: "#eab308",
    Pink: "#ec4899",
    Purple: "#9333ea",
    Navy: "#172554",
    Brown: "#78350f",
    Beige: "#d6c5a8",
    Graphite: "#374151",
  };

  return (
    colors[color] ||
    "#d1d5db"
  );
}

function formatReviewDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

/* =========================================================
   PRODUCT PAGE
========================================================= */

function ProductPage({
  addToCart,
  buyNow,
  wishlist = [],
  toggleWishlist,
}) {
  const { id } =
    useParams();

  const navigate =
    useNavigate();

  /* =======================================================
     PRODUCT
  ======================================================= */

  const product =
    products.find(
      (item) =>
        String(item.id) ===
        String(id)
    );

  const sizes =
    product?.sizes || [];

  const colors =
    product?.colors || [];

  const hasSizeOptions =
    sizes.length > 0;

  const hasColorOptions =
    colors.length > 0;

  /* =======================================================
     PRODUCT STATES
  ======================================================= */

  const [
    quantity,
    setQuantity,
  ] = useState(1);

  const [
    selectedSize,
    setSelectedSize,
  ] = useState("");

  const [
    selectedColor,
    setSelectedColor,
  ] = useState("");

  const [
    selectedImage,
    setSelectedImage,
  ] = useState("");

  const [
    isZoomed,
    setIsZoomed,
  ] = useState(false);

  /* =======================================================
     MESSAGE
  ======================================================= */

  const [
    actionMessage,
    setActionMessage,
  ] = useState("");

  /* =======================================================
     DELIVERY
  ======================================================= */

  const [
    pincode,
    setPincode,
  ] = useState("");

  const [
    deliveryMessage,
    setDeliveryMessage,
  ] = useState("");

  const [
    isCheckingDelivery,
    setIsCheckingDelivery,
  ] = useState(false);

  /* =======================================================
     REVIEWS
  ======================================================= */

  const [
    reviewName,
    setReviewName,
  ] = useState("");

  const [
    reviewRating,
    setReviewRating,
  ] = useState(5);

  const [
    reviewComment,
    setReviewComment,
  ] = useState("");

  const [
    userReviews,
    setUserReviews,
  ] = useState([]);

  /* =======================================================
     SHARE
  ======================================================= */

  const [
    shareMessage,
    setShareMessage,
  ] = useState("");

  /* =======================================================
     RECENTLY VIEWED
  ======================================================= */

  const [
    recentlyViewedIds,
    setRecentlyViewedIds,
  ] = useState([]);

  /* =======================================================
     TIMERS
  ======================================================= */

  const deliveryTimerRef =
    useRef(null);

  const shareTimerRef =
    useRef(null);

  const actionTimerRef =
    useRef(null);

  /* =======================================================
     PRODUCT INITIALIZATION
  ======================================================= */

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    if (!product) {
      setSelectedImage("");
      setSelectedColor("");
      setSelectedSize("");
      setQuantity(1);
      setUserReviews([]);
      setPincode("");
      setDeliveryMessage("");
      setShareMessage("");
      setActionMessage("");
      setRecentlyViewedIds([]);

      return;
    }

    /* IMAGE */

    setSelectedImage(
      product.image || ""
    );

    /* =============================================
       FIRST AVAILABLE COLOR
    ============================================= */

    let firstAvailableColor =
      colors[0] || "";

    if (
      product.variants &&
      colors.length > 0
    ) {
      const availableColor =
        colors.find(
          (color) => {
            if (
              hasSizeOptions
            ) {
              return sizes.some(
                (size) =>
                  Number(
                    product
                      .variants?.[
                        color
                      ]?.[
                        size
                      ] ?? 0
                  ) > 0
              );
            }

            return (
              Number(
                product
                  .variants?.[
                    color
                  ]?.default ??
                  0
              ) > 0
            );
          }
        );

      firstAvailableColor =
        availableColor || "";
    }

    setSelectedColor(
      firstAvailableColor
    );

    /* =============================================
       FIRST AVAILABLE SIZE
    ============================================= */

    let firstAvailableSize =
      sizes[0] || "";

    if (
      product.variants &&
      firstAvailableColor &&
      sizes.length > 0
    ) {
      const availableSize =
        sizes.find(
          (size) =>
            Number(
              product
                .variants?.[
                  firstAvailableColor
                ]?.[
                  size
                ] ?? 0
            ) > 0
        );

      firstAvailableSize =
        availableSize || "";
    }

    setSelectedSize(
      firstAvailableSize
    );

    setQuantity(1);

    setPincode("");
    setDeliveryMessage("");
    setIsCheckingDelivery(
      false
    );

    setShareMessage("");
    setActionMessage("");

    /* =============================================
       LOAD USER REVIEWS
    ============================================= */

    try {
      const savedReviews =
        localStorage.getItem(
          "gymdrobe-reviews"
        );

      if (!savedReviews) {
        setUserReviews([]);
      } else {
        const parsed =
          JSON.parse(
            savedReviews
          );

        if (
          parsed &&
          typeof parsed ===
            "object" &&
          !Array.isArray(
            parsed
          )
        ) {
          setUserReviews(
            Array.isArray(
              parsed?.[
                product.id
              ]
            )
              ? parsed[
                  product.id
                ]
              : []
          );
        } else {
          setUserReviews([]);
        }
      }
    } catch {
      setUserReviews([]);
    }

    /* =============================================
       RECENTLY VIEWED
    ============================================= */

    let recentlyViewed = [];

    try {
      const stored =
        localStorage.getItem(
          "gymdrobe-recently-viewed"
        );

      if (stored) {
        const parsed =
          JSON.parse(
            stored
          );

        if (
          Array.isArray(parsed)
        ) {
          recentlyViewed =
            parsed;
        }
      }
    } catch {
      recentlyViewed = [];
    }

    recentlyViewed =
      recentlyViewed.filter(
        (productId) =>
          String(productId) !==
          String(product.id)
      );

    recentlyViewed.unshift(
      product.id
    );

    recentlyViewed =
      recentlyViewed.slice(
        0,
        6
      );

    setRecentlyViewedIds(
      recentlyViewed
    );

    try {
      localStorage.setItem(
        "gymdrobe-recently-viewed",
        JSON.stringify(
          recentlyViewed
        )
      );
    } catch {
      // Ignore localStorage error.
    }
  }, [
    product,
  ]);

  /* =======================================================
     TIMER CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      if (
        deliveryTimerRef.current
      ) {
        clearTimeout(
          deliveryTimerRef.current
        );
      }

      if (
        shareTimerRef.current
      ) {
        clearTimeout(
          shareTimerRef.current
        );
      }

      if (
        actionTimerRef.current
      ) {
        clearTimeout(
          actionTimerRef.current
        );
      }
    };
  }, []);

  /* =======================================================
     PRODUCT IMAGES
  ======================================================= */

  const productImages =
    useMemo(() => {
      if (!product) {
        return [];
      }

      return [
        product.image,
        ...(
          product.images || []
        ),
      ].filter(
        (
          image,
          index,
          array
        ) =>
          image &&
          array.indexOf(
            image
          ) === index
      );
    }, [
      product,
    ]);

  /* =======================================================
     AVAILABLE SIZES
  ======================================================= */

  const availableSizes =
    useMemo(() => {
      if (
        !hasSizeOptions
      ) {
        return [];
      }

      if (
        !product?.variants ||
        !selectedColor
      ) {
        return sizes;
      }

      return sizes.filter(
        (size) =>
          Number(
            product
              .variants?.[
                selectedColor
              ]?.[
                size
              ] ?? 0
          ) > 0
      );
    }, [
      product,
      selectedColor,
      hasSizeOptions,
      sizes,
    ]);

  /* =======================================================
     CURRENT VARIANT STOCK
  ======================================================= */

  const stock =
    useMemo(() => {
      if (!product) {
        return 0;
      }

      if (
        !product.variants
      ) {
        return Number(
          product.stock || 0
        );
      }

      if (
        selectedColor &&
        selectedSize
      ) {
        return Number(
          product
            .variants?.[
              selectedColor
            ]?.[
              selectedSize
            ] ?? 0
        );
      }

      if (
        selectedColor &&
        !hasSizeOptions
      ) {
        return Number(
          product
            .variants?.[
              selectedColor
            ]?.default ??
            0
        );
      }

      return 0;
    }, [
      product,
      selectedColor,
      selectedSize,
      hasSizeOptions,
    ]);

  /* =======================================================
     STOCK MESSAGE
  ======================================================= */

  const stockMessage =
    useMemo(() => {
      if (
        hasColorOptions &&
        !selectedColor
      ) {
        return {
          type: "select",
          text:
            "Select a color",
        };
      }

      if (
        hasSizeOptions &&
        !selectedSize
      ) {
        return {
          type: "select",
          text:
            "Select a size",
        };
      }

      if (stock <= 0) {
        return {
          type: "out",
          text:
            "Currently out of stock",
        };
      }

      if (stock <= 3) {
        return {
          type: "low",
          text:
            `Only ${stock} left`,
        };
      }

      return {
        type:
          "available",
        text:
          "In stock",
      };
    }, [
      stock,
      selectedColor,
      selectedSize,
      hasColorOptions,
      hasSizeOptions,
    ]);

  /* =======================================================
     KEEP QUANTITY VALID
  ======================================================= */

  useEffect(() => {
    if (stock <= 0) {
      setQuantity(1);

      return;
    }

    setQuantity(
      (current) =>
        Math.min(
          Math.max(
            Number(
              current || 1
            ),
            1
          ),
          stock
        )
    );
  }, [
    stock,
  ]);

  /* =======================================================
     FIX SIZE AFTER COLOR CHANGE
  ======================================================= */

  useEffect(() => {
    if (
      !product ||
      !hasSizeOptions
    ) {
      return;
    }

    if (
      availableSizes.length ===
      0
    ) {
      setSelectedSize("");
      setQuantity(1);

      return;
    }

    if (
      !availableSizes.includes(
        selectedSize
      )
    ) {
      setSelectedSize(
        availableSizes[0]
      );

      setQuantity(1);
    }
  }, [
    product,
    hasSizeOptions,
    availableSizes,
    selectedSize,
  ]);

  /* =======================================================
     REVIEWS
  ======================================================= */

  const allReviews =
    useMemo(() => {
      if (!product) {
        return [];
      }

      return [
        ...(
          Array.isArray(
            product.reviews
          )
            ? product.reviews
            : []
        ),

        ...(
          Array.isArray(
            userReviews
          )
            ? userReviews
            : []
        ),
      ];
    }, [
      product,
      userReviews,
    ]);

  const averageRating =
    useMemo(() => {
      if (!product) {
        return "0.0";
      }

      if (
        allReviews.length ===
        0
      ) {
        return Number(
          product.rating || 0
        ).toFixed(1);
      }

      const total =
        allReviews.reduce(
          (
            sum,
            review
          ) =>
            sum +
            Number(
              review.rating ||
                0
            ),
          0
        );

      return (
        total /
        allReviews.length
      ).toFixed(1);
    }, [
      product,
      allReviews,
    ]);

  const ratingBreakdown =
    useMemo(() => {
      return [
        5,
        4,
        3,
        2,
        1,
      ].map(
        (rating) => {
          const count =
            allReviews.filter(
              (review) =>
                Number(
                  review.rating
                ) ===
                rating
            ).length;

          const percentage =
            allReviews.length >
            0
              ? (
                  count /
                  allReviews.length
                ) *
                100
              : 0;

          return {
            rating,
            count,
            percentage,
          };
        }
      );
    }, [
      allReviews,
    ]);

  /* =======================================================
     PRICE
  ======================================================= */

  const discountedPrice =
    product
      ? getDiscountedPrice(
          product
        )
      : 0;

  const originalPrice =
    product
      ? Number(
          product.price ||
            0
        )
      : 0;

  const savings =
    Math.max(
      originalPrice -
        discountedPrice,
      0
    );

  /* =======================================================
     WISHLIST
  ======================================================= */

  const isWishlisted =
    product
      ? wishlist.some(
          (item) =>
            String(
              item.id
            ) ===
            String(
              product.id
            )
        )
      : false;

  /* =======================================================
     RELATED PRODUCTS
  ======================================================= */

  const relatedProducts =
    useMemo(() => {
      if (!product) {
        return [];
      }

      return products
        .filter(
          (item) =>
            String(item.id) !==
            String(product.id)
        )
        .map((item) => {
          let score = 0;

          if (
            item.subcategory &&
            item.subcategory ===
              product.subcategory
          ) {
            score += 5;
          }

          if (
            item.category ===
            product.category
          ) {
            score += 3;
          }

          const sharedTags =
            item.tags?.filter(
              (tag) =>
                product.tags?.includes(
                  tag
                )
            ).length || 0;

          score +=
            sharedTags * 2;

          if (
            item.brand &&
            item.brand ===
              product.brand
          ) {
            score += 2;
          }

          if (
            item.isFeatured
          ) {
            score += 1;
          }

          if (
            item.isBestSeller
          ) {
            score += 1;
          }

          return {
            item,
            score,
          };
        })
        .sort(
          (a, b) =>
            b.score -
            a.score
        )
        .map(
          (entry) =>
            entry.item
        )
        .slice(
          0,
          5
        );
    }, [
      product,
    ]);

  /* =======================================================
     RECENTLY VIEWED PRODUCTS
  ======================================================= */

  const recentlyViewedProducts =
    useMemo(() => {
      if (!product) {
        return [];
      }

      return recentlyViewedIds
        .filter(
          (productId) =>
            String(
              productId
            ) !==
            String(
              product.id
            )
        )
        .map(
          (productId) =>
            products.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  productId
                )
            )
        )
        .filter(Boolean)
        .slice(
          0,
          5
        );
    }, [
      product,
      recentlyViewedIds,
    ]);

  /* =======================================================
     ACTION MESSAGE
  ======================================================= */

  function showActionMessage(
    message
  ) {
    setActionMessage(
      message
    );

    if (
      actionTimerRef.current
    ) {
      clearTimeout(
        actionTimerRef.current
      );
    }

    actionTimerRef.current =
      setTimeout(() => {
        setActionMessage("");
      }, 3000);
  }

  /* =======================================================
     CLEAR RECENTLY VIEWED
  ======================================================= */

  function clearRecentlyViewed() {
    try {
      localStorage.removeItem(
        "gymdrobe-recently-viewed"
      );
    } catch {
      // Ignore.
    }

    setRecentlyViewedIds(
      []
    );
  }

  /* =======================================================
     SHARE
  ======================================================= */

  async function handleShareProduct() {
    if (!product) {
      return;
    }

    const shareData = {
      title:
        product.name,

      text:
        `Check out ${product.name} on GymDrobe.`,

      url:
        window.location.href,
    };

    try {
      if (
        navigator.share &&
        typeof navigator.share ===
          "function"
      ) {
        await navigator.share(
          shareData
        );

        return;
      }

      if (
        navigator.clipboard &&
        typeof navigator
          .clipboard
          .writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          window.location.href
        );

        setShareMessage(
          "Product link copied!"
        );

        if (
          shareTimerRef.current
        ) {
          clearTimeout(
            shareTimerRef.current
          );
        }

        shareTimerRef.current =
          setTimeout(() => {
            setShareMessage("");
          }, 2500);

        return;
      }

      setShareMessage(
        "Copy the product URL from your browser."
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      setShareMessage(
        "Unable to share this product."
      );
    }

    if (
      shareTimerRef.current
    ) {
      clearTimeout(
        shareTimerRef.current
      );
    }

    shareTimerRef.current =
      setTimeout(() => {
        setShareMessage("");
      }, 2500);
  }

  /* =======================================================
     DELIVERY
  ======================================================= */

  function checkDelivery() {
    if (!product) {
      return;
    }

    const trimmedPincode =
      pincode.trim();

    if (
      !/^\d{6}$/.test(
        trimmedPincode
      )
    ) {
      setDeliveryMessage(
        "Please enter a valid 6-digit pincode."
      );

      return;
    }

    if (
      product.delivery
        ?.available ===
      false
    ) {
      setDeliveryMessage(
        "Delivery is currently unavailable for this product."
      );

      return;
    }

    if (
      deliveryTimerRef.current
    ) {
      clearTimeout(
        deliveryTimerRef.current
      );
    }

    setIsCheckingDelivery(
      true
    );

    setDeliveryMessage("");

    deliveryTimerRef.current =
      setTimeout(() => {
        const firstDigit =
          Number(
            trimmedPincode[0]
          );

        if (
          firstDigit >= 1 &&
          firstDigit <= 8
        ) {
          setDeliveryMessage(
            `✓ Delivery available. Expected delivery in ${
              product.delivery
                ?.estimatedDays ||
              "3–7 business days"
            }.`
          );
        } else {
          setDeliveryMessage(
            "Delivery is currently unavailable for this pincode."
          );
        }

        setIsCheckingDelivery(
          false
        );
      }, 700);
  }

  /* =======================================================
     VALIDATE SELECTION
  ======================================================= */

  function validateSelection() {
    if (
      hasColorOptions &&
      !selectedColor
    ) {
      showActionMessage(
        "Please select a color."
      );

      return false;
    }

    if (
      hasSizeOptions &&
      !selectedSize
    ) {
      showActionMessage(
        "Please select a size."
      );

      return false;
    }

    if (stock <= 0) {
      showActionMessage(
        "This product is out of stock."
      );

      return false;
    }

    if (
      quantity > stock
    ) {
      showActionMessage(
        `Only ${stock} item${
          stock > 1
            ? "s"
            : ""
        } available.`
      );

      return false;
    }

    return true;
  }

  /* =======================================================
     ADD TO BAG
  ======================================================= */

  function handleAddToCart() {
    if (
      !product ||
      !validateSelection()
    ) {
      return;
    }

    if (
      typeof addToCart !==
      "function"
    ) {
      showActionMessage(
        "Cart system is unavailable."
      );

      return;
    }

    const success =
      addToCart(
        product,
        quantity,
        selectedSize ||
          null,
        selectedColor ||
          null
      );

    if (
      success !== false
    ) {
      showActionMessage(
        "Added to your bag."
      );
    }
  }

  /* =======================================================
     BUY NOW
  ======================================================= */

  function handleBuyNow() {
    if (
      !product ||
      !validateSelection()
    ) {
      return;
    }

    if (
      typeof buyNow !==
      "function"
    ) {
      showActionMessage(
        "Buy Now system is unavailable."
      );

      return;
    }

    const success =
      buyNow(
        product,
        quantity,
        selectedSize ||
          null,
        selectedColor ||
          null
      );

    if (success) {
      navigate(
        "/checkout"
      );
    }
  }

  /* =======================================================
     QUANTITY
  ======================================================= */

  function increaseQuantity() {
    if (stock <= 0) {
      return;
    }

    setQuantity(
      (current) =>
        Math.min(
          Number(
            current || 1
          ) + 1,
          stock
        )
    );
  }

  function decreaseQuantity() {
    setQuantity(
      (current) =>
        Math.max(
          1,
          Number(
            current || 1
          ) - 1
        )
    );
  }

  /* =======================================================
     SIZE
  ======================================================= */

  function handleSizeChange(
    size
  ) {
    if (
      !availableSizes.includes(
        size
      )
    ) {
      return;
    }

    setSelectedSize(
      size
    );

    setQuantity(1);

    setActionMessage("");
  }

  /* =======================================================
     COLOR
  ======================================================= */

  function getColorStock(
    color
  ) {
    if (!product) {
      return 0;
    }

    if (
      !product.variants
    ) {
      return Number(
        product.stock || 0
      );
    }

    if (
      hasSizeOptions
    ) {
      return sizes.reduce(
        (
          total,
          size
        ) =>
          total +
          Number(
            product
              .variants?.[
                color
              ]?.[
                size
              ] ?? 0
          ),
        0
      );
    }

    return Number(
      product
        .variants?.[
          color
        ]?.default ??
        0
    );
  }

  function handleColorChange(
    color
  ) {
    if (
      !colors.includes(
        color
      )
    ) {
      return;
    }

    const colorStock =
      getColorStock(
        color
      );

    if (
      colorStock <= 0
    ) {
      showActionMessage(
        `${color} is currently out of stock.`
      );

      return;
    }

    setSelectedColor(
      color
    );

    setQuantity(1);

    setActionMessage("");

    if (
      product?.variants &&
      hasSizeOptions
    ) {
      const firstAvailableSize =
        sizes.find(
          (size) =>
            Number(
              product
                .variants?.[
                  color
                ]?.[
                  size
                ] ?? 0
            ) > 0
        );

      setSelectedSize(
        firstAvailableSize ||
          ""
      );
    }
  }

  /* =======================================================
     SUBMIT REVIEW
  ======================================================= */

  function handleReviewSubmit(
    event
  ) {
    event.preventDefault();

    if (!product) {
      return;
    }

    const name =
      reviewName.trim();

    const comment =
      reviewComment.trim();

    if (
      name.length < 2
    ) {
      showActionMessage(
        "Please enter a valid name."
      );

      return;
    }

    if (
      comment.length < 5
    ) {
      showActionMessage(
        "Review must contain at least 5 characters."
      );

      return;
    }

    const newReview = {
      id:
        Date.now() +
        Math.random(),

      name,

      rating:
        Number(
          reviewRating
        ),

      comment,

      verified: false,

      createdAt:
        new Date().toISOString(),
    };

    let allReviewsData =
      {};

    try {
      const saved =
        localStorage.getItem(
          "gymdrobe-reviews"
        );

      if (saved) {
        const parsed =
          JSON.parse(
            saved
          );

        if (
          parsed &&
          typeof parsed ===
            "object" &&
          !Array.isArray(
            parsed
          )
        ) {
          allReviewsData =
            parsed;
        }
      }
    } catch {
      allReviewsData =
        {};
    }

    const existing =
      Array.isArray(
        allReviewsData[
          product.id
        ]
      )
        ? allReviewsData[
            product.id
          ]
        : [];

    allReviewsData[
      product.id
    ] = [
      ...existing,
      newReview,
    ];

    try {
      localStorage.setItem(
        "gymdrobe-reviews",
        JSON.stringify(
          allReviewsData
        )
      );
    } catch {
      // Ignore.
    }

    setUserReviews(
      (current) => [
        ...current,
        newReview,
      ]
    );

    setReviewName("");

    setReviewRating(5);

    setReviewComment("");

    showActionMessage(
      "Review submitted successfully!"
    );
  }

  /* =======================================================
     PRODUCT NOT FOUND
  ======================================================= */

  if (!product) {
    return (
      <>
        <section
          className="
            flex
            min-h-[70vh]
            items-center
            justify-center
            bg-white
            px-5
          "
        >
          <div
            className="
              max-w-md
              text-center
            "
          >
            <p
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.15em]
                text-orange-600
              "
            >
              GymDrobe
            </p>

            <h1
              className="
                mt-4
                text-3xl
                font-bold
                text-[#282c3f]
              "
            >
              Product Not Found
            </h1>

            <p
              className="
                mt-3
                text-sm
                leading-6
                text-[#696b79]
              "
            >
              The product you're
              looking for doesn't
              exist or may no longer
              be available.
            </p>

            <Link
              to="/shop"
              className="
                mt-6
                inline-flex
                bg-orange-600
                px-6
                py-3
                text-xs
                font-bold
                uppercase
                text-white
              "
            >
              Back To Shop
            </Link>
          </div>
        </section>

        <Footer />
      </>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      <main
        className="
          min-h-screen
          bg-white
          text-[#282c3f]
        "
      >
        {/* =================================================
            BREADCRUMB
        ================================================= */}

        <div
          className="
            mx-auto
            max-w-[1600px]
            px-4
            py-5
            sm:px-6
            lg:px-8
          "
        >
          <nav
            className="
              flex
              flex-wrap
              items-center
              gap-2
              text-[11px]
              text-[#696b79]
            "
          >
            <Link
              to="/"
              className="
                hover:text-orange-600
              "
            >
              Home
            </Link>

            <span>/</span>

            <Link
              to="/shop"
              className="
                hover:text-orange-600
              "
            >
              Shop
            </Link>

            {product.category && (
              <>
                <span>/</span>

                <Link
                  to={`/shop?category=${encodeURIComponent(
                    product.category
                  )}`}
                  className="
                    hover:text-orange-600
                  "
                >
                  {
                    product.category
                  }
                </Link>
              </>
            )}

            <span>/</span>

            <span
              className="
                font-semibold
                text-[#282c3f]
              "
            >
              {product.name}
            </span>
          </nav>
        </div>

        {/* =================================================
            MAIN PRODUCT
        ================================================= */}

        <div
          className="
            mx-auto
            grid
            max-w-[1600px]
            gap-8
            border-t
            border-[#eaeaec]
            px-4
            py-6
            sm:px-6
            lg:grid-cols-[1.08fr_0.92fr]
            lg:gap-12
            lg:px-8
            lg:py-8
          "
        >
          {/* ===============================================
              IMAGE GALLERY
          =============================================== */}

          <div className="min-w-0">
            {/* MAIN IMAGE */}

            <div
              className="
                relative
                aspect-[4/5]
                max-h-[720px]
                overflow-hidden
                bg-[#f5f5f6]
                lg:aspect-[5/6]
              "
              onMouseEnter={() =>
                setIsZoomed(true)
              }
              onMouseLeave={() =>
                setIsZoomed(false)
              }
            >
              <img
                src={
                  selectedImage ||
                  product.image
                }
                alt={product.name}
                className={`
                  h-full
                  w-full
                  object-cover
                  transition-transform
                  duration-500
                  ${
                    isZoomed
                      ? "lg:scale-[1.08]"
                      : "scale-100"
                  }
                `}
              />

              {product.badge && (
                <span
                  className="
                    absolute
                    left-3
                    top-3
                    bg-[#282c3f]
                    px-3
                    py-1.5
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-white
                  "
                >
                  {product.badge}
                </span>
              )}

              {Number(
                product.discount ||
                  0
              ) > 0 && (
                <span
                  className="
                    absolute
                    bottom-3
                    left-3
                    bg-orange-600
                    px-3
                    py-1.5
                    text-[10px]
                    font-bold
                    text-white
                  "
                >
                  {
                    product.discount
                  }
                  % OFF
                </span>
              )}
            </div>

            {/* THUMBNAILS */}

            {productImages.length >
              1 && (
              <div
                className="
                  hide-scrollbar
                  mt-3
                  flex
                  gap-2
                  overflow-x-auto
                "
              >
                {productImages.map(
                  (
                    image,
                    index
                  ) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() =>
                        setSelectedImage(
                          image
                        )
                      }
                      className={`
                        h-[90px]
                        w-[72px]
                        shrink-0
                        overflow-hidden
                        border-2
                        bg-[#f5f5f6]
                        sm:h-[110px]
                        sm:w-[88px]
                        ${
                          selectedImage ===
                          image
                            ? "border-orange-600"
                            : "border-transparent"
                        }
                      `}
                    >
                      <img
                        src={image}
                        alt={`${product.name} ${
                          index + 1
                        }`}
                        className="
                          h-full
                          w-full
                          object-cover
                        "
                      />
                    </button>
                  )
                )}
              </div>
            )}

            {/* SHARE */}

            <div
              className="
                mt-4
                flex
                items-center
                gap-3
              "
            >
              <button
                type="button"
                onClick={
                  handleShareProduct
                }
                className="
                  border
                  border-[#d4d5d9]
                  bg-white
                  px-4
                  py-2
                  text-[11px]
                  font-bold
                  uppercase
                  text-[#282c3f]
                  transition
                  hover:border-[#282c3f]
                "
              >
                Share Product
              </button>

              {shareMessage && (
                <span
                  className="
                    text-xs
                    font-semibold
                    text-green-600
                  "
                >
                  {shareMessage}
                </span>
              )}
            </div>
          </div>

          {/* ===============================================
              PRODUCT PURCHASE PANEL
          =============================================== */}

          <div
            className="
              min-w-0
              lg:sticky
              lg:top-[100px]
              lg:self-start
            "
          >
            {/* BRAND */}

            <h1
              className="
                text-[24px]
                font-bold
                leading-tight
                text-[#282c3f]
                sm:text-[28px]
              "
            >
              {product.brand ||
                "GymDrobe"}
            </h1>

            {/* NAME */}

            <p
              className="
                mt-1
                text-[18px]
                font-normal
                leading-7
                text-[#696b79]
                sm:text-[20px]
              "
            >
              {product.name}
            </p>

            {/* RATING */}

            <div
              className="
                mt-4
                inline-flex
                items-center
                gap-2
                border
                border-[#eaeaec]
                px-3
                py-2
                text-sm
              "
            >
              <span
                className="
                  font-bold
                  text-[#282c3f]
                "
              >
                {averageRating} ★
              </span>

              <span
                className="
                  h-4
                  w-px
                  bg-[#d4d5d9]
                "
              />

              <span
                className="
                  text-[#696b79]
                "
              >
                {
                  allReviews.length
                }{" "}
                Rating
                {allReviews.length !==
                1
                  ? "s"
                  : ""}
              </span>
            </div>

            <div
              className="
                my-5
                h-px
                bg-[#eaeaec]
              "
            />

            {/* PRICE */}

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-3
              "
            >
              <span
                className="
                  text-[24px]
                  font-bold
                  text-[#282c3f]
                "
              >
                ₹
                {discountedPrice.toLocaleString(
                  "en-IN"
                )}
              </span>

              {Number(
                product.discount ||
                  0
              ) > 0 && (
                <>
                  <span
                    className="
                      text-base
                      text-[#7e818c]
                    "
                  >
                    MRP{" "}
                    <span className="line-through">
                      ₹
                      {originalPrice.toLocaleString(
                        "en-IN"
                      )}
                    </span>
                  </span>

                  <span
                    className="
                      text-base
                      font-bold
                      text-[#ff905a]
                    "
                  >
                    (
                    {
                      product.discount
                    }
                    % OFF)
                  </span>
                </>
              )}
            </div>

            <p
              className="
                mt-1
                text-[12px]
                font-semibold
                text-green-600
              "
            >
              inclusive of all taxes
            </p>

            {savings > 0 && (
              <p
                className="
                  mt-2
                  text-xs
                  text-[#696b79]
                "
              >
                You save ₹
                {savings.toLocaleString(
                  "en-IN"
                )}
              </p>
            )}

            {/* =============================================
                MESSAGE
            ============================================= */}

            {actionMessage && (
              <div
                role="alert"
                className="
                  mt-5
                  border
                  border-orange-200
                  bg-orange-50
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  text-orange-700
                "
              >
                {actionMessage}
              </div>
            )}

            {/* =============================================
                SIZE
            ============================================= */}

            {hasSizeOptions && (
              <div className="mt-7">
                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >
                  <h2
                    className="
                      text-sm
                      font-bold
                      uppercase
                      text-[#282c3f]
                    "
                  >
                    Select Size
                  </h2>

                  <span
                    className="
                      text-xs
                      font-semibold
                      text-orange-600
                    "
                  >
                    Size Chart
                  </span>
                </div>

                <div
                  className="
                    mt-4
                    flex
                    flex-wrap
                    gap-3
                  "
                >
                  {sizes.map(
                    (size) => {
                      const available =
                        availableSizes.includes(
                          size
                        );

                      return (
                        <button
                          key={size}
                          type="button"
                          disabled={
                            !available
                          }
                          onClick={() =>
                            handleSizeChange(
                              size
                            )
                          }
                          className={`
                            flex
                            h-12
                            min-w-12
                            items-center
                            justify-center
                            rounded-full
                            border
                            px-3
                            text-sm
                            font-bold
                            transition
                            ${
                              selectedSize ===
                              size
                                ? "border-orange-600 bg-orange-50 text-orange-600"
                                : !available
                                ? "cursor-not-allowed border-[#eaeaec] bg-[#f5f5f6] text-[#b6b8bf] line-through"
                                : "border-[#d4d5d9] bg-white text-[#282c3f] hover:border-orange-600"
                            }
                          `}
                        >
                          {size}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* =============================================
                COLOR
            ============================================= */}

            {hasColorOptions && (
              <div className="mt-7">
                <h2
                  className="
                    text-sm
                    font-bold
                    uppercase
                    text-[#282c3f]
                  "
                >
                  Select Color
                </h2>

                <div
                  className="
                    mt-4
                    flex
                    flex-wrap
                    gap-3
                  "
                >
                  {colors.map(
                    (color) => {
                      const colorStock =
                        getColorStock(
                          color
                        );

                      const unavailable =
                        colorStock <= 0;

                      return (
                        <button
                          key={color}
                          type="button"
                          disabled={
                            unavailable
                          }
                          onClick={() =>
                            handleColorChange(
                              color
                            )
                          }
                          className={`
                            flex
                            items-center
                            gap-2
                            border
                            px-3
                            py-2
                            text-sm
                            transition
                            ${
                              selectedColor ===
                              color
                                ? "border-orange-600 bg-orange-50 font-semibold text-orange-700"
                                : unavailable
                                ? "cursor-not-allowed border-[#eaeaec] bg-[#f5f5f6] text-[#b6b8bf]"
                                : "border-[#d4d5d9] bg-white text-[#282c3f] hover:border-orange-600"
                            }
                          `}
                        >
                          <span
                            className="
                              h-4
                              w-4
                              rounded-full
                              border
                              border-gray-300
                            "
                            style={{
                              backgroundColor:
                                getColorHex(
                                  color
                                ),
                            }}
                          />

                          {color}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* STOCK */}

            <div className="mt-5">
              <p
                className={`
                  text-xs
                  font-semibold
                  ${
                    stockMessage.type ===
                    "out"
                      ? "text-red-600"
                      : stockMessage.type ===
                        "low"
                      ? "text-orange-600"
                      : stockMessage.type ===
                        "available"
                      ? "text-green-600"
                      : "text-[#696b79]"
                  }
                `}
              >
                {stockMessage.text}
              </p>
            </div>

            {/* =============================================
                QUANTITY
            ============================================= */}

            {stock > 0 && (
              <div
                className="
                  mt-6
                  flex
                  items-center
                  gap-4
                "
              >
                <span
                  className="
                    text-sm
                    font-bold
                    uppercase
                  "
                >
                  Qty
                </span>

                <div
                  className="
                    flex
                    h-10
                    items-center
                    border
                    border-[#d4d5d9]
                  "
                >
                  <button
                    type="button"
                    onClick={
                      decreaseQuantity
                    }
                    disabled={
                      quantity <= 1
                    }
                    className="
                      h-full
                      w-10
                      text-lg
                      disabled:opacity-30
                    "
                  >
                    −
                  </button>

                  <span
                    className="
                      flex
                      h-full
                      w-10
                      items-center
                      justify-center
                      border-x
                      border-[#eaeaec]
                      text-sm
                      font-bold
                    "
                  >
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={
                      increaseQuantity
                    }
                    disabled={
                      quantity >=
                      stock
                    }
                    className="
                      h-full
                      w-10
                      text-lg
                      disabled:opacity-30
                    "
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* =============================================
                ADD TO BAG / WISHLIST
            ============================================= */}

            <div
              className="
                mt-7
                grid
                gap-3
                sm:grid-cols-[1.35fr_0.9fr]
              "
            >
              <button
                type="button"
                onClick={
                  handleAddToCart
                }
                disabled={
                  stock <= 0
                }
                className="
                  min-h-[54px]
                  bg-orange-600
                  px-5
                  text-sm
                  font-bold
                  uppercase
                  tracking-[0.04em]
                  text-white
                  transition
                  hover:bg-orange-700
                  disabled:cursor-not-allowed
                  disabled:bg-gray-300
                "
              >
                {stock > 0
                  ? "Add To Bag"
                  : "Out Of Stock"}
              </button>

              <button
                type="button"
                onClick={() =>
                  toggleWishlist?.(
                    product
                  )
                }
                className={`
                  min-h-[54px]
                  border
                  px-5
                  text-sm
                  font-bold
                  uppercase
                  transition
                  ${
                    isWishlisted
                      ? "border-orange-600 bg-orange-50 text-orange-600"
                      : "border-[#d4d5d9] bg-white text-[#282c3f] hover:border-[#282c3f]"
                  }
                `}
              >
                {isWishlisted
                  ? "♥ Wishlisted"
                  : "♡ Wishlist"}
              </button>
            </div>

            {/* BUY NOW */}

            <button
              type="button"
              onClick={
                handleBuyNow
              }
              disabled={
                stock <= 0
              }
              className="
                mt-3
                min-h-[50px]
                w-full
                border
                border-[#282c3f]
                bg-white
                px-5
                text-sm
                font-bold
                uppercase
                tracking-[0.04em]
                text-[#282c3f]
                transition
                hover:bg-[#282c3f]
                hover:text-white
                disabled:cursor-not-allowed
                disabled:border-gray-300
                disabled:text-gray-300
              "
            >
              Buy Now
            </button>

            {/* =============================================
                DELIVERY
            ============================================= */}

            <div
              className="
                mt-8
                border-t
                border-[#eaeaec]
                pt-6
              "
            >
              <h2
                className="
                  text-sm
                  font-bold
                  uppercase
                  text-[#282c3f]
                "
              >
                Delivery Options
              </h2>

              <div
                className="
                  mt-4
                  flex
                  max-w-[430px]
                  border
                  border-[#d4d5d9]
                  bg-white
                "
              >
                <input
                  type="text"
                  value={pincode}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(
                    event
                  ) => {
                    setPincode(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(
                          0,
                          6
                        )
                    );

                    setDeliveryMessage(
                      ""
                    );
                  }}
                  placeholder="Enter pincode"
                  className="
                    min-w-0
                    flex-1
                    px-4
                    py-3
                    text-sm
                    outline-none
                  "
                />

                <button
                  type="button"
                  onClick={
                    checkDelivery
                  }
                  disabled={
                    isCheckingDelivery
                  }
                  className="
                    px-5
                    text-xs
                    font-bold
                    uppercase
                    text-orange-600
                    disabled:text-gray-400
                  "
                >
                  {isCheckingDelivery
                    ? "Checking..."
                    : "Check"}
                </button>
              </div>

              {deliveryMessage && (
                <p
                  className={`
                    mt-3
                    text-xs
                    font-semibold
                    ${
                      deliveryMessage.startsWith(
                        "✓"
                      )
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  `}
                >
                  {deliveryMessage}
                </p>
              )}

              <div
                className="
                  mt-5
                  space-y-3
                  text-[13px]
                  text-[#696b79]
                "
              >
                <p>
                  🚚{" "}
                  {product.delivery
                    ?.estimatedDays
                    ? `Delivery in ${product.delivery.estimatedDays}`
                    : "Delivery information available at checkout"}
                </p>

                <p>
                  ✓ Free delivery
                  above ₹
                  {Number(
                    product.delivery
                      ?.freeDeliveryAbove ??
                      500
                  ).toLocaleString(
                    "en-IN"
                  )}
                </p>

                {product.returnPolicy && (
                  <p>
                    ↩{" "}
                    {
                      product.returnPolicy
                    }
                  </p>
                )}
              </div>
            </div>

            {/* =============================================
                SHORT DESCRIPTION
            ============================================= */}

            {product.description && (
              <div
                className="
                  mt-7
                  border-t
                  border-[#eaeaec]
                  pt-6
                "
              >
                <h2
                  className="
                    text-sm
                    font-bold
                    uppercase
                  "
                >
                  Product Details
                </h2>

                <p
                  className="
                    mt-3
                    text-sm
                    leading-6
                    text-[#696b79]
                  "
                >
                  {
                    product.description
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            PRODUCT INFORMATION
        ================================================= */}

        <section
          className="
            border-t
            border-[#eaeaec]
            bg-[#fafafa]
            py-10
            lg:py-14
          "
        >
          <div
            className="
              mx-auto
              grid
              max-w-[1600px]
              gap-10
              px-4
              sm:px-6
              lg:grid-cols-2
              lg:px-8
            "
          >
            {/* DETAILS */}

            <div>
              <h2
                className="
                  text-xl
                  font-bold
                  uppercase
                  tracking-[0.03em]
                "
              >
                Product Details
              </h2>

              {product.highlights
                ?.length > 0 && (
                <div
                  className="
                    mt-6
                    space-y-3
                  "
                >
                  {product.highlights.map(
                    (
                      highlight,
                      index
                    ) => (
                      <div
                        key={`${highlight}-${index}`}
                        className="
                          flex
                          items-start
                          gap-3
                          text-sm
                          text-[#696b79]
                        "
                      >
                        <span
                          className="
                            mt-[2px]
                            text-green-600
                          "
                        >
                          ✓
                        </span>

                        <span>
                          {highlight}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              {product.whatsIncluded && (
                <div className="mt-7">
                  <p
                    className="
                      text-xs
                      font-bold
                      uppercase
                      text-[#282c3f]
                    "
                  >
                    Package Contains
                  </p>

                  <p
                    className="
                      mt-2
                      text-sm
                      text-[#696b79]
                    "
                  >
                    {
                      product.whatsIncluded
                    }
                  </p>
                </div>
              )}

              {product.careInstructions
                ?.length > 0 && (
                <div className="mt-7">
                  <p
                    className="
                      text-xs
                      font-bold
                      uppercase
                    "
                  >
                    Care Instructions
                  </p>

                  <ul
                    className="
                      mt-3
                      space-y-2
                      text-sm
                      text-[#696b79]
                    "
                  >
                    {product.careInstructions.map(
                      (
                        instruction,
                        index
                      ) => (
                        <li
                          key={`${instruction}-${index}`}
                        >
                          •{" "}
                          {
                            instruction
                          }
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* SPECIFICATIONS */}

            <div>
              <h2
                className="
                  text-xl
                  font-bold
                  uppercase
                  tracking-[0.03em]
                "
              >
                Specifications
              </h2>

              <div
                className="
                  mt-6
                  grid
                  grid-cols-2
                  gap-x-8
                "
              >
                {product.specifications &&
                  typeof product.specifications ===
                    "object" &&
                  Object.entries(
                    product.specifications
                  ).map(
                    ([
                      label,
                      value,
                    ]) => (
                      <div
                        key={
                          label
                        }
                        className="
                          border-b
                          border-[#eaeaec]
                          py-4
                        "
                      >
                        <p
                          className="
                            text-[11px]
                            text-[#94969f]
                          "
                        >
                          {label}
                        </p>

                        <p
                          className="
                            mt-1
                            text-sm
                            font-medium
                            text-[#282c3f]
                          "
                        >
                          {value}
                        </p>
                      </div>
                    )
                  )}

                {product.material && (
                  <div
                    className="
                      border-b
                      border-[#eaeaec]
                      py-4
                    "
                  >
                    <p
                      className="
                        text-[11px]
                        text-[#94969f]
                      "
                    >
                      Material
                    </p>

                    <p
                      className="
                        mt-1
                        text-sm
                        font-medium
                      "
                    >
                      {
                        product.material
                      }
                    </p>
                  </div>
                )}

                {product.gender && (
                  <div
                    className="
                      border-b
                      border-[#eaeaec]
                      py-4
                    "
                  >
                    <p
                      className="
                        text-[11px]
                        text-[#94969f]
                      "
                    >
                      Gender
                    </p>

                    <p
                      className="
                        mt-1
                        text-sm
                        font-medium
                      "
                    >
                      {
                        product.gender
                      }
                    </p>
                  </div>
                )}

                {product.sku && (
                  <div
                    className="
                      border-b
                      border-[#eaeaec]
                      py-4
                    "
                  >
                    <p
                      className="
                        text-[11px]
                        text-[#94969f]
                      "
                    >
                      SKU
                    </p>

                    <p
                      className="
                        mt-1
                        break-all
                        text-sm
                        font-medium
                      "
                    >
                      {product.sku}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            RATINGS & REVIEWS
        ================================================= */}

        <section
          className="
            border-t
            border-[#eaeaec]
            bg-white
            py-10
            lg:py-14
          "
        >
          <div
            className="
              mx-auto
              max-w-[1600px]
              px-4
              sm:px-6
              lg:px-8
            "
          >
            <h2
              className="
                text-xl
                font-bold
                uppercase
                tracking-[0.03em]
              "
            >
              Ratings & Reviews
            </h2>

            <div
              className="
                mt-8
                grid
                gap-10
                lg:grid-cols-[0.8fr_1.2fr]
              "
            >
              {/* RATING SUMMARY */}

              <div
                className="
                  border-r-0
                  border-[#eaeaec]
                  lg:border-r
                  lg:pr-10
                "
              >
                <div
                  className="
                    flex
                    items-end
                    gap-3
                  "
                >
                  <span
                    className="
                      text-5xl
                      font-semibold
                      text-[#282c3f]
                    "
                  >
                    {averageRating}
                  </span>

                  <span
                    className="
                      pb-1
                      text-2xl
                      text-green-600
                    "
                  >
                    ★
                  </span>
                </div>

                <p
                  className="
                    mt-2
                    text-sm
                    text-[#696b79]
                  "
                >
                  Based on{" "}
                  {
                    allReviews.length
                  }{" "}
                  review
                  {allReviews.length !==
                  1
                    ? "s"
                    : ""}
                </p>

                <div
                  className="
                    mt-6
                    space-y-2
                  "
                >
                  {ratingBreakdown.map(
                    (item) => (
                      <div
                        key={
                          item.rating
                        }
                        className="
                          grid
                          grid-cols-[28px_1fr_28px]
                          items-center
                          gap-3
                        "
                      >
                        <span
                          className="
                            text-xs
                            text-[#696b79]
                          "
                        >
                          {
                            item.rating
                          }
                          ★
                        </span>

                        <div
                          className="
                            h-1.5
                            overflow-hidden
                            bg-[#eaeaec]
                          "
                        >
                          <div
                            className="
                              h-full
                              bg-green-600
                            "
                            style={{
                              width:
                                `${item.percentage}%`,
                            }}
                          />
                        </div>

                        <span
                          className="
                            text-right
                            text-[10px]
                            text-[#94969f]
                          "
                        >
                          {
                            item.count
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>

                {/* REVIEW FORM */}

                <form
                  onSubmit={
                    handleReviewSubmit
                  }
                  className="
                    mt-9
                    border-t
                    border-[#eaeaec]
                    pt-7
                  "
                >
                  <h3
                    className="
                      text-sm
                      font-bold
                      uppercase
                    "
                  >
                    Write A Review
                  </h3>

                  <input
                    type="text"
                    value={reviewName}
                    onChange={(
                      event
                    ) =>
                      setReviewName(
                        event.target.value
                      )
                    }
                    placeholder="Your name"
                    className="
                      mt-4
                      w-full
                      border
                      border-[#d4d5d9]
                      px-4
                      py-3
                      text-sm
                      outline-none
                      focus:border-orange-500
                    "
                  />

                  <select
                    value={
                      reviewRating
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewRating(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="
                      mt-3
                      w-full
                      border
                      border-[#d4d5d9]
                      bg-white
                      px-4
                      py-3
                      text-sm
                      outline-none
                    "
                  >
                    <option value={5}>
                      5 Stars
                    </option>

                    <option value={4}>
                      4 Stars
                    </option>

                    <option value={3}>
                      3 Stars
                    </option>

                    <option value={2}>
                      2 Stars
                    </option>

                    <option value={1}>
                      1 Star
                    </option>
                  </select>

                  <textarea
                    value={
                      reviewComment
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewComment(
                        event.target.value
                      )
                    }
                    rows={4}
                    placeholder="Write your review..."
                    className="
                      mt-3
                      w-full
                      resize-none
                      border
                      border-[#d4d5d9]
                      px-4
                      py-3
                      text-sm
                      outline-none
                      focus:border-orange-500
                    "
                  />

                  <button
                    type="submit"
                    className="
                      mt-3
                      bg-[#282c3f]
                      px-6
                      py-3
                      text-xs
                      font-bold
                      uppercase
                      text-white
                    "
                  >
                    Submit Review
                  </button>
                </form>
              </div>

              {/* REVIEW LIST */}

              <div>
                <h3
                  className="
                    text-sm
                    font-bold
                    uppercase
                  "
                >
                  Customer Reviews
                </h3>

                {allReviews.length >
                0 ? (
                  <div
                    className="
                      mt-5
                      divide-y
                      divide-[#eaeaec]
                    "
                  >
                    {allReviews.map(
                      (
                        review,
                        index
                      ) => (
                        <article
                          key={
                            review.id ||
                            index
                          }
                          className="
                            py-5
                            first:pt-0
                          "
                        >
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-3
                            "
                          >
                            <span
                              className="
                                bg-green-600
                                px-2
                                py-1
                                text-[11px]
                                font-bold
                                text-white
                              "
                            >
                              {
                                review.rating
                              }{" "}
                              ★
                            </span>

                            <span
                              className="
                                text-sm
                                font-bold
                                text-[#282c3f]
                              "
                            >
                              {
                                review.name
                              }
                            </span>

                            {review.verified && (
                              <span
                                className="
                                  text-[10px]
                                  font-semibold
                                  text-green-600
                                "
                              >
                                Verified
                              </span>
                            )}

                            {review.createdAt && (
                              <span
                                className="
                                  text-[10px]
                                  text-[#94969f]
                                "
                              >
                                {formatReviewDate(
                                  review.createdAt
                                )}
                              </span>
                            )}
                          </div>

                          <p
                            className="
                              mt-3
                              text-sm
                              leading-6
                              text-[#696b79]
                            "
                          >
                            {
                              review.comment
                            }
                          </p>
                        </article>
                      )
                    )}
                  </div>
                ) : (
                  <div
                    className="
                      mt-5
                      border
                      border-[#eaeaec]
                      p-8
                      text-center
                    "
                  >
                    <p
                      className="
                        text-sm
                        text-[#696b79]
                      "
                    >
                      No reviews yet.
                      Be the first to
                      review this product.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            RELATED PRODUCTS
        ================================================= */}

        {relatedProducts.length >
          0 && (
          <section
            className="
              border-t
              border-[#eaeaec]
              bg-white
              py-10
              lg:py-14
            "
          >
            <div
              className="
                mx-auto
                max-w-[1600px]
                px-4
                sm:px-6
                lg:px-8
              "
            >
              <div
                className="
                  mb-7
                  flex
                  items-end
                  justify-between
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-[0.18em]
                      text-orange-600
                    "
                  >
                    Recommended
                  </p>

                  <h2
                    className="
                      mt-2
                      text-xl
                      font-bold
                      uppercase
                    "
                  >
                    Similar Products
                  </h2>
                </div>

                <Link
                  to="/shop"
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    text-orange-600
                  "
                >
                  View All →
                </Link>
              </div>

              <div
                className="
                  hide-scrollbar
                  flex
                  gap-3
                  overflow-x-auto
                  md:grid
                  md:grid-cols-4
                  md:overflow-visible
                  xl:grid-cols-5
                "
              >
                {relatedProducts.map(
                  (item) => {
                    const wishlisted =
                      wishlist.some(
                        (
                          wishlistItem
                        ) =>
                          String(
                            wishlistItem.id
                          ) ===
                          String(
                            item.id
                          )
                      );

                    return (
                      <div
                        key={
                          item.id
                        }
                        className="
                          w-[68%]
                          shrink-0
                          sm:w-[42%]
                          md:w-auto
                        "
                      >
                        <ProductCard
                          id={item.id}
                          name={
                            item.name
                          }
                          category={
                            item.category
                          }
                          brand={
                            item.brand
                          }
                          price={
                            item.price
                          }
                          rating={
                            item.rating
                          }
                          reviewCount={
                            item.reviewCount
                          }
                          discount={
                            item.discount
                          }
                          image={
                            item.image
                          }
                          badge={
                            item.badge
                          }
                          stock={getTotalProductStock(
                            item
                          )}
                          wishlist={
                            wishlisted
                          }
                          onWishlist={() =>
                            toggleWishlist?.(
                              item
                            )
                          }
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </section>
        )}

        {/* =================================================
            RECENTLY VIEWED
        ================================================= */}

        {recentlyViewedProducts.length >
          0 && (
          <section
            className="
              border-t
              border-[#eaeaec]
              bg-[#fafafa]
              py-10
              lg:py-14
            "
          >
            <div
              className="
                mx-auto
                max-w-[1600px]
                px-4
                sm:px-6
                lg:px-8
              "
            >
              <div
                className="
                  mb-7
                  flex
                  items-end
                  justify-between
                  gap-4
                "
              >
                <div>
                  <p
                    className="
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-[0.18em]
                      text-[#94969f]
                    "
                  >
                    Your History
                  </p>

                  <h2
                    className="
                      mt-2
                      text-xl
                      font-bold
                      uppercase
                    "
                  >
                    Recently Viewed
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    clearRecentlyViewed
                  }
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    text-[#696b79]
                    hover:text-orange-600
                  "
                >
                  Clear
                </button>
              </div>

              <div
                className="
                  hide-scrollbar
                  flex
                  gap-3
                  overflow-x-auto
                  md:grid
                  md:grid-cols-4
                  md:overflow-visible
                  xl:grid-cols-5
                "
              >
                {recentlyViewedProducts.map(
                  (item) => {
                    const wishlisted =
                      wishlist.some(
                        (
                          wishlistItem
                        ) =>
                          String(
                            wishlistItem.id
                          ) ===
                          String(
                            item.id
                          )
                      );

                    return (
                      <div
                        key={
                          item.id
                        }
                        className="
                          w-[68%]
                          shrink-0
                          sm:w-[42%]
                          md:w-auto
                        "
                      >
                        <ProductCard
                          id={item.id}
                          name={
                            item.name
                          }
                          category={
                            item.category
                          }
                          brand={
                            item.brand
                          }
                          price={
                            item.price
                          }
                          rating={
                            item.rating
                          }
                          reviewCount={
                            item.reviewCount
                          }
                          discount={
                            item.discount
                          }
                          image={
                            item.image
                          }
                          badge={
                            item.badge
                          }
                          stock={getTotalProductStock(
                            item
                          )}
                          wishlist={
                            wishlisted
                          }
                          onWishlist={() =>
                            toggleWishlist?.(
                              item
                            )
                          }
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}

export default ProductPage;