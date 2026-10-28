package com.gymdrobe.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.razorpay.Checkout;
import com.razorpay.CheckoutActivity;
import com.razorpay.ExternalWalletListener;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;
import org.json.JSONObject;

/** Native checkout returns gateway fields only. The server decides whether an order is paid. */
@CapacitorPlugin(name = "GymDrobeCheckout")
public class GymDrobeCheckoutPlugin extends Plugin {
    private boolean checkoutOpen = false;

    @PluginMethod
    public void open(PluginCall call) {
        if (checkoutOpen) {
            call.reject("A payment is already open.", "RAZORPAY_BUSY");
            return;
        }
        JSONObject options = call.getData();
        if (options.optString("key").isEmpty() || options.optString("order_id").isEmpty()
                || options.optLong("amount", 0) < 1 || !"INR".equals(options.optString("currency"))) {
            call.reject("Payment details are incomplete. Please retry.", "RAZORPAY_OPTIONS_INVALID");
            return;
        }
        checkoutOpen = true;
        try {
            Intent intent = new Intent(getActivity(), CheckoutActivity.class);
            intent.putExtra("OPTIONS", options.toString());
            intent.putExtra("FRAMEWORK", "capacitor");
            startActivityForResult(call, intent, "paymentResult");
        } catch (Exception exception) {
            checkoutOpen = false;
            call.reject("The payment window could not open. Please retry.", "RAZORPAY_OPEN_FAILED");
        }
    }

    @ActivityCallback
    private void paymentResult(PluginCall call, ActivityResult result) {
        checkoutOpen = false;
        if (call == null) return;
        try {
            Checkout.handleActivityResult(getActivity(), Checkout.RZP_REQUEST_CODE, result.getResultCode(), result.getData(),
                new PaymentResultWithDataListener() {
                    @Override
                    public void onPaymentSuccess(String paymentId, PaymentData data) {
                        try {
                            JSONObject fields = data == null ? null : data.getData();
                            if (fields == null || !call.getString("order_id", "").equals(fields.optString("razorpay_order_id"))
                                    || fields.optString("razorpay_payment_id").isEmpty() || fields.optString("razorpay_signature").isEmpty()) {
                                call.reject("Payment could not be confirmed. Check My orders before paying again.", "RAZORPAY_RESPONSE_INVALID");
                                return;
                            }
                            JSObject response = new JSObject();
                            response.put("razorpay_order_id", fields.getString("razorpay_order_id"));
                            response.put("razorpay_payment_id", fields.getString("razorpay_payment_id"));
                            response.put("razorpay_signature", fields.getString("razorpay_signature"));
                            call.resolve(response);
                        } catch (Exception exception) {
                            call.reject("Payment could not be confirmed. Check My orders before paying again.", "RAZORPAY_RESPONSE_INVALID");
                        }
                    }

                    @Override
                    public void onPaymentError(int code, String description, PaymentData data) {
                        call.reject(code == Checkout.PAYMENT_CANCELED
                            ? "Payment was cancelled. If money was deducted, check My orders before paying again."
                            : "Payment could not be completed. Check My orders before trying again.",
                            code == Checkout.PAYMENT_CANCELED ? "RAZORPAY_CANCELLED" : "RAZORPAY_PAYMENT_FAILED");
                    }
                }, new ExternalWalletListener() {
                    @Override
                    public void onExternalWalletSelected(String wallet, PaymentData data) {
                        call.reject("Check your payment and order status before paying again.", "RAZORPAY_EXTERNAL_WALLET");
                    }
                });
        } catch (Exception exception) {
            call.reject("Payment confirmation was interrupted. Check My orders before paying again.", "RAZORPAY_RESPONSE_INVALID");
        }
    }
}
