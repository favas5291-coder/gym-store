export const defaultPlugins = ["@capacitor/app", "@capacitor/browser", "@capacitor/keyboard", "@capacitor/share", "@capacitor/splash-screen", "@capgo/capacitor-social-login"];
export function nativePushConfig(config, env, platform, firebase) {
  const enabled = env.VITE_PUSH_ENABLED === "true", result = structuredClone(config);
  result.includePlugins = [...defaultPlugins, ...(enabled ? ["@capacitor/push-notifications"] : [])];
  if (result.android) delete result.android.includePlugins;
  if (result.ios) delete result.ios.includePlugins;
  if (enabled && platform === "ios" && !["sandbox", "production"].includes(env.VITE_APNS_ENVIRONMENT)) throw new Error("Choose sandbox or production APNs explicitly before enabling iOS push.");
  if (enabled && platform === "android" && (!firebase?.project_info?.project_id || !firebase.client?.some(client => client.client_info?.android_client_info?.package_name === "com.gymdrobe.app"))) throw new Error("Android push requires the owner's Firebase google-services.json for com.gymdrobe.app.");
  result.plugins = { ...result.plugins, PushNotifications: { presentationOptions: [] } };
  return result;
}
