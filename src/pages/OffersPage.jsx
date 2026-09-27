import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext.jsx";
import { COUPONS, calculateSubtotal } from "../utils/orderCalculations.js";
import { money } from "../utils/productPricing.js";
export default function OffersPage() {
  const { cart, setCoupon, notify } = useStore(),
    subtotal = calculateSubtotal(cart);
  return (
    <div className="page narrow">
      <div className="page-heading">
        <h1>Offers for your next session</h1>
        <Link className="text-link" to="/shop?discount=1">
          Shop discounted gear →
        </Link>
      </div>
      <p className="muted">
        Coupon minimums use your item subtotal after product discounts. One
        coupon per order. Standard delivery becomes free at ₹500 after coupons.
      </p>
      <div className="offer-grid">
        {Object.values(COUPONS).map((c) => (
          <article className="offer-ticket" key={c.code}>
            <p className="eyebrow">GYMDROBE COUPON</p>
            <h2>{c.type === "fixed" ? money(c.value) : `${c.value}%`} OFF</h2>
            <strong className="coupon-code">{c.code}</strong>
            <p>On item subtotals of {money(c.minimum)} or more</p>
            <p>
              {subtotal >= c.minimum
                ? "Your bag qualifies"
                : `Add ${money(c.minimum - subtotal)} to your bag to qualify`}
            </p>
            <div className="purchase-actions">
              <button
                className="button compact"
                type="button"
                onClick={() => {
                  setCoupon(c);
                  notify(
                    `Coupon ${c.code} selected. ${subtotal >= c.minimum ? "Your bag qualifies." : "Meet the minimum to apply savings."}`,
                  );
                }}
              >
                Use coupon
              </button>
              <button
                className="button secondary compact"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.code);
                    notify("Coupon copied.");
                  } catch {
                    notify(`Coupon code: ${c.code}`, "info");
                  }
                }}
              >
                Copy code
              </button>
            </div>
          </article>
        ))}
      </div>
      <Link className="button" to="/cart">
        Review your bag
      </Link>
    </div>
  );
}