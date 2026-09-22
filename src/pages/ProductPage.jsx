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

function ProductPage({
  addToCart,
  buyNow,
  wishlist = [],
  toggleWishlist,
}) {
  const { id } = useParams();
  const navigate = useNavigate();

  // ======================================================
  // FIND PRODUCT
  // ======================================================

  const product = products.find(
    (item) => String(item.id) === String(id)
  );

  // ======================================================
  // PRODUCT STATES
  // ======================================================

  const [quantity, setQuantity] = useState(1);

  const [selectedSize, setSelectedSize] =
    useState("");

  const [selectedColor, setSelectedColor] =
    useState("");

  const [selectedImage, setSelectedImage] =
    useState("");

  const [isZoomed, setIsZoomed] =
    useState(false);

  // ======================================================
  // ACTION MESSAGE
  // ======================================================

  const [actionMessage, setActionMessage] =
    useState("");

  // ======================================================
  // DELIVERY STATES
  // ======================================================

  const [pincode, setPincode] =
    useState("");

  const [deliveryMessage, setDeliveryMessage] =
    useState("");

  const [isCheckingDelivery, setIsCheckingDelivery] =
    useState(false);

  // ======================================================
  // REVIEW STATES
  // ======================================================

  const [reviewName, setReviewName] =
    useState("");

  const [reviewRating, setReviewRating] =
    useState(5);

  const [reviewComment, setReviewComment] =
    useState("");

  const [userReviews, setUserReviews] =
    useState([]);

  // ======================================================
  // SHARE STATE
  // ======================================================

  const [shareMessage, setShareMessage] =
    useState("");

  // ======================================================
  // RECENTLY VIEWED
  // ======================================================

  const [
    recentlyViewedIds,
    setRecentlyViewedIds,
  ] = useState([]);

  // ======================================================
  // TIMER REFERENCES
  // ======================================================

  const deliveryTimerRef =
    useRef(null);

  const shareTimerRef =
    useRef(null);

  const actionTimerRef =
    useRef(null);

  // ======================================================
  // PRODUCT OPTIONS
  // ======================================================

  const sizes = product?.sizes || [];
  const colors = product?.colors || [];

  const hasSizeOptions =
    sizes.length > 0;

  const hasColorOptions =
    colors.length > 0;

  // ======================================================
  // PRODUCT INITIALIZATION
  // ======================================================

  useEffect(() => {
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

    // ----------------------------------------------------
    // MAIN IMAGE
    // ----------------------------------------------------

    setSelectedImage(
      product.image || ""
    );

    // ----------------------------------------------------
    // FIND FIRST AVAILABLE COLOR
    // ----------------------------------------------------

    let firstAvailableColor =
      colors[0] || "";

    if (
      product.variants &&
      colors.length > 0
    ) {
      const availableColor =
        colors.find((color) => {
          if (hasSizeOptions) {
            return sizes.some(
              (size) =>
                Number(
                  product.variants?.[
                    color
                  ]?.[size] ?? 0
                ) > 0
            );
          }

          return (
            Number(
              product.variants?.[
                color
              ]?.default ?? 0
            ) > 0
          );
        });

      firstAvailableColor =
        availableColor || "";
    }

    setSelectedColor(
      firstAvailableColor
    );

    // ----------------------------------------------------
    // FIND FIRST AVAILABLE SIZE
    // ----------------------------------------------------

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
              product.variants?.[
                firstAvailableColor
              ]?.[size] ?? 0
            ) > 0
        );

      firstAvailableSize =
        availableSize || "";
    }

    setSelectedSize(
      firstAvailableSize
    );

    // ----------------------------------------------------
    // RESET QUANTITY
    // ----------------------------------------------------

    setQuantity(1);

    // ----------------------------------------------------
    // RESET DELIVERY
    // ----------------------------------------------------

    setPincode("");
    setDeliveryMessage("");
    setIsCheckingDelivery(false);

    // ----------------------------------------------------
    // RESET SHARE
    // ----------------------------------------------------

    setShareMessage("");

    // ----------------------------------------------------
    // RESET ACTION MESSAGE
    // ----------------------------------------------------

    setActionMessage("");

    // ====================================================
    // LOAD USER REVIEWS
    // ====================================================

    const savedReviews =
      localStorage.getItem(
        "gymdrobe-reviews"
      );

    if (!savedReviews) {
      setUserReviews([]);
    } else {
      try {
        const allReviews =
          JSON.parse(savedReviews);

        if (
          allReviews &&
          typeof allReviews === "object" &&
          !Array.isArray(allReviews)
        ) {
          setUserReviews(
            Array.isArray(
              allReviews?.[product.id]
            )
              ? allReviews[product.id]
              : []
          );
        } else {
          setUserReviews([]);
        }
      } catch {
        setUserReviews([]);
      }
    }

    // ====================================================
    // RECENTLY VIEWED
    // ====================================================

    const savedRecentlyViewed =
      localStorage.getItem(
        "gymdrobe-recently-viewed"
      );

    let recentlyViewed = [];

    if (savedRecentlyViewed) {
      try {
        const parsed =
          JSON.parse(
            savedRecentlyViewed
          );

        if (Array.isArray(parsed)) {
          recentlyViewed = parsed;
        }
      } catch {
        recentlyViewed = [];
      }
    }

    recentlyViewed =
      recentlyViewed.filter(
        (itemId) =>
          String(itemId) !==
          String(product.id)
      );

    recentlyViewed.unshift(
      product.id
    );

    recentlyViewed =
      recentlyViewed.slice(0, 6);

    setRecentlyViewedIds(
      recentlyViewed
    );

    localStorage.setItem(
      "gymdrobe-recently-viewed",
      JSON.stringify(recentlyViewed)
    );
  }, [product]);

  // ======================================================
  // CLEANUP TIMERS
  // ======================================================

  useEffect(() => {
    return () => {
      if (deliveryTimerRef.current) {
        clearTimeout(
          deliveryTimerRef.current
        );
      }

      if (shareTimerRef.current) {
        clearTimeout(
          shareTimerRef.current
        );
      }

      if (actionTimerRef.current) {
        clearTimeout(
          actionTimerRef.current
        );
      }
    };
  }, []);

  // ======================================================
  // PRODUCT IMAGES
  // ======================================================

  const productImages = useMemo(() => {
    if (!product) {
      return [];
    }

    return [
      product.image,
      ...(product.images || []),
    ].filter(
      (image, index, array) =>
        image &&
        array.indexOf(image) === index
    );
  }, [product]);

  // ======================================================
  // AVAILABLE SIZES
  // ======================================================

  const availableSizes = useMemo(() => {
    if (!hasSizeOptions) {
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
          product.variants?.[
            selectedColor
          ]?.[size] ?? 0
        ) > 0
    );
  }, [
    product,
    sizes,
    hasSizeOptions,
    selectedColor,
  ]);

  // ======================================================
  // STOCK CALCULATION
  // ======================================================

  const stock = useMemo(() => {
    if (!product) {
      return 0;
    }

    // ----------------------------------------------------
    // PRODUCT WITHOUT VARIANTS
    // ----------------------------------------------------

    if (!product.variants) {
      return Number(
        product.stock ?? 0
      );
    }

    // ----------------------------------------------------
    // PRODUCT WITH COLOR + SIZE
    // ----------------------------------------------------

    if (
      selectedColor &&
      selectedSize
    ) {
      return Number(
        product.variants?.[
          selectedColor
        ]?.[selectedSize] ?? 0
      );
    }

    // ----------------------------------------------------
    // PRODUCT WITH COLOR BUT NO SIZE
    // ----------------------------------------------------

    if (
      selectedColor &&
      !hasSizeOptions
    ) {
      return Number(
        product.variants?.[
          selectedColor
        ]?.default ?? 0
      );
    }

    // ----------------------------------------------------
    // REQUIRED SELECTION NOT MADE
    // ----------------------------------------------------

    return 0;
  }, [
    product,
    selectedColor,
    selectedSize,
    hasSizeOptions,
  ]);

  // ======================================================
  // TOTAL PRODUCT STOCK
  // USED FOR PRODUCT CARDS
  // ======================================================

  function getTotalProductStock(item) {
    if (!item) {
      return 0;
    }

    if (!item.variants) {
      return Number(
        item.stock ?? 0
      );
    }

    let total = 0;

    Object.values(
      item.variants
    ).forEach((variant) => {
      if (
        !variant ||
        typeof variant !== "object"
      ) {
        return;
      }

      Object.values(variant).forEach(
        (value) => {
          total += Number(value || 0);
        }
      );
    });

    return total;
  }

  // ======================================================
  // STOCK MESSAGE
  // ======================================================

  const stockMessage = useMemo(() => {
    if (
      hasSizeOptions &&
      product?.variants &&
      !selectedSize
    ) {
      return {
        text: "Please select a size",
        type: "select",
      };
    }

    if (
      hasColorOptions &&
      product?.variants &&
      !selectedColor
    ) {
      return {
        text: "Please select a color",
        type: "select",
      };
    }

    if (stock <= 0) {
      return {
        text: "Out of stock",
        type: "out",
      };
    }

    if (stock <= 3) {
      return {
        text: `Only ${stock} left in stock`,
        type: "low",
      };
    }

    return {
      text: `${stock} available`,
      type: "available",
    };
  }, [
    stock,
    hasSizeOptions,
    hasColorOptions,
    selectedSize,
    selectedColor,
    product,
  ]);

  // ======================================================
  // KEEP QUANTITY VALID
  // ======================================================

  useEffect(() => {
    if (stock <= 0) {
      setQuantity(1);
      return;
    }

    setQuantity(
      (currentQuantity) =>
        Math.min(
          Math.max(
            Number(
              currentQuantity || 1
            ),
            1
          ),
          stock
        )
    );
  }, [stock]);

  // ======================================================
  // FIX INVALID SIZE WHEN COLOR CHANGES
  // ======================================================

  useEffect(() => {
    if (
      !product ||
      !hasSizeOptions
    ) {
      return;
    }

    if (
      availableSizes.length === 0
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

  // ======================================================
  // ALL REVIEWS
  // ======================================================

  const allReviews = useMemo(() => {
    if (!product) {
      return [];
    }

    return [
      ...(Array.isArray(
        product.reviews
      )
        ? product.reviews
        : []),
      ...(Array.isArray(
        userReviews
      )
        ? userReviews
        : []),
    ];
  }, [
    product,
    userReviews,
  ]);

  // ======================================================
  // AVERAGE RATING
  // ======================================================

  const averageRating = useMemo(() => {
    if (!product) {
      return "0.0";
    }

    if (allReviews.length === 0) {
      return Number(
        product.rating || 0
      ).toFixed(1);
    }

    const total =
      allReviews.reduce(
        (sum, review) =>
          sum +
          Number(
            review.rating || 0
          ),
        0
      );

    return (
      total / allReviews.length
    ).toFixed(1);
  }, [
    product,
    allReviews,
  ]);

  // ======================================================
  // RATING BREAKDOWN
  // ======================================================

  const ratingBreakdown =
    useMemo(() => {
      return [5, 4, 3, 2, 1].map(
        (rating) => {
          const count =
            allReviews.filter(
              (review) =>
                Number(
                  review.rating
                ) === rating
            ).length;

          const percentage =
            allReviews.length > 0
              ? (count /
                  allReviews.length) *
                100
              : 0;

          return {
            rating,
            count,
            percentage,
          };
        }
      );
    }, [allReviews]);

  // ======================================================
  // PRICING
  // ======================================================

  const discountedPrice =
    product
      ? getDiscountedPrice(product)
      : 0;

  const originalPrice =
    product
      ? Number(
          product.price || 0
        )
      : 0;

  const savings = Math.max(
    originalPrice -
      discountedPrice,
    0
  );

  // ======================================================
  // WISHLIST STATUS
  // ======================================================

  const isWishlisted =
    product
      ? wishlist.some(
          (item) =>
            item.id === product.id
        )
      : false;

  // ======================================================
  // RELATED PRODUCTS
  // ======================================================

  const relatedProducts = useMemo(() => {
    if (!product) {
      return [];
    }

    const scoredProducts =
      products
        .filter(
          (item) =>
            item.id !== product.id
        )
        .map((item) => {
          let score = 0;

          // Same subcategory
          if (
            item.subcategory &&
            item.subcategory ===
              product.subcategory
          ) {
            score += 5;
          }

          // Same category
          if (
            item.category &&
            item.category ===
              product.category
          ) {
            score += 3;
          }

          // Shared tags
          const sharedTags =
            item.tags?.filter(
              (tag) =>
                product.tags?.includes(
                  tag
                )
            ).length || 0;

          score +=
            sharedTags * 2;

          // Same brand
          if (
            item.brand &&
            product.brand &&
            item.brand ===
              product.brand
          ) {
            score += 2;
          }

          // Similar price
          if (
            Number(item.price) > 0 &&
            Number(product.price) > 0
          ) {
            const priceDifference =
              Math.abs(
                Number(item.price) -
                  Number(product.price)
              ) /
              Number(product.price);

            if (
              priceDifference <= 0.3
            ) {
              score += 1;
            }
          }

          // Featured
          if (
            item.isFeatured
          ) {
            score += 1;
          }

          // Best seller
          if (
            item.isBestSeller
          ) {
            score += 1;
          }

          return {
            item,
            score,
          };
        });

    return scoredProducts
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .map(
        (entry) => entry.item
      )
      .slice(0, 4);
  }, [product]);

  // ======================================================
  // RECENTLY VIEWED PRODUCTS
  // ======================================================

  const recentlyViewedProducts =
    useMemo(() => {
      if (!product) {
        return [];
      }

      return recentlyViewedIds
        .filter(
          (productId) =>
            String(productId) !==
            String(product.id)
        )
        .map((productId) =>
          products.find(
            (item) =>
              String(item.id) ===
              String(productId)
          )
        )
        .filter(Boolean)
        .slice(0, 5);
    }, [
      product,
      recentlyViewedIds,
    ]);

  // ======================================================
  // SHOW ACTION MESSAGE
  // ======================================================

  function showActionMessage(
    message
  ) {
    setActionMessage(message);

    if (actionTimerRef.current) {
      clearTimeout(
        actionTimerRef.current
      );
    }

    actionTimerRef.current =
      setTimeout(() => {
        setActionMessage("");
      }, 3000);
  }

  // ======================================================
  // CLEAR RECENTLY VIEWED
  // ======================================================

  function clearRecentlyViewed() {
    localStorage.removeItem(
      "gymdrobe-recently-viewed"
    );

    setRecentlyViewedIds([]);
  }

  // ======================================================
  // SHARE PRODUCT
  // ======================================================

  async function handleShareProduct() {
    if (!product) {
      return;
    }

    const shareData = {
      title: product.name,
      text: `Check out ${product.name} on GymDrobe.`,
      url: window.location.href,
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
        typeof navigator.clipboard
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
  }

  // ======================================================
  // DELIVERY CHECK
  // ======================================================

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
      product.delivery?.available ===
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

    setIsCheckingDelivery(true);
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

        setIsCheckingDelivery(false);
      }, 700);
  }

  // ======================================================
  // VALIDATE PRODUCT SELECTION
  // ======================================================

  function validateSelection() {
    if (
      hasSizeOptions &&
      !selectedSize
    ) {
      showActionMessage(
        "Please select a size."
      );

      return false;
    }

    if (
      hasColorOptions &&
      !selectedColor
    ) {
      showActionMessage(
        "Please select a color."
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
          stock > 1 ? "s" : ""
        } available.`
      );

      return false;
    }

    return true;
  }

  // ======================================================
  // ADD TO CART
  // ======================================================

  function handleAddToCart() {
    if (!product) {
      return;
    }

    if (!validateSelection()) {
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

    addToCart(
      product,
      quantity,
      selectedSize || null,
      selectedColor || null
    );
  }

  // ======================================================
  // BUY NOW
  // ======================================================

  function handleBuyNow() {
    if (!product) {
      return;
    }

    if (!validateSelection()) {
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

    const success = buyNow(
      product,
      quantity,
      selectedSize || null,
      selectedColor || null
    );

    if (success) {
      navigate("/checkout");
    }
  }

  // ======================================================
  // QUANTITY
  // ======================================================

  function increaseQuantity() {
    if (stock <= 0) {
      return;
    }

    setQuantity(
      (currentQuantity) =>
        Math.min(
          Number(
            currentQuantity || 1
          ) + 1,
          stock
        )
    );
  }

  function decreaseQuantity() {
    setQuantity(
      (currentQuantity) =>
        Math.max(
          1,
          Number(
            currentQuantity || 1
          ) - 1
        )
    );
  }

  // ======================================================
  // SIZE SELECTION
  // ======================================================

  function handleSizeChange(size) {
    if (
      !availableSizes.includes(
        size
      )
    ) {
      return;
    }

    setSelectedSize(size);
    setQuantity(1);
    setActionMessage("");
  }

  // ======================================================
  // COLOR SELECTION
  // ======================================================

  function handleColorChange(color) {
    if (!colors.includes(color)) {
      return;
    }

    // Check color stock
    let colorStock = 0;

    if (product?.variants) {
      if (hasSizeOptions) {
        colorStock =
          sizes.reduce(
            (
              total,
              size
            ) =>
              total +
              Number(
                product.variants?.[
                  color
                ]?.[size] ?? 0
              ),
            0
          );
      } else {
        colorStock =
          Number(
            product.variants?.[
              color
            ]?.default ?? 0
          );
      }
    } else {
      colorStock =
        Number(
          product?.stock ?? 0
        );
    }

    if (colorStock <= 0) {
      showActionMessage(
        `${color} is currently out of stock.`
      );

      return;
    }

    setSelectedColor(color);
    setQuantity(1);
    setActionMessage("");

    // ----------------------------------------------------
    // AUTOMATICALLY SELECT AVAILABLE SIZE
    // ----------------------------------------------------

    if (
      product?.variants &&
      hasSizeOptions
    ) {
      const firstAvailableSize =
        sizes.find(
          (size) =>
            Number(
              product.variants?.[
                color
              ]?.[size] ?? 0
            ) > 0
        );

      setSelectedSize(
        firstAvailableSize || ""
      );
    }
  }

  // ======================================================
  // REVIEW SUBMIT
  // ======================================================

  function handleReviewSubmit(e) {
    e.preventDefault();

    if (!product) {
      return;
    }

    const trimmedName =
      reviewName.trim();

    const trimmedComment =
      reviewComment.trim();

    if (!trimmedName) {
      showActionMessage(
        "Please enter your name."
      );

      return;
    }

    if (
      trimmedName.length < 2
    ) {
      showActionMessage(
        "Please enter a valid name."
      );

      return;
    }

    if (!trimmedComment) {
      showActionMessage(
        "Please write your review."
      );

      return;
    }

    if (
      trimmedComment.length < 5
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
      name: trimmedName,
      rating: Number(
        reviewRating
      ),
      comment:
        trimmedComment,
      verified: false,
      createdAt:
        new Date().toISOString(),
    };

    const savedReviews =
      localStorage.getItem(
        "gymdrobe-reviews"
      );

    let allReviewsData = {};

    if (savedReviews) {
      try {
        const parsed =
          JSON.parse(savedReviews);

        if (
          parsed &&
          typeof parsed ===
            "object" &&
          !Array.isArray(parsed)
        ) {
          allReviewsData = parsed;
        }
      } catch {
        allReviewsData = {};
      }
    }

    const existingReviews =
      Array.isArray(
        allReviewsData[
          product.id
        ]
      )
        ? allReviewsData[
            product.id
          ]
        : [];

    allReviewsData[product.id] =
      [
        ...existingReviews,
        newReview,
      ];

    localStorage.setItem(
      "gymdrobe-reviews",
      JSON.stringify(
        allReviewsData
      )
    );

    setUserReviews(
      (currentReviews) => [
        ...currentReviews,
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

  // ======================================================
  // PRODUCT NOT FOUND
  // ======================================================

  if (!product) {
    return (
      <section
        className="
          min-h-screen
          flex
          items-center
          justify-center
          px-4
          sm:px-6
          bg-gray-50
          text-black
        "
      >
        <div className="text-center">
          <div className="text-6xl mb-5">
            😕
          </div>

          <h1
            className="
              text-3xl
              sm:text-4xl
              font-black
              mb-4
            "
          >
            Product Not Found
          </h1>

          <p
            className="
              text-gray-500
              mb-6
            "
          >
            The product you're looking
            for doesn't exist or may
            have been removed.
          </p>

          <Link
            to="/shop"
            className="
              inline-block
              bg-orange-600
              hover:bg-orange-700
              text-white
              px-6
              py-3
              rounded-lg
              font-bold
              transition
            "
          >
            Back to Shop
          </Link>
        </div>
      </section>
    );
  }

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <section
      className="
        bg-gray-50
        text-black
        min-h-screen
        py-6
        sm:py-10
        md:py-12
        px-3
        sm:px-6
      "
    >
      <div className="max-w-7xl mx-auto">

        {/* ==================================================
            BREADCRUMB
        ================================================== */}

        <nav
          aria-label="Breadcrumb"
          className="
            flex
            flex-wrap
            items-center
            gap-2
            text-xs
            sm:text-sm
            text-gray-500
            mb-5
            sm:mb-7
          "
        >
          <Link
            to="/"
            className="
              hover:text-orange-600
              transition
            "
          >
            Home
          </Link>

          <span>/</span>

          <Link
            to="/shop"
            className="
              hover:text-orange-600
              transition
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
                  transition
                "
              >
                {product.category}
              </Link>
            </>
          )}

          {product.subcategory && (
            <>
              <span>/</span>

              <span className="text-gray-900 font-medium">
                {product.subcategory}
              </span>
            </>
          )}
        </nav>

        {/* ==================================================
            PRODUCT MAIN SECTION
        ================================================== */}

        <div
          className="
            grid
            lg:grid-cols-2
            gap-7
            lg:gap-12
            bg-white
            rounded-2xl
            sm:rounded-3xl
            p-4
            sm:p-6
            md:p-10
            shadow-sm
          "
        >

          {/* ==================================================
              IMAGE GALLERY
          ================================================== */}

          <div className="min-w-0">

            <div
              className="
                relative
                bg-gray-100
                rounded-xl
                sm:rounded-2xl
                overflow-hidden
                h-[360px]
                sm:h-[450px]
                md:h-[500px]
                cursor-zoom-in
              "
              onMouseEnter={() =>
                setIsZoomed(true)
              }
              onMouseLeave={() =>
                setIsZoomed(false)
              }
              onFocus={() =>
                setIsZoomed(true)
              }
              onBlur={() =>
                setIsZoomed(false)
              }
              tabIndex={0}
            >
              <img
                src={
                  selectedImage ||
                  product.image
                }
                alt={product.name}
                className={`
                  w-full
                  h-full
                  object-cover
                  transition-transform
                  duration-500
                  ${
                    isZoomed
                      ? "scale-110"
                      : "scale-100"
                  }
                `}
              />

              {/* BADGE */}

              {product.badge && (
                <span
                  className="
                    absolute
                    top-3
                    left-3
                    sm:top-5
                    sm:left-5
                    bg-gray-900
                    text-white
                    text-xs
                    sm:text-sm
                    px-3
                    py-1.5
                    rounded-full
                    font-bold
                  "
                >
                  {product.badge}
                </span>
              )}

              {/* DISCOUNT */}

              {Number(
                product.discount || 0
              ) > 0 && (
                <span
                  className="
                    absolute
                    bottom-3
                    left-3
                    sm:bottom-5
                    sm:left-5
                    bg-orange-600
                    text-white
                    text-xs
                    sm:text-sm
                    px-3
                    sm:px-4
                    py-1.5
                    rounded-full
                    font-bold
                  "
                >
                  {product.discount}% OFF
                </span>
              )}

              {/* OUT OF STOCK */}

              {stock <= 0 &&
                !(
                  hasSizeOptions &&
                  !selectedSize
                ) &&
                !(
                  hasColorOptions &&
                  !selectedColor
                ) && (
                  <span
                    className="
                      absolute
                      top-3
                      right-3
                      sm:top-5
                      sm:right-5
                      bg-red-600
                      text-white
                      text-xs
                      sm:text-sm
                      px-3
                      py-1.5
                      rounded-full
                      font-bold
                    "
                  >
                    OUT OF STOCK
                  </span>
                )}
            </div>

            {/* THUMBNAILS */}

            {productImages.length >
              0 && (
              <div
                className="
                  grid
                  grid-cols-4
                  gap-2
                  sm:gap-4
                  mt-3
                  sm:mt-4
                "
              >
                {productImages.map(
                  (image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      onClick={() =>
                        setSelectedImage(
                          image
                        )
                      }
                      aria-label={`View ${product.name} image ${
                        index + 1
                      }`}
                      className={`
                        rounded-lg
                        sm:rounded-xl
                        overflow-hidden
                        border-2
                        transition
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
                          w-full
                          h-20
                          sm:h-24
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
                flex-wrap
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
                  inline-flex
                  items-center
                  gap-2
                  px-4
                  py-2.5
                  rounded-lg
                  border
                  border-gray-200
                  bg-white
                  hover:border-gray-900
                  text-sm
                  font-semibold
                  transition
                "
              >
                🔗 Share Product
              </button>

              {shareMessage && (
                <span className="text-sm text-green-600 font-semibold">
                  {shareMessage}
                </span>
              )}
            </div>
          </div>

          {/* ==================================================
              PRODUCT DETAILS
          ================================================== */}

          <div className="min-w-0">

            {/* CATEGORY */}

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
                mb-3
              "
            >
              <span
                className="
                  text-orange-600
                  text-xs
                  sm:text-sm
                  font-bold
                  uppercase
                  tracking-wider
                "
              >
                {product.category}
              </span>

              {product.subcategory && (
                <>
                  <span className="text-gray-300">
                    /
                  </span>

                  <span
                    className="
                      text-gray-500
                      text-xs
                      sm:text-sm
                    "
                  >
                    {product.subcategory}
                  </span>
                </>
              )}
            </div>

            {/* NAME */}

            <h1
              className="
                text-3xl
                sm:text-4xl
                md:text-5xl
                font-black
                leading-tight
                mb-4
                sm:mb-5
              "
            >
              {product.name}
            </h1>

            {/* BRAND */}

            {product.brand && (
              <p
                className="
                  text-sm
                  text-gray-500
                  mb-4
                "
              >
                Brand:{" "}
                <span className="font-bold text-gray-900">
                  {product.brand}
                </span>
              </p>
            )}

            {/* RATING */}

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
                sm:gap-4
                mb-5
                sm:mb-6
              "
            >
              <span
                className="
                  bg-green-600
                  text-white
                  px-2.5
                  py-1
                  rounded-md
                  text-sm
                  font-bold
                "
              >
                ⭐ {averageRating}
              </span>

              <span
                className="
                  text-sm
                  sm:text-base
                  text-gray-500
                "
              >
                {allReviews.length}{" "}
                {allReviews.length === 1
                  ? "review"
                  : "reviews"}
              </span>
            </div>

            {/* PRICE */}

            <div
              className="
                flex
                flex-wrap
                items-center
                gap-3
                mb-3
              "
            >
              <span
                className="
                  text-2xl
                  sm:text-3xl
                  font-black
                "
              >
                ₹
                {discountedPrice.toLocaleString(
                  "en-IN"
                )}
              </span>

              {Number(
                product.discount || 0
              ) > 0 && (
                <span
                  className="
                    text-base
                    sm:text-lg
                    text-gray-400
                    line-through
                  "
                >
                  ₹
                  {originalPrice.toLocaleString(
                    "en-IN"
                  )}
                </span>
              )}

              {Number(
                product.discount || 0
              ) > 0 && (
                <span
                  className="
                    text-sm
                    font-bold
                    text-green-600
                  "
                >
                  {product.discount}% OFF
                </span>
              )}
            </div>

            {/* SAVINGS */}

            {savings > 0 && (
              <p
                className="
                  text-sm
                  text-green-600
                  font-semibold
                  mb-5
                "
              >
                You save ₹
                {savings.toLocaleString(
                  "en-IN"
                )}
              </p>
            )}

            {/* DESCRIPTION */}

            <p
              className="
                text-sm
                sm:text-base
                text-gray-600
                leading-6
                sm:leading-7
                mb-6
                sm:mb-7
              "
            >
              {product.description}
            </p>

            {/* ==================================================
                ACTION MESSAGE
            ================================================== */}

            {actionMessage && (
              <div
                className="
                  mb-5
                  rounded-lg
                  border
                  border-orange-200
                  bg-orange-50
                  px-4
                  py-3
                  text-sm
                  text-orange-700
                  font-semibold
                "
                role="alert"
              >
                {actionMessage}
              </div>
            )}

            {/* ==================================================
                HIGHLIGHTS
            ================================================== */}

            {product.highlights?.length >
              0 && (
              <div className="mb-7">
                <h3 className="font-bold text-lg mb-3">
                  Product Highlights
                </h3>

                <div className="grid sm:grid-cols-2 gap-2.5">
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
                          gap-2
                          bg-gray-50
                          rounded-lg
                          p-3
                        "
                      >
                        <span className="text-green-600 font-bold">
                          ✓
                        </span>

                        <span className="text-sm text-gray-700">
                          {highlight}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* ==================================================
                QUICK INFORMATION
            ================================================== */}

            <div
              className="
                grid
                grid-cols-2
                gap-3
                mb-7
              "
            >
              {product.material && (
                <div
                  className="
                    border
                    border-gray-200
                    rounded-xl
                    p-3
                    sm:p-4
                  "
                >
                  <p className="text-xs text-gray-500 mb-1">
                    Material
                  </p>

                  <p className="text-sm font-semibold">
                    {product.material}
                  </p>
                </div>
              )}

              {product.gender && (
                <div
                  className="
                    border
                    border-gray-200
                    rounded-xl
                    p-3
                    sm:p-4
                  "
                >
                  <p className="text-xs text-gray-500 mb-1">
                    Gender
                  </p>

                  <p className="text-sm font-semibold">
                    {product.gender}
                  </p>
                </div>
              )}

              {product.sku && (
                <div
                  className="
                    border
                    border-gray-200
                    rounded-xl
                    p-3
                    sm:p-4
                  "
                >
                  <p className="text-xs text-gray-500 mb-1">
                    SKU
                  </p>

                  <p className="text-sm font-semibold break-all">
                    {product.sku}
                  </p>
                </div>
              )}

              {product.returnPolicy && (
                <div
                  className="
                    border
                    border-gray-200
                    rounded-xl
                    p-3
                    sm:p-4
                  "
                >
                  <p className="text-xs text-gray-500 mb-1">
                    Returns
                  </p>

                  <p className="text-sm font-semibold">
                    Easy returns
                  </p>
                </div>
              )}
            </div>

            {/* ==================================================
                SIZE
            ================================================== */}

            {hasSizeOptions && (
              <div className="mb-6 sm:mb-7">
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    mb-3
                  "
                >
                  <h3 className="font-bold">
                    Select Size
                  </h3>

                  <span className="text-xs text-gray-500">
                    Required
                  </span>
                </div>

                <div
                  className="
                    flex
                    flex-wrap
                    gap-2
                    sm:gap-3
                  "
                >
                  {sizes.map(
                    (size) => {
                      const isAvailable =
                        availableSizes.includes(
                          size
                        );

                      return (
                        <button
                          type="button"
                          key={size}
                          disabled={
                            !isAvailable
                          }
                          onClick={() =>
                            handleSizeChange(
                              size
                            )
                          }
                          className={`
                            min-w-[52px]
                            px-4
                            sm:px-5
                            py-2.5
                            sm:py-3
                            rounded-lg
                            border
                            text-sm
                            sm:text-base
                            font-semibold
                            transition
                            ${
                              selectedSize ===
                              size
                                ? "bg-orange-600 text-white border-orange-600"
                                : !isAvailable
                                ? "bg-gray-100 text-gray-400 border-gray-200 line-through cursor-not-allowed"
                                : "bg-white hover:border-orange-500"
                            }
                          `}
                        >
                          {size}
                        </button>
                      );
                    }
                  )}
                </div>

                {selectedColor &&
                  product.variants &&
                  availableSizes.length ===
                    0 && (
                    <p className="text-sm text-red-600 mt-3 font-semibold">
                      This color is currently
                      unavailable in all
                      sizes.
                    </p>
                  )}
              </div>
            )}

            {/* ==================================================
                COLOR
            ================================================== */}

            {hasColorOptions && (
              <div className="mb-6 sm:mb-7">
                <h3 className="font-bold mb-3">
                  Select Color
                </h3>

                <div
                  className="
                    flex
                    flex-wrap
                    gap-2
                    sm:gap-3
                  "
                >
                  {colors.map(
                    (color) => {
                      const colorStock =
                        product.variants
                          ? hasSizeOptions
                            ? sizes.reduce(
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
                              )
                            : Number(
                                product
                                  .variants?.[
                                  color
                                ]?.default ??
                                  0
                              )
                          : Number(
                              product.stock ??
                                0
                            );

                      const isColorOut =
                        colorStock <= 0;

                      return (
                        <button
                          type="button"
                          key={color}
                          disabled={
                            isColorOut
                          }
                          onClick={() =>
                            handleColorChange(
                              color
                            )
                          }
                          className={`
                            px-4
                            sm:px-5
                            py-2.5
                            sm:py-3
                            rounded-lg
                            border
                            text-sm
                            sm:text-base
                            font-semibold
                            transition
                            ${
                              selectedColor ===
                              color
                                ? "bg-gray-900 text-white border-gray-900"
                                : isColorOut
                                ? "bg-gray-100 text-gray-400 border-gray-200 line-through cursor-not-allowed"
                                : "bg-white hover:border-gray-900"
                            }
                          `}
                        >
                          {color}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            {/* ==================================================
                DELIVERY
            ================================================== */}

            <div
              className="
                mb-6
                sm:mb-7
                border
                border-gray-200
                rounded-xl
                p-4
                sm:p-5
                bg-gray-50
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  mb-3
                "
              >
                <span className="text-xl">
                  📍
                </span>

                <h3 className="font-bold">
                  Check Delivery
                </h3>
              </div>

              <div
                className="
                  flex
                  flex-col
                  sm:flex-row
                  gap-2
                  sm:gap-3
                "
              >
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => {
                    setPincode(
                      e.target.value
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
                  inputMode="numeric"
                  maxLength={6}
                  className="
                    flex-1
                    border
                    border-gray-300
                    bg-white
                    rounded-lg
                    px-4
                    py-3
                    text-sm
                    outline-none
                    focus:border-orange-500
                    focus:ring-2
                    focus:ring-orange-100
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
                    bg-gray-900
                    hover:bg-black
                    disabled:bg-gray-400
                    text-white
                    px-5
                    py-3
                    rounded-lg
                    font-bold
                    text-sm
                    transition
                  "
                >
                  {isCheckingDelivery
                    ? "CHECKING..."
                    : "CHECK"}
                </button>
              </div>

              {deliveryMessage && (
                <p
                  className={`
                    mt-3
                    text-sm
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
                  mt-4
                  space-y-2
                  text-xs
                  sm:text-sm
                  text-gray-500
                "
              >
                <p>
                  🚚{" "}
                  {product.delivery
                    ?.estimatedDays
                    ? `Delivery in ${product.delivery.estimatedDays}`
                    : "Fast delivery available"}
                </p>

                <p>
                  💰 Free delivery above ₹
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

            {/* ==================================================
                SHIPPING & RETURNS
            ================================================== */}

            <div
              className="
                grid
                sm:grid-cols-3
                gap-3
                mb-6
              "
            >
              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <div className="text-xl mb-2">
                  🚚
                </div>

                <h4 className="font-bold text-sm mb-1">
                  Fast Delivery
                </h4>

                <p className="text-xs text-gray-500">
                  Reliable delivery to
                  serviceable locations.
                </p>
              </div>

              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <div className="text-xl mb-2">
                  ↩️
                </div>

                <h4 className="font-bold text-sm mb-1">
                  Easy Returns
                </h4>

                <p className="text-xs text-gray-500">
                  {product.returnPolicy ||
                    "Return policy available on eligible products."}
                </p>
              </div>

              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <div className="text-xl mb-2">
                  🔒
                </div>

                <h4 className="font-bold text-sm mb-1">
                  Secure Checkout
                </h4>

                <p className="text-xs text-gray-500">
                  Secure payment processing
                  will be connected with
                  the backend.
                </p>
              </div>
            </div>

            {/* ==================================================
                STOCK
            ================================================== */}

            <div className="mb-5">
              {stockMessage.type ===
                "select" && (
                <p
                  className="
                    text-gray-600
                    font-semibold
                    text-sm
                    sm:text-base
                  "
                >
                  ⚙{" "}
                  {
                    stockMessage.text
                  }
                </p>
              )}

              {stockMessage.type ===
                "available" && (
                <p
                  className="
                    text-green-600
                    font-semibold
                    text-sm
                    sm:text-base
                  "
                >
                  ✓{" "}
                  {
                    stockMessage.text
                  }
                </p>
              )}

              {stockMessage.type ===
                "low" && (
                <p
                  className="
                    text-orange-600
                    font-semibold
                    text-sm
                    sm:text-base
                  "
                >
                  🔥{" "}
                  {
                    stockMessage.text
                  }
                </p>
              )}

              {stockMessage.type ===
                "out" && (
                <p
                  className="
                    text-red-600
                    font-semibold
                    text-sm
                    sm:text-base
                  "
                >
                  ✕{" "}
                  {
                    stockMessage.text
                  }
                </p>
              )}
            </div>

            {/* ==================================================
                QUANTITY
            ================================================== */}

            <div
              className="
                flex
                items-center
                gap-3
                mb-6
              "
            >
              <button
                type="button"
                onClick={
                  decreaseQuantity
                }
                disabled={
                  quantity <= 1 ||
                  stock <= 0
                }
                aria-label="Decrease quantity"
                className="
                  w-11
                  h-11
                  rounded-lg
                  bg-gray-200
                  hover:bg-gray-300
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                  font-bold
                  text-lg
                  active:scale-95
                  transition
                "
              >
                −
              </button>

              <span
                className="
                  w-10
                  text-center
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
                  stock <= 0 ||
                  quantity >= stock
                }
                aria-label="Increase quantity"
                className="
                  w-11
                  h-11
                  rounded-lg
                  bg-gray-900
                  text-white
                  hover:bg-black
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                  font-bold
                  text-lg
                  active:scale-95
                  transition
                "
              >
                +
              </button>
            </div>

            {/* ==================================================
                ACTION BUTTONS
            ================================================== */}

            <div
              className="
                flex
                flex-col
                sm:flex-row
                gap-2
                sm:gap-3
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
                  flex-1
                  bg-orange-600
                  hover:bg-orange-700
                  disabled:bg-gray-400
                  text-white
                  py-3.5
                  sm:py-4
                  rounded-xl
                  font-bold
                  text-sm
                  sm:text-base
                  transition
                  active:scale-[0.98]
                "
              >
                {stock > 0
                  ? "ADD TO CART"
                  : "OUT OF STOCK"}
              </button>

              <button
                type="button"
                onClick={
                  handleBuyNow
                }
                disabled={
                  stock <= 0
                }
                className="
                  flex-1
                  bg-gray-900
                  hover:bg-black
                  disabled:bg-gray-400
                  text-white
                  py-3.5
                  sm:py-4
                  rounded-xl
                  font-bold
                  text-sm
                  sm:text-base
                  transition
                  active:scale-[0.98]
                "
              >
                {stock > 0
                  ? "BUY NOW"
                  : "OUT OF STOCK"}
              </button>

              <button
                type="button"
                onClick={() =>
                  toggleWishlist?.(
                    product
                  )
                }
                aria-label={
                  isWishlisted
                    ? "Remove from wishlist"
                    : "Add to wishlist"
                }
                aria-pressed={
                  isWishlisted
                }
                className="
                  w-full
                  sm:w-14
                  h-12
                  sm:h-auto
                  shrink-0
                  bg-gray-100
                  hover:bg-gray-200
                  rounded-xl
                  text-xl
                  sm:text-2xl
                  transition
                  active:scale-95
                "
              >
                {isWishlisted
                  ? "❤️"
                  : "🤍"}
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================
            PRODUCT INFORMATION
        ====================================================== */}

        <div
          className="
            mt-7
            sm:mt-10
            bg-white
            rounded-2xl
            sm:rounded-3xl
            p-4
            sm:p-6
            md:p-10
          "
        >
          <h2
            className="
              text-2xl
              sm:text-3xl
              font-black
              mb-6
            "
          >
            Product Information
          </h2>

          {/* SPECIFICATIONS OBJECT */}

          {product.specifications &&
            typeof product.specifications ===
              "object" &&
            !Array.isArray(
              product.specifications
            ) && (
              <div className="mb-10">
                <h3 className="font-bold text-xl mb-4">
                  Specifications
                </h3>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {Object.entries(
                    product.specifications
                  ).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="
                          grid
                          sm:grid-cols-2
                          border-b
                          last:border-b-0
                          border-gray-200
                        "
                      >
                        <div className="bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">
                          {key}
                        </div>

                        <div className="px-4 py-3 text-sm text-gray-800">
                          {String(
                            value
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {/* SPECIFICATIONS ARRAY */}

          {Array.isArray(
            product.specifications
          ) &&
            product.specifications
              .length > 0 && (
              <div className="mb-10">
                <h3 className="font-bold text-xl mb-4">
                  Specifications
                </h3>

                <div className="grid sm:grid-cols-2 gap-3">
                  {product.specifications.map(
                    (
                      specification,
                      index
                    ) => (
                      <div
                        key={`${specification}-${index}`}
                        className="
                          border
                          border-gray-200
                          rounded-xl
                          p-4
                        "
                      >
                        <p className="text-sm text-gray-700">
                          {
                            specification
                          }
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {/* BASIC PRODUCT DATA */}

          <div
            className="
              grid
              sm:grid-cols-2
              lg:grid-cols-3
              gap-4
            "
          >
            {product.brand && (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">
                  Brand
                </p>

                <p className="font-bold">
                  {product.brand}
                </p>
              </div>
            )}

            {product.category && (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">
                  Category
                </p>

                <p className="font-bold">
                  {product.category}
                </p>
              </div>
            )}

            {product.subcategory && (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">
                  Subcategory
                </p>

                <p className="font-bold">
                  {product.subcategory}
                </p>
              </div>
            )}

            {product.gender && (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">
                  Gender
                </p>

                <p className="font-bold">
                  {product.gender}
                </p>
              </div>
            )}

            {product.material && (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">
                  Material
                </p>

                <p className="font-bold">
                  {product.material}
                </p>
              </div>
            )}

            {product.sku && (
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">
                  SKU
                </p>

                <p className="font-bold break-all">
                  {product.sku}
                </p>
              </div>
            )}
          </div>

          {/* TAGS */}

          {product.tags?.length >
            0 && (
            <div className="mt-7">
              <h3 className="font-bold mb-3">
                Product Tags
              </h3>

              <div className="flex flex-wrap gap-2">
                {product.tags.map(
                  (tag) => (
                    <span
                      key={tag}
                      className="
                        px-3
                        py-1.5
                        bg-gray-100
                        rounded-full
                        text-xs
                        sm:text-sm
                        font-medium
                        text-gray-700
                      "
                    >
                      #{tag}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {/* DESCRIPTION */}

          <div className="mt-7">
            <h3 className="font-bold mb-3">
              Description
            </h3>

            <p
              className="
                text-gray-600
                leading-7
                text-sm
                sm:text-base
              "
            >
              {product.description}
            </p>
          </div>

          {/* CARE INSTRUCTIONS */}

          {product.careInstructions && (
            <div className="mt-8">
              <h3 className="font-bold text-xl mb-4">
                Care Instructions
              </h3>

              {Array.isArray(
                product.careInstructions
              ) ? (
                <ul className="space-y-2">
                  {product.careInstructions.map(
                    (
                      instruction,
                      index
                    ) => (
                      <li
                        key={`${instruction}-${index}`}
                        className="
                          flex
                          items-start
                          gap-2
                          text-sm
                          sm:text-base
                          text-gray-600
                        "
                      >
                        <span className="text-orange-600 font-bold">
                          •
                        </span>

                        <span>
                          {
                            instruction
                          }
                        </span>
                      </li>
                    )
                  )}
                </ul>
              ) : (
                <p className="text-gray-600 leading-7">
                  {
                    product.careInstructions
                  }
                </p>
              )}
            </div>
          )}

          {/* WHAT'S INCLUDED */}

          {product.whatsIncluded && (
            <div className="mt-8">
              <h3 className="font-bold text-xl mb-4">
                What's Included
              </h3>

              {Array.isArray(
                product.whatsIncluded
              ) ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {product.whatsIncluded.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={`${item}-${index}`}
                        className="
                          flex
                          items-center
                          gap-3
                          border
                          border-gray-200
                          rounded-xl
                          p-4
                        "
                      >
                        <span className="text-green-600 font-bold">
                          ✓
                        </span>

                        <span className="text-sm text-gray-700">
                          {item}
                        </span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-gray-600">
                  {
                    product.whatsIncluded
                  }
                </p>
              )}
            </div>
          )}

          {/* RETURN POLICY */}

          {product.returnPolicy && (
            <div className="mt-8">
              <h3 className="font-bold mb-3">
                Return & Replacement
              </h3>

              <div
                className="
                  bg-green-50
                  border
                  border-green-100
                  rounded-xl
                  p-4
                "
              >
                <p
                  className="
                    text-green-700
                    text-sm
                    sm:text-base
                    font-medium
                  "
                >
                  ↩{" "}
                  {
                    product.returnPolicy
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================
            REVIEWS
        ====================================================== */}

        <div
          className="
            mt-7
            sm:mt-10
            bg-white
            rounded-2xl
            sm:rounded-3xl
            p-4
            sm:p-6
            md:p-10
          "
        >
          <h2
            className="
              text-2xl
              sm:text-3xl
              font-black
              mb-6
              sm:mb-8
            "
          >
            Customer Reviews
          </h2>

          <div
            className="
              grid
              lg:grid-cols-3
              gap-8
              lg:gap-10
            "
          >

            {/* RATING SUMMARY */}

            <div>
              <div
                className="
                  text-4xl
                  sm:text-5xl
                  font-black
                  mb-2
                "
              >
                {averageRating}
              </div>

              <p className="mb-6">
                ⭐⭐⭐⭐⭐
              </p>

              <div className="space-y-3">
                {ratingBreakdown.map(
                  (item) => (
                    <div
                      key={item.rating}
                      className="
                        flex
                        items-center
                        gap-2
                        sm:gap-3
                      "
                    >
                      <span
                        className="
                          w-7
                          sm:w-8
                          text-sm
                        "
                      >
                        {item.rating}★
                      </span>

                      <div
                        className="
                          flex-1
                          h-2
                          bg-gray-200
                          rounded-full
                          overflow-hidden
                        "
                      >
                        <div
                          className="
                            h-full
                            bg-orange-500
                          "
                          style={{
                            width: `${item.percentage}%`,
                          }}
                        />
                      </div>

                      <span
                        className="
                          text-xs
                          sm:text-sm
                          text-gray-500
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
            </div>

            {/* REVIEW LIST */}

            <div
              className="
                lg:col-span-2
                space-y-5
              "
            >
              {allReviews.length ===
              0 ? (
                <p className="text-gray-500">
                  No reviews yet.
                </p>
              ) : (
                allReviews.map(
                  (review, index) => {
                    const safeRating =
                      Math.min(
                        5,
                        Math.max(
                          0,
                          Number(
                            review.rating ||
                              0
                          )
                        )
                      );

                    return (
                      <div
                        key={
                          review.id ??
                          `${review.name}-${index}`
                        }
                        className="
                          border-b
                          border-gray-200
                          pb-5
                        "
                      >
                        <div
                          className="
                            flex
                            flex-col
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                            gap-2
                            mb-2
                          "
                        >
                          <div>
                            <strong>
                              {
                                review.name
                              }
                            </strong>

                            {review.verified && (
                              <span
                                className="
                                  ml-2
                                  text-xs
                                  text-green-600
                                  font-semibold
                                "
                              >
                                ✓ Verified
                              </span>
                            )}
                          </div>

                          <span
                            aria-label={`${safeRating} out of 5 stars`}
                          >
                            {"⭐".repeat(
                              safeRating
                            )}
                          </span>
                        </div>

                        <p
                          className="
                            text-gray-600
                            text-sm
                            sm:text-base
                          "
                        >
                          {
                            review.comment
                          }
                        </p>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>

          {/* REVIEW FORM */}

          <form
            onSubmit={
              handleReviewSubmit
            }
            className="
              mt-8
              sm:mt-12
              border-t
              border-gray-200
              pt-8
              sm:pt-10
            "
          >
            <h3
              className="
                text-xl
                sm:text-2xl
                font-bold
                mb-5
                sm:mb-6
              "
            >
              Write a Review
            </h3>

            <div
              className="
                grid
                md:grid-cols-2
                gap-4
                sm:gap-5
              "
            >
              <input
                type="text"
                value={reviewName}
                onChange={(e) =>
                  setReviewName(
                    e.target.value
                  )
                }
                placeholder="Your name"
                maxLength={50}
                className="
                  w-full
                  border
                  border-gray-300
                  rounded-lg
                  px-4
                  py-3
                  outline-none
                  focus:border-orange-500
                  focus:ring-2
                  focus:ring-orange-100
                "
              />

              <select
                value={
                  reviewRating
                }
                onChange={(e) =>
                  setReviewRating(
                    Number(
                      e.target.value
                    )
                  )
                }
                className="
                  w-full
                  border
                  border-gray-300
                  rounded-lg
                  px-4
                  py-3
                  outline-none
                  focus:border-orange-500
                  focus:ring-2
                  focus:ring-orange-100
                  bg-white
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
            </div>

            <textarea
              value={
                reviewComment
              }
              onChange={(e) =>
                setReviewComment(
                  e.target.value
                )
              }
              placeholder="Write your review..."
              rows="5"
              maxLength={1000}
              className="
                w-full
                border
                border-gray-300
                rounded-lg
                px-4
                py-3
                mt-4
                sm:mt-5
                outline-none
                focus:border-orange-500
                focus:ring-2
                focus:ring-orange-100
                resize-y
              "
            />

            <div className="text-xs text-gray-400 mt-2">
              {reviewComment.length}/1000
            </div>

            <button
              type="submit"
              className="
                mt-4
                sm:mt-5
                w-full
                sm:w-auto
                bg-gray-900
                hover:bg-black
                text-white
                px-7
                py-3
                rounded-lg
                font-bold
                transition
                active:scale-[0.98]
              "
            >
              SUBMIT REVIEW
            </button>
          </form>
        </div>

        {/* ======================================================
            RELATED PRODUCTS
        ====================================================== */}

        {relatedProducts.length >
          0 && (
          <div className="mt-8 sm:mt-12">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <p className="text-orange-600 text-xs font-bold uppercase tracking-wider mb-1">
                  Recommended for you
                </p>

                <h2
                  className="
                    text-2xl
                    sm:text-3xl
                    font-black
                  "
                >
                  YOU MAY ALSO LIKE
                </h2>
              </div>

              <Link
                to="/shop"
                className="
                  hidden
                  sm:inline-block
                  text-sm
                  font-semibold
                  text-gray-500
                  hover:text-orange-600
                "
              >
                View All →
              </Link>
            </div>

            <div
              className="
                grid
                grid-cols-1
                min-[380px]:grid-cols-2
                lg:grid-cols-4
                gap-3
                sm:gap-5
                lg:gap-6
              "
            >
              {relatedProducts.map(
                (item) => {
                  const itemDiscountedPrice =
                    getDiscountedPrice(
                      item
                    );

                  const itemStock =
                    getTotalProductStock(
                      item
                    );

                  return (
                    <Link
                      key={
                        item.id
                      }
                      to={`/product/${item.id}`}
                      className="
                        bg-white
                        rounded-xl
                        sm:rounded-2xl
                        p-3
                        sm:p-4
                        shadow-sm
                        hover:shadow-xl
                        transition
                        overflow-hidden
                      "
                    >
                      <div className="relative">
                        <img
                          src={
                            item.image
                          }
                          alt={
                            item.name
                          }
                          className="
                            w-full
                            h-40
                            sm:h-56
                            lg:h-64
                            object-cover
                            rounded-lg
                            sm:rounded-xl
                            mb-3
                            sm:mb-4
                          "
                        />

                        {item.badge && (
                          <span
                            className="
                              absolute
                              top-2
                              right-2
                              bg-gray-900
                              text-white
                              text-[10px]
                              sm:text-xs
                              px-2
                              py-1
                              rounded-full
                              font-bold
                            "
                          >
                            {
                              item.badge
                            }
                          </span>
                        )}

                        {Number(
                          item.discount ||
                            0
                        ) > 0 && (
                          <span
                            className="
                              absolute
                              top-2
                              left-2
                              bg-orange-600
                              text-white
                              text-[10px]
                              sm:text-xs
                              px-2
                              py-1
                              rounded-full
                              font-bold
                            "
                          >
                            {
                              item.discount
                            }
                            % OFF
                          </span>
                        )}

                        {itemStock <=
                          0 && (
                          <span
                            className="
                              absolute
                              bottom-2
                              left-2
                              bg-red-600
                              text-white
                              text-[10px]
                              px-2
                              py-1
                              rounded-full
                              font-bold
                            "
                          >
                            OUT OF STOCK
                          </span>
                        )}
                      </div>

                      <p
                        className="
                          text-xs
                          text-orange-600
                          font-semibold
                          mb-1
                        "
                      >
                        {
                          item.category
                        }
                      </p>

                      <h3
                        className="
                          font-bold
                          text-sm
                          sm:text-lg
                          line-clamp-2
                        "
                      >
                        {
                          item.name
                        }
                      </h3>

                      <div
                        className="
                          flex
                          items-center
                          gap-2
                          mt-2
                        "
                      >
                        <span className="font-bold">
                          ₹
                          {itemDiscountedPrice.toLocaleString(
                            "en-IN"
                          )}
                        </span>

                        {Number(
                          item.discount ||
                            0
                        ) > 0 && (
                          <span
                            className="
                              text-xs
                              text-gray-400
                              line-through
                            "
                          >
                            ₹
                            {Number(
                              item.price ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </span>
                        )}
                      </div>

                      <div
                        className="
                          text-xs
                          text-gray-500
                          mt-2
                        "
                      >
                        ⭐{" "}
                        {
                          item.rating
                        }
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* ======================================================
            RECENTLY VIEWED
        ====================================================== */}

        {recentlyViewedProducts.length >
          0 && (
          <div className="mt-8 sm:mt-12">
            <div
              className="
                flex
                items-center
                justify-between
                mb-6
                sm:mb-8
              "
            >
              <div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">
                  Your browsing history
                </p>

                <h2
                  className="
                    text-2xl
                    sm:text-3xl
                    font-black
                  "
                >
                  RECENTLY VIEWED
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  clearRecentlyViewed
                }
                className="
                  text-xs
                  sm:text-sm
                  text-gray-500
                  hover:text-black
                  font-semibold
                "
              >
                Clear
              </button>
            </div>

            <div
              className="
                grid
                grid-cols-2
                sm:grid-cols-3
                lg:grid-cols-5
                gap-3
                sm:gap-5
              "
            >
              {recentlyViewedProducts.map(
                (item) => {
                  const itemDiscountedPrice =
                    getDiscountedPrice(
                      item
                    );

                  return (
                    <Link
                      key={
                        item.id
                      }
                      to={`/product/${item.id}`}
                      className="
                        bg-white
                        rounded-xl
                        p-3
                        shadow-sm
                        hover:shadow-lg
                        transition
                        overflow-hidden
                      "
                    >
                      <div className="relative">
                        <img
                          src={
                            item.image
                          }
                          alt={
                            item.name
                          }
                          className="
                            w-full
                            h-36
                            sm:h-48
                            object-cover
                            rounded-lg
                            mb-3
                          "
                        />

                        {Number(
                          item.discount ||
                            0
                        ) > 0 && (
                          <span
                            className="
                              absolute
                              top-2
                              left-2
                              bg-orange-600
                              text-white
                              text-[10px]
                              px-2
                              py-1
                              rounded-full
                              font-bold
                            "
                          >
                            {
                              item.discount
                            }
                            % OFF
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-orange-600 font-semibold mb-1">
                        {
                          item.category
                        }
                      </p>

                      <h3
                        className="
                          font-bold
                          text-sm
                          line-clamp-2
                        "
                      >
                        {
                          item.name
                        }
                      </h3>

                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-bold">
                          ₹
                          {itemDiscountedPrice.toLocaleString(
                            "en-IN"
                          )}
                        </span>

                        {Number(
                          item.discount ||
                            0
                        ) > 0 && (
                          <span
                            className="
                              text-xs
                              text-gray-400
                              line-through
                            "
                          >
                            ₹
                            {Number(
                              item.price ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default ProductPage;