import { calculateOrderPricing } from "../utils/orderCalculations.js";
import { money } from "../utils/productPricing.js";
export default function PriceSummary({
  cart,
  coupon,
  deliveryMethod = "standard",
  children,
}) {
  const pricing = calculateOrderPricing({ cart, coupon, deliveryMethod });
  const mrp = cart.reduce(
    (n, item) => n + Number(item.originalPrice ?? item.price) * item.quantity,
    0,
  );
  return (
    <section className="price-summary">
      <h2>
        PRICE DETAILS{" "}
        <span>({cart.reduce((n, item) => n + item.quantity, 0)} items)</span>
      </h2>
      <dl>
        <div>
          <dt>Total MRP</dt>
          <dd>{money(mrp)}</dd>
        </div>
        <div>
          <dt>Discount on MRP</dt>
          <dd className="positive">
            −{money(Math.max(0, mrp - pricing.subtotal))}
          </dd>
        </div>
        <div>
          <dt>Coupon discount</dt>
          <dd className="positive">−{money(pricing.couponDiscount)}</dd>
        </div>
        <div>
          <dt>
            {deliveryMethod === "express" ? "Express" : "Standard"} delivery
          </dt>
          <dd>
            {pricing.shipping ? (
              money(pricing.shipping)
            ) : (
              <span className="positive">FREE</span>
            )}
          </dd>
        </div>
        <div className="total">
          <dt>Total amount</dt>
          <dd>{money(pricing.finalTotal)}</dd>
        </div>
      </dl>
      {children}
    </section>
  );
}