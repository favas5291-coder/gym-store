import { Capacitor, registerPlugin } from "@capacitor/core";

const SecureSession = registerPlugin("GymDrobeSecureSession");
export const TOKEN_KEY = "gymdrobe-auth-token";

// Serialize mutations so a late login write cannot resurrect a logged-out session.
export function createSessionStorage({ ios, secure, storage }) {
  let pending = Promise.resolve();
  const serialize = (operation) => {
    const result = pending.catch(() => {}).then(operation);
    pending = result;
    return result;
  };
  return {
    read: () => serialize(async () => {
      if (!ios) {
        try { return storage.getItem(TOKEN_KEY) || null; }
        catch { return null; } // Preserve guest browsing when browser storage is blocked.
      }
      const { token } = await secure.read();
      const legacy = storage.getItem(TOKEN_KEY);
      if (!token && legacy) await secure.write({ token: legacy });
      // Remove the browser copy only after Keychain migration succeeded.
      storage.removeItem(TOKEN_KEY);
      return token || legacy || null;
    }),
    write: (token) => serialize(async () => {
      if (ios) {
        if (token) await secure.write({ token });
        else await secure.clear();
        storage.removeItem(TOKEN_KEY);
      } else if (token) storage.setItem(TOKEN_KEY, token);
      else storage.removeItem(TOKEN_KEY);
      return true;
    }),
  };
}

let instance;
export function sessionStorage() {
  return instance ||= createSessionStorage({
    ios: Capacitor.getPlatform() === "ios", secure: SecureSession,
    // Access the browser property lazily: its getter can itself throw in a
    // storage-restricted browser. read() handles that as the existing guest flow.
    storage: {
      getItem: (key) => globalThis.localStorage.getItem(key),
      setItem: (key, value) => globalThis.localStorage.setItem(key, value),
      removeItem: (key) => globalThis.localStorage.removeItem(key),
    },
  });
}
