import { Capacitor, registerPlugin } from "@capacitor/core";
const AppleSignIn = registerPlugin("GymDrobeAppleSignIn");
export const appleSignInEnabled = () => Capacitor.getPlatform() === "ios" && import.meta.env?.VITE_APPLE_SIGN_IN_ENABLED === "true";
export async function nativeAppleAuthorization(nonce) {
  if (!appleSignInEnabled()) throw new Error("Apple sign-in is awaiting configuration.");
  if (!/^[a-f\d]{64}$/.test(nonce)) throw new Error("Start a new Apple sign-in attempt.");
  return AppleSignIn.signIn({ nonce });
}
