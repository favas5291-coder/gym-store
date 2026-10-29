import { Capacitor } from "@capacitor/core";
let initialization;

export async function nativeGoogleCredential({ clientId, nonce }) {
  if (!clientId?.endsWith(".apps.googleusercontent.com") || typeof nonce !== "string" || !nonce) {
    throw Object.assign(new Error("Google sign-in could not start. Please retry."), { code: "SIGNIN_RESTART_REQUIRED" });
  }
  const iosClientId = import.meta.env?.VITE_GOOGLE_IOS_CLIENT_ID?.trim();
  if (Capacitor.getPlatform() === "ios" && !iosClientId?.endsWith(".apps.googleusercontent.com")) {
    throw Object.assign(new Error("iPhone Google sign-in is awaiting its iOS OAuth configuration. You can continue as a guest."), { code: "IOS_GOOGLE_CONFIGURATION_REQUIRED" });
  }
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  if (!initialization) {
    initialization = SocialLogin.initialize({ google: { webClientId: clientId, iOSClientId: iosClientId, iOSServerClientId: clientId, mode: "online" } }).catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  await initialization;
  const response = await SocialLogin.login({ provider: "google", options: { nonce, scopes: ["openid", "email", "profile"], style: "standard", autoSelectEnabled: false, filterByAuthorizedAccounts: false } });
  const credential = response?.result?.idToken;
  if (typeof credential !== "string" || !credential) {
    throw Object.assign(new Error("Google did not return a sign-in token. Please restart sign-in."), { code: "GOOGLE_VERIFICATION_FAILED" });
  }
  return credential;
}

export async function clearNativeGoogleSession() {
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.logout({ provider: "google" });
  } catch {
    // Local GymDrobe logout succeeds even if the optional provider is unavailable.
  }
}
