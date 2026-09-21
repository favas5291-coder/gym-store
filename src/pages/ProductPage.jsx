
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import products from "../data/products";

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
    (item) => item.id === Number(id)
  );

  // ======================================================
  // PRODUCT STATES
  // ======================================================

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);

  // ======================================================
  // DELIVERY STATES
  // ======================================================

  const [pincode, setPincode] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [isCheckingDelivery, setIsCheckingDelivery] =
    useState(false);

  // ======================================================
  // REVIEW STATES
  // ======================================================

  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [userReviews, setUserReviews] = useState([]);

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
      return;
    }

    // Main image
    setSelectedImage(product.image || "");

    // First available color
    setSelectedColor(product.colors?.[0] || "");

    // First available size
    setSelectedSize(product.sizes?.[0] || "");

    // Reset quantity
    setQuantity(1);

    // Reset delivery
    setPincode("");
    setDeliveryMessage("");

    // ====================================================
    // LOAD USER REVIEWS
    // ====================================================

    const savedReviews = localStorage.getItem(
      "gymdrobe-reviews"
    );

    if (!savedReviews) {
      setUserReviews([]);
    } else {
      try {
        const allReviews = JSON.parse(savedReviews);

        setUserReviews(
          allReviews[product.id] || []
        );
      } catch {
        setUserReviews([]);
      }
    }

    // ====================================================
    // RECENTLY VIEWED PRODUCTS
    // ====================================================

    const savedRecentlyViewed =
      localStorage.getItem(
        "gymdrobe-recently-viewed"
      );

    let recentlyViewed = [];

    if (savedRecentlyViewed) {
      try {
        recentlyViewed =
          JSON.parse(savedRecentlyViewed);
      } catch {
        recentlyViewed = [];
      }
    }

    // Remove current product if already present
    recentlyViewed = recentlyViewed.filter(
      (itemId) => itemId !== product.id
    );

    // Add current product to beginning
    recentlyViewed.unshift(product.id);

    // Keep only latest 6
    recentlyViewed = recentlyViewed.slice(0, 6);

    localStorage.setItem(
      "gymdrobe-recently-viewed",
      JSON.stringify(recentlyViewed)
    );
  }, [product]);

  // ======================================================
  // IMAGE GALLERY
  // ======================================================

  const productImages = product
    ? [
        product.image,
        ...(product.images || []),
      ].filter(
        (image, index, array) =>
          image &&
          array.indexOf(image) === index
      )
    : [];

  // ======================================================
  // STOCK CALCULATION
  // ======================================================

  let stock = 0;

  if (product) {
    if (product.variants) {
      // Size + Color product
      if (selectedColor && selectedSize) {
        stock =
          product.variants?.[selectedColor]?.[
            selectedSize
          ] ?? 0;
      }

      // Color-only product
      else if (selectedColor) {
        stock =
          product.variants?.[selectedColor]?.default ??
          0;
      }

      else {
        stock = 0;
      }
    } else {
      stock = product.stock ?? 0;
    }
  }

  // ======================================================
  // STOCK MESSAGE
  // ======================================================

  const stockMessage = useMemo(() => {
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
  }, [stock]);

  // ======================================================
  // KEEP QUANTITY VALID
  // ======================================================

  useEffect(() => {
    if (stock <= 0) {
      setQuantity(1);
      return;
    }

    setQuantity((currentQuantity) =>
      Math.min(
        Math.max(currentQuantity, 1),
        stock
      )
    );
  }, [stock]);

  // ======================================================
  // REVIEWS
  // ======================================================

  const allReviews = product
    ? [
        ...(product.reviews || []),
        ...userReviews,
      ]
    : [];

  // ======================================================
  // AVERAGE RATING
  // ======================================================

  const averageRating =
    product && allReviews.length > 0
      ? (
          allReviews.reduce(
            (total, review) =>
              total + Number(review.rating || 0),
            0
          ) / allReviews.length
        ).toFixed(1)
      : product?.rating || 0;

  // ======================================================
  // RATING BREAKDOWN
  // ======================================================

  const ratingBreakdown = [5, 4, 3, 2, 1].map(
    (rating) => {
      const count = allReviews.filter(
        (review) =>
          Number(review.rating) === rating
      ).length;

      const percentage =
        allReviews.length > 0
          ? (count / allReviews.length) * 100
          : 0;

      return {
        rating,
        count,
        percentage,
      };
    }
  );

  // ======================================================
  // DISCOUNTED PRICE
  // ======================================================

  const discountedPrice = product
    ? Math.round(
        product.price -
          (product.price *
            (product.discount || 0)) /
            100
      )
    : 0;

  // ======================================================
  // SAVINGS
  // ======================================================

  const savings = product
    ? product.price - discountedPrice
    : 0;

  // ======================================================
  // WISHLIST STATUS
  // ======================================================

  const isWishlisted = product
    ? wishlist.some(
        (item) => item.id === product.id
      )
    : false;

  // ======================================================
  // RELATED PRODUCTS
  // ======================================================

  const relatedProducts = useMemo(() => {
    if (!product) return [];

    const sameSubcategory = products.filter(
      (item) =>
        item.subcategory &&
        item.subcategory === product.subcategory &&
        item.id !== product.id
    );

    const sameCategory = products.filter(
      (item) =>
        item.category === product.category &&
        item.id !== product.id
    );

    const sameTags = products.filter(
      (item) =>
        item.id !== product.id &&
        item.tags?.some((tag) =>
          product.tags?.includes(tag)
        )
    );

    const combined = [
      ...sameSubcategory,
      ...sameCategory,
      ...sameTags,
    ];

    const uniqueProducts = combined.filter(
      (item, index, array) =>
        array.findIndex(
          (productItem) =>
            productItem.id === item.id
        ) === index
    );

    return uniqueProducts.slice(0, 4);
  }, [product]);

  // ======================================================
  // RECENTLY VIEWED
  // ======================================================

  const recentlyViewedProducts = useMemo(() => {
    if (!product) return [];

    const saved =
      localStorage.getItem(
        "gymdrobe-recently-viewed"
      );

    if (!saved) return [];

    try {
      const ids = JSON.parse(saved);

      return ids
        .filter(
          (productId) =>
            productId !== product.id
        )
        .map((productId) =>
          products.find(
            (item) =>
              item.id === productId
          )
        )
        .filter(Boolean)
        .slice(0, 5);
    } catch {
      return [];
    }
  }, [product]);

  // ======================================================
  // DELIVERY CHECK
  // ======================================================

  function checkDelivery() {
    const trimmedPincode = pincode.trim();

    if (!/^\d{6}$/.test(trimmedPincode)) {
      setDeliveryMessage(
        "Please enter a valid 6-digit pincode."
      );
      return;
    }

    if (product.delivery?.available === false) {
      setDeliveryMessage(
        "Delivery is currently unavailable for this product."
      );
      return;
    }

    setIsCheckingDelivery(true);
    setDeliveryMessage("");

    setTimeout(() => {
      const firstDigit = Number(
        trimmedPincode[0]
      );

      if (
        firstDigit >= 1 &&
        firstDigit <= 8
      ) {
        setDeliveryMessage(
          `✓ Delivery available. Expected delivery in ${
            product.delivery?.estimatedDays ||
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
  // ADD TO CART
  // ======================================================

  function handleAddToCart() {
    if (
      product.sizes?.length > 0 &&
      !selectedSize
    ) {
      alert("Please select a size.");
      return;
    }

    if (
      product.colors?.length > 0 &&
      !selectedColor
    ) {
      alert("Please select a color.");
      return;
    }

    if (stock <= 0) {
      alert("This product is out of stock.");
      return;
    }

    if (quantity > stock) {
      alert(
        `Only ${stock} item${
          stock > 1 ? "s" : ""
        } available.`
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
    if (
      product.sizes?.length > 0 &&
      !selectedSize
    ) {
      alert("Please select a size.");
      return;
    }

    if (
      product.colors?.length > 0 &&
      !selectedColor
    ) {
      alert("Please select a color.");
      return;
    }

    if (stock <= 0) {
      alert("This product is out of stock.");
      return;
    }

    if (quantity > stock) {
      alert(
        `Only ${stock} item${
          stock > 1 ? "s" : ""
        } available.`
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
    if (stock <= 0) return;

    setQuantity((currentQuantity) =>
      Math.min(
        currentQuantity + 1,
        stock
      )
    );
  }

  function decreaseQuantity() {
    setQuantity((currentQuantity) =>
      Math.max(
        1,
        currentQuantity - 1
      )
    );
  }

  // ======================================================
  // REVIEW SUBMIT
  // ======================================================

  function handleReviewSubmit(e) {
    e.preventDefault();

    if (
      !reviewName.trim() ||
      !reviewComment.trim()
    ) {
      alert(
        "Please enter your name and review."
      );
      return;
    }

    const newReview = {
      id: Date.now(),
      name: reviewName.trim(),
      rating: Number(reviewRating),
      comment: reviewComment.trim(),
      verified: false,
    };

    const savedReviews = localStorage.getItem(
      "gymdrobe-reviews"
    );

    let allReviewsData = {};

    if (savedReviews) {
      try {
        allReviewsData =
          JSON.parse(savedReviews);
      } catch {
        allReviewsData = {};
      }
    }

    allReviewsData[product.id] = [
      ...(allReviewsData[product.id] || []),
      newReview,
    ];

    localStorage.setItem(
      "gymdrobe-reviews",
      JSON.stringify(allReviewsData)
    );

    setUserReviews((currentReviews) => [
      ...currentReviews,
      newReview,
    ]);

    setReviewName("");
    setReviewRating(5);
    setReviewComment("");

    alert(
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
            The product you're looking for
            doesn't exist.
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
            >
              <img
                src={selectedImage}
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

              {product.discount > 0 && (
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

              {stock <= 0 && (
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

            {productImages.length > 0 && (
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
                        setSelectedImage(image)
                      }
                      className={`
                        rounded-lg
                        sm:rounded-xl
                        overflow-hidden
                        border-2
                        transition
                        ${
                          selectedImage === image
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

              {product.discount > 0 && (
                <span
                  className="
                    text-base
                    sm:text-lg
                    text-gray-400
                    line-through
                  "
                >
                  ₹
                  {product.price.toLocaleString(
                    "en-IN"
                  )}
                </span>
              )}

              {product.discount > 0 && (
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
                PRODUCT QUICK INFORMATION
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
                  <p
                    className="
                      text-xs
                      text-gray-500
                      mb-1
                    "
                  >
                    Material
                  </p>

                  <p
                    className="
                      text-sm
                      font-semibold
                    "
                  >
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
                  <p
                    className="
                      text-xs
                      text-gray-500
                      mb-1
                    "
                  >
                    Gender
                  </p>

                  <p
                    className="
                      text-sm
                      font-semibold
                    "
                  >
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
                  <p
                    className="
                      text-xs
                      text-gray-500
                      mb-1
                    "
                  >
                    SKU
                  </p>

                  <p
                    className="
                      text-sm
                      font-semibold
                      break-all
                    "
                  >
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
                  <p
                    className="
                      text-xs
                      text-gray-500
                      mb-1
                    "
                  >
                    Returns
                  </p>

                  <p
                    className="
                      text-sm
                      font-semibold
                    "
                  >
                    Easy returns
                  </p>
                </div>
              )}
            </div>

            {/* ==================================================
                SIZE
            ================================================== */}

            {product.sizes?.length > 0 && (
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

                  <span
                    className="
                      text-xs
                      text-gray-500
                    "
                  >
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
                  {product.sizes.map(
                    (size) => {
                      const sizeStock =
                        selectedColor &&
                        product.variants
                          ? product
                              .variants?.[
                              selectedColor
                            ]?.[size] ?? 0
                          : 0;

                      const isSizeOut =
                        Boolean(
                          product.variants &&
                          selectedColor &&
                          sizeStock <= 0
                        );

                      return (
                        <button
                          type="button"
                          key={size}
                          disabled={isSizeOut}
                          onClick={() => {
                            setSelectedSize(
                              size
                            );
                            setQuantity(1);
                          }}
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
                              selectedSize === size
                                ? "bg-orange-600 text-white border-orange-600"
                                : isSizeOut
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
              </div>
            )}

            {/* ==================================================
                COLOR
            ================================================== */}

            {product.colors?.length > 0 && (
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
                  {product.colors.map(
                    (color) => {
                      const colorStock =
                        product.variants?.[
                          color
                        ]?.default;

                      const isColorOut =
                        product.sizes?.length ===
                          0 &&
                        product.variants &&
                        colorStock !==
                          undefined &&
                        colorStock <= 0;

                      return (
                        <button
                          type="button"
                          key={color}
                          disabled={isColorOut}
                          onClick={() => {
                            setSelectedColor(
                              color
                            );
                            setQuantity(1);
                          }}
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
                              selectedColor === color
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
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    );

                    setDeliveryMessage("");
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
                  onClick={checkDelivery}
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
                  {(
                    product.delivery
                      ?.freeDeliveryAbove ??
                    500
                  ).toLocaleString("en-IN")}
                </p>

                {product.returnPolicy && (
                  <p>
                    ↩ {product.returnPolicy}
                  </p>
                )}
              </div>
            </div>

            {/* ==================================================
                STOCK
            ================================================== */}

            <div className="mb-5">

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
                  ✓ {stockMessage.text}
                </p>
              )}

              {stockMessage.type === "low" && (
                <p
                  className="
                    text-orange-600
                    font-semibold
                    text-sm
                    sm:text-base
                  "
                >
                  🔥 {stockMessage.text}
                </p>
              )}

              {stockMessage.type === "out" && (
                <p
                  className="
                    text-red-600
                    font-semibold
                    text-sm
                    sm:text-base
                  "
                >
                  ✕ {stockMessage.text}
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
                onClick={decreaseQuantity}
                disabled={
                  quantity <= 1 ||
                  stock <= 0
                }
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
                onClick={increaseQuantity}
                disabled={
                  stock <= 0 ||
                  quantity >= stock
                }
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
                onClick={handleAddToCart}
                disabled={stock <= 0}
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
                onClick={handleBuyNow}
                disabled={stock <= 0}
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
                  toggleWishlist?.(product)
                }
                aria-label={
                  isWishlisted
                    ? "Remove from wishlist"
                    : "Add to wishlist"
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

          <div
            className="
              grid
              sm:grid-cols-2
              lg:grid-cols-3
              gap-4
            "
          >
            {product.brand && (
              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <p className="text-xs text-gray-500 mb-1">
                  Brand
                </p>

                <p className="font-bold">
                  {product.brand}
                </p>
              </div>
            )}

            {product.category && (
              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <p className="text-xs text-gray-500 mb-1">
                  Category
                </p>

                <p className="font-bold">
                  {product.category}
                </p>
              </div>
            )}

            {product.subcategory && (
              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <p className="text-xs text-gray-500 mb-1">
                  Subcategory
                </p>

                <p className="font-bold">
                  {product.subcategory}
                </p>
              </div>
            )}

            {product.gender && (
              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <p className="text-xs text-gray-500 mb-1">
                  Gender
                </p>

                <p className="font-bold">
                  {product.gender}
                </p>
              </div>
            )}

            {product.material && (
              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
                <p className="text-xs text-gray-500 mb-1">
                  Material
                </p>

                <p className="font-bold">
                  {product.material}
                </p>
              </div>
            )}

            {product.sku && (
              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                "
              >
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

          {product.tags?.length > 0 && (
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

          {/* RETURN POLICY */}

          {product.returnPolicy && (
            <div className="mt-7">

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
                  ↩ {product.returnPolicy}
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
                        {item.count}
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
              {allReviews.length === 0 ? (
                <p className="text-gray-500">
                  No reviews yet.
                </p>
              ) : (
                allReviews.map(
                  (review) => (
                    <div
                      key={review.id}
                      className="
                        border-b
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
                            {review.name}
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

                        <span>
                          {"⭐".repeat(
                            Math.min(
                              5,
                              Math.max(
                                0,
                                Number(
                                  review.rating
                                )
                              )
                            )
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
                        {review.comment}
                      </p>
                    </div>
                  )
                )
              )}
            </div>
          </div>

          {/* REVIEW FORM */}

          <form
            onSubmit={handleReviewSubmit}
            className="
              mt-8
              sm:mt-12
              border-t
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
                className="
                  w-full
                  border
                  rounded-lg
                  px-4
                  py-3
                  outline-none
                  focus:border-orange-500
                "
              />

              <select
                value={reviewRating}
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
                  rounded-lg
                  px-4
                  py-3
                  outline-none
                  focus:border-orange-500
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
              value={reviewComment}
              onChange={(e) =>
                setReviewComment(
                  e.target.value
                )
              }
              placeholder="Write your review..."
              rows="5"
              className="
                w-full
                border
                rounded-lg
                px-4
                py-3
                mt-4
                sm:mt-5
                outline-none
                focus:border-orange-500
                resize-y
              "
            />

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

        {relatedProducts.length > 0 && (
          <div className="mt-8 sm:mt-12">

            <h2
              className="
                text-2xl
                sm:text-3xl
                font-black
                mb-6
                sm:mb-8
              "
            >
              YOU MAY ALSO LIKE
            </h2>

            <div
              className="
                grid
                grid-cols-2
                lg:grid-cols-4
                gap-3
                sm:gap-5
                lg:gap-6
              "
            >
              {relatedProducts.map(
                (item) => {
                  const itemDiscountedPrice =
                    Math.round(
                      item.price -
                        (item.price *
                          (item.discount ||
                            0)) /
                          100
                    );

                  return (
                    <Link
                      key={item.id}
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
                          src={item.image}
                          alt={item.name}
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

                        {item.discount > 0 && (
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
                            {item.discount}% OFF
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
                        {item.category}
                      </p>

                      <h3
                        className="
                          font-bold
                          text-sm
                          sm:text-lg
                          line-clamp-2
                        "
                      >
                        {item.name}
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

                        {item.discount > 0 && (
                          <span
                            className="
                              text-xs
                              text-gray-400
                              line-through
                            "
                          >
                            ₹
                            {item.price.toLocaleString(
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
                        ⭐ {item.rating}
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

        {recentlyViewedProducts.length > 0 && (
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
              <h2
                className="
                  text-2xl
                  sm:text-3xl
                  font-black
                "
              >
                RECENTLY VIEWED
              </h2>

              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(
                    "gymdrobe-recently-viewed"
                  );

                  window.location.reload();
                }}
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
                    Math.round(
                      item.price -
                        (item.price *
                          (item.discount ||
                            0)) /
                          100
                    );

                  return (
                    <Link
                      key={item.id}
                      to={`/product/${item.id}`}
                      className="
                        bg-white
                        rounded-xl
                        p-3
                        shadow-sm
                        hover:shadow-lg
                        transition
                      "
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="
                          w-full
                          h-36
                          sm:h-48
                          object-cover
                          rounded-lg
                          mb-3
                        "
                      />

                      <h3
                        className="
                          font-bold
                          text-sm
                          line-clamp-2
                        "
                      >
                        {item.name}
                      </h3>

                      <div className="mt-2">
                        <span className="font-bold">
                          ₹
                          {itemDiscountedPrice.toLocaleString(
                            "en-IN"
                          )}
                        </span>
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

