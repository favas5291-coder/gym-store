import {
  calculateOrderPricing,
} from "../utils/orderCalculations.js";

import {
  money,
} from "../utils/productPricing.js";


// ======================================================
// PRICE SUMMARY
// ======================================================

export default function PriceSummary({
  cart = [],
  coupon = null,
  deliveryMethod = "standard",
  children,
}) {
  // ====================================================
  // SERVER/STORE PRICING LOGIC
  // ====================================================

  const pricing =
    calculateOrderPricing({
      cart,
      coupon,
      deliveryMethod,
    });


  // ====================================================
  // ITEM COUNT
  // ====================================================

  const itemCount =
    cart.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.quantity ||
            0
        ),

      0
    );


  // ====================================================
  // TOTAL MRP
  // ====================================================

  const mrp =
    cart.reduce(
      (
        total,
        item
      ) => {
        const quantity =
          Number(
            item.quantity ||
              0
          );


        const sellingPrice =
          Number(
            item.price ||
              0
          );


        const originalPrice =
          Math.max(
            sellingPrice,

            Number(
              item.originalPrice ??
                sellingPrice
            )
          );


        return (
          total +
          originalPrice *
            quantity
        );
      },

      0
    );


  // ====================================================
  // PRODUCT DISCOUNT
  // ====================================================

  const productDiscount =
    Math.max(
      0,

      mrp -
        Number(
          pricing.subtotal ||
            0
        )
    );


  // ====================================================
  // COUPON DISCOUNT
  // ====================================================

  const couponDiscount =
    Math.max(
      0,

      Number(
        pricing.couponDiscount ||
          0
      )
    );


  // ====================================================
  // SHIPPING
  // ====================================================

  const shipping =
    Math.max(
      0,

      Number(
        pricing.shipping ||
          0
      )
    );


  // ====================================================
  // TOTAL SAVINGS
  //
  // Only real product + coupon savings.
  // Shipping is not counted as a saving.
  // ====================================================

  const totalSavings =
    Math.max(
      0,

      productDiscount +
        couponDiscount
    );


  // ====================================================
  // FINAL TOTAL
  // ====================================================

  const finalTotal =
    Math.max(
      0,

      Number(
        pricing.finalTotal ||
          0
      )
    );


  // ====================================================
  // PAGE
  // ====================================================

  return (
    <section className="price-summary">
      {/* ===============================================
          HEADING
      =============================================== */}

      <h2>
        PRICE DETAILS{" "}

        <span>
          (
          {itemCount}{" "}
          {itemCount ===
          1
            ? "item"
            : "items"}
          )
        </span>
      </h2>


      {/* ===============================================
          PRICE BREAKDOWN
      =============================================== */}

      <dl>
        {/* ---------------------------------------------
            MRP
        --------------------------------------------- */}

        <div>
          <dt>
            Total MRP
          </dt>

          <dd>
            {money(
              mrp
            )}
          </dd>
        </div>


        {/* ---------------------------------------------
            PRODUCT DISCOUNT
        --------------------------------------------- */}

        {productDiscount >
          0 && (
          <div>
            <dt>
              Discount on MRP
            </dt>

            <dd className="positive">
              −
              {money(
                productDiscount
              )}
            </dd>
          </div>
        )}


        {/* ---------------------------------------------
            COUPON
        --------------------------------------------- */}

        {couponDiscount >
          0 && (
          <div>
            <dt>
              Coupon discount
            </dt>

            <dd className="positive">
              −
              {money(
                couponDiscount
              )}
            </dd>
          </div>
        )}


        {/* ---------------------------------------------
            DELIVERY
        --------------------------------------------- */}

        <div>
          <dt>
            {deliveryMethod ===
            "express"
              ? "Express delivery"
              : "Standard delivery"}
          </dt>

          <dd>
            {shipping >
            0 ? (
              money(
                shipping
              )
            ) : (
              <span className="positive">
                FREE
              </span>
            )}
          </dd>
        </div>


        {/* ---------------------------------------------
            REAL SAVINGS
        --------------------------------------------- */}

        {totalSavings >
          0 && (
          <div className="price-savings">
            <dt>
              Total savings
            </dt>

            <dd className="positive">
              {money(
                totalSavings
              )}
            </dd>
          </div>
        )}


        {/* ---------------------------------------------
            FINAL TOTAL
        --------------------------------------------- */}

        <div className="total">
          <dt>
            Total amount
          </dt>

          <dd>
            {money(
              finalTotal
            )}
          </dd>
        </div>
      </dl>


      {/* ===============================================
          CRO SAVINGS MESSAGE
      =============================================== */}

      {totalSavings >
        0 && (
        <p
          className="positive"
          role="status"
        >
          You save{" "}
          <strong>
            {money(
              totalSavings
            )}
          </strong>{" "}
          on this order.
        </p>
      )}


      {/* ===============================================
          OPTIONAL CHILDREN
      =============================================== */}

      {children}
    </section>
  );
}