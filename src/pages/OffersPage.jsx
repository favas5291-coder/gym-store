import { Link } from "react-router-dom";

import { useStore } from "../context/StoreContext.jsx";

import {
  COUPONS,
  FREE_SHIPPING_LIMIT,
  calculateSubtotal,
} from "../utils/orderCalculations.js";

import { money } from "../utils/productPricing.js";

export default function OffersPage() {
  const { cart, coupon, setCoupon, notify } = useStore();
  const subtotal = calculateSubtotal(cart);

  function selectCoupon(offer) {
    setCoupon(offer);

    const qualifies = subtotal >= offer.minimum;

    notify(
      qualifies
        ? `${offer.code} selected. Your bag qualifies for the discount.`
        : `${offer.code} selected. Add ${money(
            offer.minimum - subtotal
          )} more to qualify.`,
      qualifies ? "success" : "info"
    );
  }

  async function copyCoupon(code) {
    try {
      await navigator.clipboard.writeText(code);
      notify(`Coupon ${code} copied.`);
    } catch {
      notify(`Your coupon code is ${code}.`, "info");
    }
  }

  return (
    <div className="page narrow">
      <div className="page-heading">
        <h1>Offers for your next session</h1>

        <Link className="text-link" to="/shop?discount=1">
          Shop discounted gear →
        </Link>
      </div>

      <p className="muted">
        Coupon minimums use your item subtotal after product discounts.
        One coupon per order. Standard delivery becomes free at{" "}
        {money(FREE_SHIPPING_LIMIT)} after coupons.
      </p>

      <div className="offer-grid">
        {Object.values(COUPONS).map((offer) => {
          const qualifies = subtotal >= offer.minimum;
          const selected = coupon?.code === offer.code;

          return (
            <article className="offer-ticket" key={offer.code}>
              <p className="eyebrow">GYMDROBE COUPON</p>

              <h2>
                {offer.type === "fixed"
                  ? money(offer.value)
                  : `${offer.value}%`}{" "}
                OFF
              </h2>

              <strong className="coupon-code">
                {offer.code}
              </strong>

              <p>
                On item subtotals of {money(offer.minimum)} or more
              </p>

              <p>
                {qualifies
                  ? "Your bag qualifies."
                  : `Add ${money(
                      offer.minimum - subtotal
                    )} to your bag to qualify.`}
              </p>

              {selected && (
                <p className="muted">
                  {qualifies
                    ? "Selected for your current bag."
                    : "Selected. Savings apply once you meet the minimum."}
                </p>
              )}

              <div className="purchase-actions">
                <button
                  className="button compact"
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectCoupon(offer)}
                >
                  {selected ? "Coupon selected" : "Use coupon"}
                </button>

                <button
                  className="button secondary compact"
                  type="button"
                  aria-label={`Copy coupon code ${offer.code}`}
                  onClick={() => copyCoupon(offer.code)}
                >
                  Copy code
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Link className="button" to="/cart">
        Review your bag
      </Link>
    </div>
  );
}