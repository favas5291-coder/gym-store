import { registerPlugin } from "@capacitor/core";

const Checkout = registerPlugin("GymDrobeCheckout");
let active = false;
let flowActive = false;
const RECOVERY_KEY = "gymdrobe-native-payment-pending";

export const nativePaymentActive = () => active || flowActive;
export const setNativePaymentFlowActive = (value) => { flowActive = Boolean(value); };

export function interruptedNativePayment() {
  try { return localStorage.getItem(RECOVERY_KEY) === "1"; } catch { return false; }
}

export function clearInterruptedNativePayment() {
  try { localStorage.removeItem(RECOVERY_KEY); } catch { /* Storage can be unavailable. */ }
}

export function verifiedNativePaymentShape(response, expectedOrder) {
  if (!response || ["razorpay_order_id", "razorpay_payment_id", "razorpay_signature"].some((key) => typeof response[key] !== "string" || !response[key]) || response.razorpay_order_id !== expectedOrder) {
    throw Object.assign(new Error("Payment could not be confirmed. Check My orders before paying again."), { code: "RAZORPAY_RESPONSE_INVALID" });
  }
  // This is only a structural check. The existing backend verifies the signature.
  return { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature };
}

export async function openNativePayment(options) {
  if (active) throw Object.assign(new Error("A payment is already open."), { code: "RAZORPAY_BUSY" });
  active = true;
  try { localStorage.setItem(RECOVERY_KEY, "1"); } catch { /* No credential is stored. */ }
  try {
    const { handler, modal, ...data } = options;
    const response = await Checkout.open({ ...data, amount: Number(options.amount), currency: "INR" });
    return verifiedNativePaymentShape(response, options.order_id);
  } finally {
    active = false;
    clearInterruptedNativePayment();
  }
}
