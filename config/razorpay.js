const Razorpay =
  require("razorpay");


let client =
  null;


// ======================================================
// GET RAZORPAY CREDENTIALS
// ======================================================

function getCredentials() {
  const keyId =
    String(
      process.env
        .RAZORPAY_KEY_ID ||
        ""
    ).trim();


  const keySecret =
    String(
      process.env
        .RAZORPAY_KEY_SECRET ||
        ""
    ).trim();


  if (
    !keyId ||
    !keySecret
  ) {
    throw new Error(
      "Razorpay credentials are missing. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env."
    );
  }


  return {
    keyId,
    keySecret,
  };
}


// ======================================================
// GET RAZORPAY CLIENT
// ======================================================

function getRazorpayClient() {
  if (
    client
  ) {
    return client;
  }


  const {
    keyId,
    keySecret,
  } =
    getCredentials();


  client =
    new Razorpay({
      key_id:
        keyId,

      key_secret:
        keySecret,
    });


  return client;
}


// ======================================================
// PUBLIC KEY ID
//
// This may later be sent to React.
//
// IMPORTANT:
// Never send RAZORPAY_KEY_SECRET to React.
// ======================================================

function getRazorpayKeyId() {
  const {
    keyId,
  } =
    getCredentials();


  return keyId;
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getRazorpayClient,
  getRazorpayKeyId,
};