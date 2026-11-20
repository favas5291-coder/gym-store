import { Link } from "react-router-dom";

import { useStore } from "../context/StoreContext.jsx";

import {
  COUPONS,
  calculateSubtotal,
} from "../utils/orderCalculations.js";

import { money } from "../utils/productPricing.js";

export default function OffersPage() {
  const { cart, kitGroups, coupon, setCoupon, notify } = useStore();
  const subtotal = calculateSubtotal(cart);
  const hasKits = kitGroups.length > 0;

  function selectCoupon(offer) {
    setCoupon(offer);

    if (hasKits) {
      notify(`${offer.code} selected. Check eligibility after kit discounts at checkout.`, "info");
      return;
    }

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
        Choose one coupon per order. Checkout confirms savings after product
        and eligible kit discounts. Check delivery charges and free shipping
        eligibility in your bag using your delivery pincode.
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
                {hasKits
                  ? "Checkout checks whether this coupon can be combined with your kit."
                  : qualifies
                  ? "Your bag qualifies."
                  : `Add ${money(
                      offer.minimum - subtotal
                    )} to your bag to qualify.`}
              </p>

              {selected && (
                <p className="muted">
                  {hasKits || qualifies
                    ? "Selected for your current bag."
                    : "Selected. Savings apply once you meet the minimum."}
                </p>
              )}

              <div className="purchase-actions">
                <button
                  className="button compact"
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Use coupon ${offer.code}`}
                  onClick={() => selectCoupon(offer)}
                >
                  Use coupon
                </button>

                <button
                  className="button secondary compact"
                  type="button"
                  aria-label={`Copy code ${offer.code}`}
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
