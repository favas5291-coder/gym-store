import Capacitor
import Razorpay

@objc(GymDrobeCheckoutPlugin)
public class GymDrobeCheckoutPlugin: CAPPlugin, CAPBridgedPlugin, RazorpayPaymentCompletionProtocolWithData {
    public let identifier = "GymDrobeCheckoutPlugin"
    public let jsName = "GymDrobeCheckout"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]
    private var activeCall: CAPPluginCall?
    private var checkout: RazorpayCheckout?
    private var orderID: String?

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.activeCall == nil else { call.reject("A payment is already open.", "RAZORPAY_BUSY"); return }
            guard let key = call.getString("key"), key.hasPrefix("rzp_"),
                  let order = call.getString("order_id"), order.hasPrefix("order_"),
                  let amount = call.getDouble("amount"), amount.isFinite, amount > 0,
                  amount.rounded() == amount, amount <= 100_000_000,
                  call.getString("currency") == "INR", let controller = self.bridge?.viewController else {
                call.reject("Payment could not start. Refresh checkout and retry.", "RAZORPAY_INVALID_OPTIONS"); return
            }
            self.activeCall = call
            self.orderID = order
            // Forward only checkout display data. No client callback or success flag is trusted.
            var options: [String: Any] = ["order_id": order, "amount": amount, "currency": "INR", "name": "GymDrobe"]
            for field in ["description", "prefill", "theme", "notes"] {
                if let value = call.options[field] { options[field] = value }
            }
            self.checkout = RazorpayCheckout.initWithKey(key, andDelegateWithData: self)
            self.checkout?.open(options, displayController: controller)
        }
    }
    public func onPaymentSuccess(_ payment_id: String, andData response: [AnyHashable: Any]?) {
        guard let call = activeCall else { return }
        defer { activeCall = nil; orderID = nil; checkout = nil }
        guard let order = response?["razorpay_order_id"] as? String, order == orderID,
              let signature = response?["razorpay_signature"] as? String, !signature.isEmpty, !payment_id.isEmpty else {
            call.reject("Payment requires confirmation. Check My orders before paying again.", "RAZORPAY_RESPONSE_INVALID"); return
        }
        // Existing /payments verification remains authoritative for success and order creation.
        call.resolve(["razorpay_order_id": order, "razorpay_payment_id": payment_id, "razorpay_signature": signature])
    }
    public func onPaymentError(_ code: Int32, description str: String, andData response: [AnyHashable: Any]?) {
        let call = activeCall
        activeCall = nil; orderID = nil; checkout = nil
        call?.reject(code == 2 ? "Payment cancelled." : "Payment did not complete. Check My orders before retrying.", code == 2 ? "RAZORPAY_CANCELLED" : "RAZORPAY_FAILED")
    }
}
