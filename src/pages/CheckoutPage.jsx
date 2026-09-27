import { checkoutSignature, commitCheckout } from "../utils/checkout.js";
import { readSession, writeSession } from "../utils/shopperStorage.js";
import { useShoppingTools } from "../context/ShoppingToolsContext.jsx";
import { selectedBag } from "../utils/commerce.js";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { getCartItemKey, revalidateCart } from "../utils/cartUtils.js";
import {
  calculateOrderPricing,
  resolveCoupon,
} from "../utils/orderCalculations.js";
import {
  addressErrors,
  EMPTY_ADDRESS,
  getAddresses,
  normalizeAddress,
  ownerKey,
  saveAddresses,
} from "../utils/customerData.js";
import {
  makeId,
  readStorage,
  userKey,
  writeStorage,
} from "../utils/storage.js";
import AddressForm from "../components/AddressForm.jsx";
import CouponBox from "../components/CouponBox.jsx";
import PriceSummary from "../components/PriceSummary.jsx";
import EmptyState from "../components/EmptyState.jsx";
export default function CheckoutPage() {
  const { products, getLatestProducts } = useCatalog();
  const tools = useShoppingTools();
  const { user } = useAuth(),
    store = useStore(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const isBuyNow = params.get("mode") === "buy-now";
  const isSelection = params.get("mode") === "selection";
  const checkoutMode = isBuyNow
    ? "buy-now"
    : isSelection
      ? "selection"
      : "cart";
  const items = isBuyNow
    ? store.buyNowItem
      ? [store.buyNowItem]
      : []
    : isSelection
      ? selectedBag(store.cart, tools.checkoutKeys)
      : store.cart;
  const [draftOptions] = useState(() =>
    readStorage(userKey("gymdrobe-checkout-options", user), {}),
  );
  const [giftMessage, setGiftMessage] = useState(
      draftOptions?.giftMessage || "",
    ),
    [orderNote, setOrderNote] = useState(draftOptions?.orderNote || "");
  const [addresses] = useState(() => getAddresses(user));
  const [address, setAddress] = useState(() => {
    const saved = addresses.find((a) => a.isDefault) || addresses[0];
    const draft = readStorage(userKey("gymdrobe-checkout-details", user), {});
    return normalizeAddress(
      saved || {
        ...EMPTY_ADDRESS,
        ...(draft && typeof draft === "object" ? draft : {}),
        fullName: draft?.fullName || draft?.name || user?.name || "",
        email: user?.email || draft?.email || "",
        phone: draft?.phone || user?.phone || "",
        pincode: draft?.pincode || readStorage(store.shoppingKey("gymdrobe-delivery-pincode"), ""),
      },
    );
  });
  const [saveAddress, setSaveAddress] = useState(Boolean(user)),
    [step, setStep] = useState("address"),
    [method, setMethod] = useState(
      draftOptions?.method === "express" ? "express" : "standard",
    ),
    [errors, setErrors] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submitting = useRef(false), reviewed = useRef(null);
  const attemptKey = store.shoppingKey(`gymdrobe-checkout-attempt-${checkoutMode}`);
  const [attempt] = useState(() => readSession(attemptKey, null) || makeId("checkout"));
  useEffect(() => { writeSession(attemptKey, attempt); }, [attemptKey, attempt]);
  const pricing = calculateOrderPricing({
    cart: items,
    coupon: store.coupon,
    deliveryMethod: method,
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      writeStorage(userKey("gymdrobe-checkout-details", user), address);
      writeStorage(userKey("gymdrobe-checkout-options", user), {
        method,
        giftMessage,
        orderNote,
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      writeStorage(userKey("gymdrobe-checkout-details", user), address);
    };
  }, [address, method, giftMessage, orderNote, user?.id]);
  function validate() {
    const invalid = addressErrors(address);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      setStep("address");
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return false;
    }
    return true;
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    if (!validate()) return;
    if (step === "address") {
      writeStorage(userKey("gymdrobe-checkout-details", user), address);
      reviewed.current = checkoutSignature(items, store.coupon, method);
      setStep("review");
      window.scrollTo({top: 0, behavior: "instant"});
      return;
    }
    const signature = checkoutSignature(items, store.coupon, method);
    if (reviewed.current !== signature) {
      reviewed.current = signature;
      setError("Your selection or total has changed. Review the current items and total, then place your order again.");
      return;
    }
    const checked = revalidateCart(items, getLatestProducts());
    if (!checked.cart.length || checked.changes.length) {
      if (isBuyNow) store.refreshBuyNow(checked.cart[0]);
      else {
        const selectedKeys = items.map(getCartItemKey);
        store.setCart([
          ...store.cart.filter(
            (item) => !selectedKeys.includes(getCartItemKey(item)),
          ),
          ...checked.cart,
        ]);
      }
      setError(
        "Product availability or prices changed. Please review your selection before placing an order.",
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    const now = new Date().toISOString(),
      selectedCoupon = resolveCoupon(store.coupon);
    const coupon =
      selectedCoupon && pricing.subtotal >= selectedCoupon.minimum
        ? selectedCoupon
        : null;
    const order = {
      id: makeId("GD"),
      ownerKey: ownerKey(user),
      createdAt: now,
      updatedAt: now,
      status: "confirmed",
      source: checkoutMode,
      giftMessage: giftMessage.trim(),
      orderNote: orderNote.trim(),
      user: user ? { id: user.id, name: user.name, email: user.email } : null,
      customer: {
        name: address.fullName.trim(),
        email: address.email.trim().toLowerCase(),
        phone: address.phone,
      },
      shippingAddress: {
        ...address,
        fullName: address.fullName.trim(),
        name: address.fullName.trim(),
        addressLine: address.addressLine.trim(),
      },
      items: checked.cart.map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        image: item.image,
        price: item.price,
        originalPrice: item.originalPrice,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        returnPolicy: item.returnPolicy,
      })),
      pricing: {
        ...calculateOrderPricing({
          cart: checked.cart,
          coupon,
          deliveryMethod: method,
        }),
        currency: "INR",
      },
      coupon,
      payment: { method: "cod", status: "pending", transactionId: null },
      paymentMethod: "cod",
      delivery: {
        method,
        status: "pending",
        label: method === "express" ? "Express delivery" : "Standard delivery",
        estimatedTime: null,
      },
      deliveryMethod: method,
      tracking: {
        carrier: null,
        trackingNumber: null,
        estimatedDelivery: null,
        events: [
          {
            status: "confirmed",
            description: "Preview order created on this device",
            timestamp: now,
          },
        ],
      },
      cancellation: { status: "not-cancelled" },
      returnRequest: { status: "not-requested" },
      refund: { status: "not-requested", amount: 0 },
      metadata: { version: "4.0", demo: true, inventoryReserved: true, checkoutToken: attempt },
    };
    try {
      const result = await commitCheckout(order, getLatestProducts);
      if (result.error) {
        if (isBuyNow) store.refreshBuyNow(result.cart[0]);
        else store.setCart(current => revalidateCart(current, getLatestProducts()).cart);
        throw new Error(result.error);
      }
      if (result.existing) {
        navigate(`/order-success?orderId=${encodeURIComponent(result.order.id)}`, {replace: true});
        return;
      }
      if (user && saveAddress) {
        const existing = getAddresses(user),
          duplicate = existing.some(
            (a) =>
              a.addressLine === address.addressLine &&
              a.pincode === address.pincode &&
              a.phone === address.phone,
          );
        if (
          !duplicate &&
          !saveAddresses(user, [
            ...existing,
            { ...address, id: makeId("address"), isDefault: !existing.length },
          ])
        )
          store.notify(
            "Order saved. Your address could not be added to saved addresses.",
            "warning",
          );
      }
      writeStorage(userKey("gymdrobe-last-order", user), order);
      if (isBuyNow) store.clearBuyNow();
      else {
        const orderedKeys = items.map(getCartItemKey);
        store.setCart(current =>
          current.filter(
            (item) => !orderedKeys.includes(getCartItemKey(item)),
          ),
        );
        tools.startSelection([]);
        store.setCoupon(null);
      }
      writeSession(attemptKey, null);
      writeStorage(userKey("gymdrobe-checkout-options", user), {method: "standard", giftMessage: "", orderNote: ""});
      navigate(`/order-success?orderId=${encodeURIComponent(order.id)}`, {
        replace: true,
      });
    } catch (e) {
      setError(e.message);
      submitting.current = false;
      setBusy(false);
    }
  }
  if (!items.length)
    return (
      <EmptyState
        title={
          isBuyNow
            ? "Choose your Buy now selection again"
            : "Your checkout is empty"
        }
      >
        Return to a product or add something to your bag to continue.
      </EmptyState>
    );
  return (
    <div className="page narrow">
      <nav className="checkout-steps" aria-label="Checkout progress">
        <Link to="/cart">1. BAG</Link>
        <strong>2. ADDRESS</strong>
        <strong className={step === "review" ? "active" : "muted"}>
          3. REVIEW
        </strong>
      </nav>
      <div className="page-heading">
        <h1>{step === "address" ? "Delivery address" : "Review your order"}</h1>
        <span>{isBuyNow ? "Buy now" : "Bag checkout"}</span>
      </div>
      <div className="notice">
        Store preview: orders are saved on this device. No payment is taken and
        no shipment is created.
      </div>
      {!user && (
        <p className="checkout-signin">
          <Link
            to={`/login?next=${encodeURIComponent(`/checkout?mode=${checkoutMode}`)}`}
          >
            Sign in
          </Link>{" "}
          to save this order to your preview account, or continue as a guest.
        </p>
      )}
      <div className="checkout-layout">
        <form
          id="checkout-form"
          className="checkout-form"
          onSubmit={submit}
          noValidate
        >
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          {step === "address" ? (
            <>
              {addresses.length > 0 && (
                <div className="saved-address-choices">
                  <h2>USE A SAVED ADDRESS</h2>
                  {addresses.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="saved-address-choice"
                      onClick={() => {
                        setAddress(
                          normalizeAddress({
                            ...item,
                            email: item.email || user.email,
                          }),
                        );
                        setErrors({});
                      }}
                    >
                      <strong>
                        {item.fullName} · {item.label || "Home"}
                      </strong>
                      <span>
                        {item.addressLine}, {item.city} {item.pincode}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <AddressForm
                value={address}
                errors={errors}
                onChange={(value) => {
                  setAddress(value);
                  setErrors({});
                }}
              />
              {user && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                  />
                  Save this address for next time
                </label>
              )}
            </>
          ) : (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <h2>DELIVER TO</h2>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setStep("address")}
                  >
                    Edit address
                  </button>
                </div>
                <strong>{address.fullName}</strong>
                <p>
                  {address.addressLine}
                  {address.landmark ? `, ${address.landmark}` : ""}
                  <br />
                  {address.city}, {address.state} – {address.pincode}
                </p>
                <p>
                  {address.phone} · {address.email}
                </p>
              </section>
              <section className="panel">
                <h2>PAYMENT METHOD</h2>
                <label className="check">
                  <input type="radio" checked readOnly name="payment" />
                  Cash on delivery (preview)
                </label>
                <p className="muted">
                  Online payments will be available after payment integration.
                </p>
              </section>
              <section className="panel">
                <h2>ORDER ITEMS</h2>
                {items.map((item, index) => (
                  <p key={index}>
                    {item.name} ·{" "}
                    {[item.selectedColor, item.selectedSize]
                      .filter(Boolean)
                      .join(" / ")}{" "}
                    × {item.quantity}
                  </p>
                ))}
              </section>
            </>
          )}
          <section className="panel">
            <h2>MAKE IT YOURS</h2>
            <div className="field">
              <label htmlFor="gift-message">
                Gift message (optional, no extra charge)
              </label>
              <textarea
                id="gift-message"
                rows="3"
                maxLength="250"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="order-note">
                Delivery instructions (optional)
              </label>
              <textarea
                id="order-note"
                rows="2"
                maxLength="300"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>
            <p className="muted">
              Messages are included in your preview order record.
            </p>
          </section>
          <fieldset className="delivery-methods">
            <legend>DELIVERY METHOD</legend>
            <label className="check">
              <input
                type="radio"
                name="delivery"
                value="standard"
                checked={method === "standard"}
                onChange={() => setMethod("standard")}
              />
              Standard — ₹99, free from ₹500 after coupons
            </label>
            <label className="check">
              <input
                type="radio"
                name="delivery"
                value="express"
                checked={method === "express"}
                onChange={() => setMethod("express")}
              />
              Express — ₹199
            </label>
            <p className="muted">
              Delivery dates are not confirmed in this preview.
            </p>
          </fieldset>
        </form>
        <aside className="checkout-summary">
          <CouponBox subtotal={pricing.subtotal} />
          <PriceSummary
            cart={items}
            coupon={store.coupon}
            deliveryMethod={method}
          >
            <button
              type="submit"
              form="checkout-form"
              className="button full"
              disabled={busy}
            >
              {busy
                ? "Saving order…"
                : step === "address"
                  ? "Continue to review"
                  : "Place preview order"}
            </button>
          </PriceSummary>
        </aside>
      </div>
    </div>
  );
}