import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import products from "../data/products";

function ProductPage({ addToCart }) {
  const { id } = useParams();

  // =====================================================
  // PRODUCT STATE
  // =====================================================

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // =====================================================
  // REVIEW STATE
  // =====================================================

  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const [userReviews, setUserReviews] = useState(() => {
    const savedReviews =
      localStorage.getItem("gymdrobe-reviews");

    return savedReviews
      ? JSON.parse(savedReviews)
      : {};
  });

  // =====================================================
  // FIND PRODUCT
  // =====================================================

  const product = products.find(
    (item) => item.id === Number(id)
  );

  if (!product) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-3xl font-bold">
          Product Not Found
        </h1>
      </div>
    );
  }

  // =====================================================
  // COMBINE DEFAULT + USER REVIEWS
  // =====================================================

  const defaultReviews =
    product.reviews || [];

  const savedProductReviews =
    userReviews[product.id] || [];

  const reviews = [
    ...defaultReviews,
    ...savedProductReviews,
  ];

  // =====================================================
  // RATING CALCULATIONS
  // =====================================================

  const reviewCount = reviews.length;

  const averageRating =
    reviewCount > 0
      ? (
          reviews.reduce(
            (total, review) =>
              total + review.rating,
            0
          ) / reviewCount
        ).toFixed(1)
      : "0.0";

  function getRatingCount(rating) {
    return reviews.filter(
      (review) =>
        review.rating === rating
    ).length;
  }

  function getRatingPercentage(rating) {
    if (reviewCount === 0) {
      return 0;
    }

    return Math.round(
      (getRatingCount(rating) /
        reviewCount) *
        100
    );
  }

  // =====================================================
  // PRODUCT DATA
  // =====================================================

  const relatedProducts =
    products.filter(
      (item) => item.id !== product.id
    );

  const discountedPrice =
    product.price -
    (product.price * product.discount) /
      100;

  const totalDiscountedPrice =
    discountedPrice * quantity;

  const totalOriginalPrice =
    product.price * quantity;

  // =====================================================
  // VARIANT STOCK
  // =====================================================

  let availableStock = 0;

  if (
    selectedColor &&
    selectedSize &&
    product.variants?.[selectedColor]?.[
      selectedSize
    ] !== undefined
  ) {
    availableStock =
      product.variants[selectedColor][
        selectedSize
      ];
  } else if (
    selectedColor &&
    product.variants?.[selectedColor]?.default !==
      undefined
  ) {
    availableStock =
      product.variants[selectedColor].default;
  } else if (!product.colors?.length) {
    availableStock =
      product.stock ?? 0;
  }

  // =====================================================
  // PRODUCT FUNCTIONS
  // =====================================================

  function handleSizeChange(size) {
    setSelectedSize(size);
    setQuantity(1);
  }

  function handleColorChange(color) {
    setSelectedColor(color);
    setQuantity(1);
  }

  function decreaseQuantity() {
    setQuantity(
      Math.max(1, quantity - 1)
    );
  }

  function increaseQuantity() {
    if (availableStock <= 0) {
      return;
    }

    setQuantity(
      Math.min(
        availableStock,
        quantity + 1
      )
    );
  }

  function handleAddToCart() {
    if (
      product.sizes?.length > 0 &&
      !selectedSize
    ) {
      alert("Please select a size");
      return;
    }

    if (
      product.colors?.length > 0 &&
      !selectedColor
    ) {
      alert("Please select a color");
      return;
    }

    if (availableStock <= 0) {
      alert("This variant is out of stock");
      return;
    }

    addToCart(
      product,
      quantity,
      selectedSize,
      selectedColor
    );
  }

  // =====================================================
  // ADD REVIEW
  // =====================================================

  function handleSubmitReview(e) {
    e.preventDefault();

    if (!reviewName.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!reviewComment.trim()) {
      alert("Please write a review");
      return;
    }

    const newReview = {
      id: Date.now(),
      name: reviewName.trim(),
      rating: reviewRating,
      comment: reviewComment.trim(),
    };

    const updatedReviews = {
      ...userReviews,
      [product.id]: [
        ...(userReviews[product.id] || []),
        newReview,
      ],
    };

    setUserReviews(updatedReviews);

    localStorage.setItem(
      "gymdrobe-reviews",
      JSON.stringify(updatedReviews)
    );

    setReviewName("");
    setReviewComment("");
    setReviewRating(5);

    alert("Review added successfully!");
  }

  return (
    <section className="py-20 px-6 bg-white">

      {/* =====================================================
          PRODUCT DETAILS
      ===================================================== */}

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-start">

        {/* PRODUCT IMAGES */}

        <div>

          <div
            className="
              bg-gray-100
              rounded-xl
              overflow-hidden
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
              src={
                product.images?.[
                  selectedImage
                ] || product.image
              }
              alt={product.name}
              className={`
                w-full
                h-[500px]
                object-cover
                transition-transform
                duration-500
                ${
                  isZoomed
                    ? "scale-125"
                    : "scale-100"
                }
              `}
            />
          </div>

          {product.images?.length > 0 && (
            <div className="
              flex
              gap-3
              mt-4
              overflow-x-auto
            ">

              {product.images.map(
                (image, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setSelectedImage(index);
                      setIsZoomed(false);
                    }}
                    className={`
                      border-2
                      rounded-lg
                      overflow-hidden
                      flex-shrink-0
                      ${
                        selectedImage === index
                          ? "border-orange-600"
                          : "border-gray-300"
                      }
                    `}
                  >
                    <img
                      src={image}
                      alt={`${product.name} view ${
                        index + 1
                      }`}
                      className="
                        w-20
                        h-20
                        object-cover
                      "
                    />
                  </button>
                )
              )}

            </div>
          )}

        </div>

        {/* PRODUCT INFORMATION */}

        <div>

          <p className="
            uppercase
            tracking-widest
            text-orange-600
            font-semibold
            mb-2
          ">
            {product.category}
          </p>

          <p className="
            text-gray-500
            mb-3
          ">
            Brand: {product.brand}
          </p>

          <h1 className="
            text-5xl
            font-bold
            mb-4
          ">
            {product.name}
          </h1>

          {/* RATING */}

          <div className="
            flex
            items-center
            gap-3
            mb-5
          ">

            <span className="
              text-yellow-500
              text-xl
            ">
              {"★".repeat(
                Math.round(
                  Number(averageRating)
                )
              )}
            </span>

            <span className="font-semibold">
              {averageRating}
            </span>

            <span className="text-gray-500">
              ({reviewCount} reviews)
            </span>

          </div>

          {/* PRICE */}

          <p className="
            text-3xl
            font-bold
            mb-1
          ">
            ₹
            {totalDiscountedPrice.toLocaleString(
              "en-IN"
            )}
          </p>

          <p className="
            text-gray-500
            line-through
            mb-6
          ">
            ₹
            {totalOriginalPrice.toLocaleString(
              "en-IN"
            )}
          </p>

          {/* SIZE */}

          {product.sizes?.length > 0 && (
            <div className="mb-6">

              <p className="
                font-semibold
                mb-3
              ">
                Select Size
              </p>

              <div className="
                flex
                flex-wrap
                gap-3
              ">

                {product.sizes.map(
                  (size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        handleSizeChange(size)
                      }
                      className={`
                        px-5
                        py-2
                        border
                        rounded-lg
                        transition
                        ${
                          selectedSize === size
                            ? "bg-black text-white border-black"
                            : "bg-white hover:bg-gray-100"
                        }
                      `}
                    >
                      {size}
                    </button>
                  )
                )}

              </div>
            </div>
          )}

          {/* COLOR */}

          {product.colors?.length > 0 && (
            <div className="mb-6">

              <p className="
                font-semibold
                mb-3
              ">
                Select Color
              </p>

              <div className="
                flex
                flex-wrap
                gap-3
              ">

                {product.colors.map(
                  (color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        handleColorChange(color)
                      }
                      className={`
                        px-5
                        py-2
                        border
                        rounded-lg
                        transition
                        ${
                          selectedColor === color
                            ? "bg-black text-white border-black"
                            : "bg-white hover:bg-gray-100"
                        }
                      `}
                    >
                      {color}
                    </button>
                  )
                )}

              </div>
            </div>
          )}

          {/* STOCK */}

          {selectedColor &&
          (selectedSize ||
            product.sizes?.length === 0) ? (
            <p
              className={`
                font-semibold
                mb-6
                ${
                  availableStock > 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >
              {availableStock > 0
                ? `${availableStock} items available`
                : "Out of Stock"}
            </p>
          ) : (
            <p className="
              text-gray-500
              mb-6
            ">
              Select your options to see stock
            </p>
          )}

          {/* DESCRIPTION */}

          <p className="
            text-gray-600
            mb-8
          ">
            {product.description}
          </p>

          {/* QUANTITY */}

          <div className="
            flex
            items-center
            gap-4
            mb-8
          ">

            <span className="font-semibold">
              Quantity
            </span>

            <button
              type="button"
              onClick={decreaseQuantity}
              disabled={
                availableStock === 0
              }
              className="
                w-10
                h-10
                bg-gray-200
                hover:bg-gray-300
                disabled:opacity-40
                disabled:cursor-not-allowed
                rounded-lg
                font-bold
              "
            >
              −
            </button>

            <span className="
              font-bold
              text-lg
              min-w-[25px]
              text-center
            ">
              {quantity}
            </span>

            <button
              type="button"
              onClick={increaseQuantity}
              disabled={
                availableStock === 0 ||
                quantity >= availableStock
              }
              className="
                w-10
                h-10
                bg-gray-200
                hover:bg-gray-300
                disabled:opacity-40
                disabled:cursor-not-allowed
                rounded-lg
                font-bold
              "
            >
              +
            </button>

          </div>

          {/* ADD TO CART */}

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={
              availableStock === 0
            }
            className={`
              w-full
              md:w-auto
              px-10
              py-4
              rounded-lg
              font-semibold
              text-white
              transition
              ${
                availableStock > 0
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-gray-400 cursor-not-allowed"
              }
            `}
          >
            {availableStock > 0
              ? "ADD TO CART"
              : "OUT OF STOCK"}
          </button>

        </div>
      </div>


      {/* =====================================================
          CUSTOMER REVIEWS
      ===================================================== */}

      <div className="
        max-w-6xl
        mx-auto
        mt-24
        border-t
        pt-16
      ">

        <h2 className="
          text-4xl
          font-bold
          mb-10
        ">
          Customer Reviews
        </h2>


        {/* =====================================================
            RATING SUMMARY + BREAKDOWN
        ===================================================== */}

        <div className="
          grid
          md:grid-cols-3
          gap-10
          mb-16
        ">

          {/* AVERAGE RATING */}

          <div className="
            bg-gray-100
            rounded-xl
            p-8
            text-center
          ">

            <p className="
              text-5xl
              font-bold
              mb-3
            ">
              {averageRating}
            </p>

            <p className="
              text-yellow-500
              text-2xl
              mb-3
            ">
              {"★".repeat(
                Math.round(
                  Number(averageRating)
                )
              )}
            </p>

            <p className="text-gray-500">
              Based on {reviewCount} reviews
            </p>

          </div>


          {/* RATING BREAKDOWN */}

          <div className="
            md:col-span-2
          ">

            <h3 className="
              text-xl
              font-bold
              mb-5
            ">
              Rating Breakdown
            </h3>

            <div className="
              space-y-3
            ">

              {[5, 4, 3, 2, 1].map(
                (rating) => (
                  <div
                    key={rating}
                    className="
                      flex
                      items-center
                      gap-3
                    "
                  >

                    <span className="
                      w-12
                      font-semibold
                    ">
                      {rating} ★
                    </span>

                    <div className="
                      flex-1
                      h-3
                      bg-gray-200
                      rounded-full
                      overflow-hidden
                    ">
                      <div
                        className="
                          h-full
                          bg-yellow-400
                        "
                        style={{
                          width: `${getRatingPercentage(
                            rating
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="
                      w-12
                      text-right
                      text-gray-500
                    ">
                      {getRatingPercentage(
                        rating
                      )}%
                    </span>

                  </div>
                )
              )}

            </div>

          </div>

        </div>


        {/* =====================================================
            ADD REVIEW FORM
        ===================================================== */}

        <div className="
          bg-gray-100
          rounded-xl
          p-8
          mb-16
        ">

          <h3 className="
            text-2xl
            font-bold
            mb-6
          ">
            Write a Review
          </h3>

          <form
            onSubmit={handleSubmitReview}
            className="
              max-w-2xl
              space-y-5
            "
          >

            {/* NAME */}

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">
                Your Name
              </label>

              <input
                type="text"
                value={reviewName}
                onChange={(e) =>
                  setReviewName(
                    e.target.value
                  )
                }
                placeholder="Enter your name"
                className="
                  w-full
                  p-3
                  border
                  rounded-lg
                  bg-white
                  outline-none
                  focus:ring-2
                  focus:ring-orange-500
                "
              />

            </div>


            {/* STAR RATING */}

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">
                Your Rating
              </label>

              <div className="
                flex
                gap-2
              ">

                {[1, 2, 3, 4, 5].map(
                  (rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() =>
                        setReviewRating(
                          rating
                        )
                      }
                      className={`
                        text-3xl
                        transition
                        hover:scale-110
                        ${
                          rating <=
                          reviewRating
                            ? "text-yellow-500"
                            : "text-gray-300"
                        }
                      `}
                    >
                      ★
                    </button>
                  )
                )}

              </div>

            </div>


            {/* COMMENT */}

            <div>

              <label className="
                block
                font-semibold
                mb-2
              ">
                Your Review
              </label>

              <textarea
                value={reviewComment}
                onChange={(e) =>
                  setReviewComment(
                    e.target.value
                  )
                }
                placeholder="Write your experience..."
                rows="5"
                className="
                  w-full
                  p-3
                  border
                  rounded-lg
                  bg-white
                  outline-none
                  resize-none
                  focus:ring-2
                  focus:ring-orange-500
                "
              />

            </div>


            {/* SUBMIT */}

            <button
              type="submit"
              className="
                bg-orange-600
                hover:bg-orange-700
                text-white
                px-8
                py-3
                rounded-lg
                font-semibold
                transition
              "
            >
              SUBMIT REVIEW
            </button>

          </form>

        </div>


        {/* =====================================================
            REVIEW LIST
        ===================================================== */}

        <div>

          <h3 className="
            text-2xl
            font-bold
            mb-6
          ">
            Customer Experiences
          </h3>

          {reviews.length === 0 ? (
            <p className="text-gray-500">
              No reviews yet.
            </p>
          ) : (
            <div className="
              space-y-5
            ">
              {reviews.map(
                (review) => (
                  <div
                    key={review.id}
                    className="
                      border
                      rounded-xl
                      p-6
                      bg-white
                    "
                  >

                    <div className="
                      flex
                      items-center
                      justify-between
                      mb-3
                    ">

                      <div>

                        <p className="
                          font-bold
                        ">
                          {review.name}
                        </p>

                        <p className="
                          text-yellow-500
                        ">
                          {"★".repeat(
                            review.rating
                          )}
                        </p>

                      </div>

                    </div>

                    <p className="
                      text-gray-600
                    ">
                      {review.comment}
                    </p>

                  </div>
                )
              )}
            </div>
          )}

        </div>

      </div>


      {/* =====================================================
          RELATED PRODUCTS
      ===================================================== */}

      <div className="
        max-w-6xl
        mx-auto
        mt-20
      ">

        <h2 className="
          text-3xl
          font-bold
          mb-8
        ">
          Related Products
        </h2>

        <div className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-6
        ">

          {relatedProducts
            .slice(0, 3)
            .map((item) => {

              const itemDiscountedPrice =
                item.price -
                (item.price *
                  item.discount) /
                  100;

              return (
                <Link
                  key={item.id}
                  to={`/product/${item.id}`}
                  className="
                    bg-gray-100
                    p-4
                    rounded-xl
                    hover:shadow-lg
                    transition
                  "
                >

                  <img
                    src={
                      item.images?.[0] ||
                      item.image
                    }
                    alt={item.name}
                    className="
                      h-40
                      w-full
                      object-cover
                      rounded-lg
                      mb-4
                    "
                  />

                  <h3 className="
                    font-bold
                    text-lg
                    mb-2
                  ">
                    {item.name}
                  </h3>

                  <p className="font-semibold">
                    ₹
                    {itemDiscountedPrice.toLocaleString(
                      "en-IN"
                    )}
                  </p>

                  <p className="
                    text-sm
                    text-gray-500
                    line-through
                  ">
                    ₹
                    {item.price.toLocaleString(
                      "en-IN"
                    )}
                  </p>

                </Link>
              );
            })}

        </div>
      </div>

    </section>
  );
}

export default ProductPage;