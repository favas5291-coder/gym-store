import { useState } from "react";
import { COUPONS, resolveCoupon } from "../utils/orderCalculations.js";
import { money } from "../utils/productPricing.js";
import { useStore } from "../context/StoreContext.jsx";
export default function CouponBox({ subtotal }) {
  const { coupon, setCoupon } = useStore(),
    [code, setCode] = useState(""),
    [error, setError] = useState("");
  function apply(event) {
    event.preventDefault();
    const selected = resolveCoupon(code);
    if (!selected) {
      setError("Enter a valid coupon code.");
      return;
    }
    if (subtotal < selected.minimum) {
      setError(
        `This coupon requires a subtotal of ${money(selected.minimum)}.`,
      );
      return;
    }
    setCoupon(selected);
    setCode("");
    setError("");
  }
  return (
    <section className="coupon-box">
      <h3>COUPONS</h3>
      {coupon ? (
        <div className="coupon-applied">
          <div>
            <strong>{coupon.code}</strong>
            <p>
              {subtotal >= coupon.minimum
                ? "Coupon applied"
                : `Add ${money(coupon.minimum - subtotal)} to qualify`}
            </p>
          </div>
          <button
            className="text-link"
            type="button"
            onClick={() => setCoupon(null)}
          >
            Remove
          </button>
        </div>
      ) : (
        <form onSubmit={apply}>
          <label className="sr-only" htmlFor="coupon-code">
            Coupon code
          </label>
          <input
            id="coupon-code"
            value={code}
            placeholder="Enter coupon code"
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
          />
          <button type="submit" className="button secondary compact">
            Apply
          </button>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <details>
        <summary>View available coupons</summary>
        {Object.values(COUPONS).map((item) => (
          <p key={item.code}>
            <strong>{item.code}</strong> —{" "}
            {item.type === "percentage" ? `${item.value}%` : money(item.value)}{" "}
            off on subtotals from {money(item.minimum)}
          </p>
        ))}
      </details>
    </section>
  );
}