import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getCurrentUser,
  loginWithGoogle,
  loginWithApple,
  updateUserProfile,
} from "../services/authApi.js";
import { isNativeApp } from "../native/platform.js";
import { sessionStorage } from "../native/session.js";
import { clearNativeGoogleSession } from "../native/google.js";

import {
  importGuestShopping,
  shoppingKey,
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";

const AuthContext = createContext(null);
async function googleOnly() {
  throw new Error(
    "Please use Continue with Google to access your GymDrobe account."
  );
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const [storageReady, setStorageReady] = useState(false);
  const tokenRef = useRef(token);
  const sessionRevision = useRef(0);
  const googleLoginBusy = useRef(false);

  const retrySession = useCallback(() => {
    setRestoreAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    window.addEventListener("online", retrySession);

    return () => {
      window.removeEventListener("online", retrySession);
    };
  }, [retrySession]);

  useEffect(() => {
    let cancelled = false;
    const revision = sessionRevision.current;
    sessionStorage().read().then((stored) => {
      if (cancelled || revision !== sessionRevision.current) return;
      tokenRef.current = stored;
      setToken(stored);
      setStorageReady(true);
    }).catch(() => {
      if (cancelled) return;
      setAuthError("Unable to read your saved session. Unlock your device and retry.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [restoreAttempt]);

  useEffect(() => {
    if (!storageReady) return;
    let cancelled = false;

    async function restoreUser() {
      if (!token) {
        setUser(null);
        setAuthError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setAuthError(null);

      try {
        const data = await getCurrentUser(token);

        if (cancelled || tokenRef.current !== token) {
          return;
        }

        if (!data?.user) {
          throw new Error("Unable to restore your account.");
        }

        setUser(data.user);
      } catch (error) {
        if (cancelled || tokenRef.current !== token) {
          return;
        }

        if (error.status === 401 || error.status === 403) {
          try { await sessionStorage().write(null); } catch {
            setAuthError("Unable to clear the expired secure session. Unlock your device and retry.");
            return;
          }
          sessionRevision.current += 1;
          tokenRef.current = null;

          setToken(null);
          setUser(null);
          setAuthError(null);
        } else {
          // Preserve the session during temporary connection failures.
          setAuthError(
            error.message || "Unable to verify your session. Please retry."
          );
        }
      } finally {
        if (!cancelled && tokenRef.current === token) {
          setLoading(false);
        }
      }
    }

    restoreUser();

    return () => {
      cancelled = true;
    };
  }, [token, restoreAttempt, storageReady]);

  const saveSession = useCallback(async (data, migrateGuest = true) => {
    if (
      typeof data?.token !== "string" ||
      !data.token ||
      !data?.user?.id
    ) {
      throw new Error("Invalid authentication response.");
    }

    const revision = sessionRevision.current;
    try {
      await sessionStorage().write(data.token);
    } catch {
      throw new Error("Unable to save your login securely. Unlock your device and retry.");
    }
    if (revision !== sessionRevision.current) throw new Error("Your session changed. Please sign in again.");

    if (migrateGuest) {
      // Storage helpers preserve the existing guest shopping behavior.
      // A migration failure must not undo a successful login.
      try {
        importGuestShopping(data.user);

        const guestBuyNow = readSession("gymdrobe-buy-now", []);

        if (Array.isArray(guestBuyNow) && guestBuyNow.length) {
          const saved = writeSession(
            shoppingKey("gymdrobe-buy-now", data.user),
            guestBuyNow
          );

          if (saved) {
            writeSession("gymdrobe-buy-now", []);
          }
        }
      } catch {
        // Keep guest data available for a later migration attempt.
      }
    }

    sessionRevision.current += 1;
    tokenRef.current = data.token;

    setToken(data.token);
    setUser(data.user);
    setAuthError(null);
    setLoading(false);

    return data.user;
  }, []);

  const googleLogin = useCallback(
    async (credentials) => {
      if (googleLoginBusy.current) {
        throw new Error("A sign-in request is already in progress.");
      }

      const startingRevision = sessionRevision.current;
      googleLoginBusy.current = true;

      try {
        const data = await loginWithGoogle(credentials);

        if (sessionRevision.current !== startingRevision) {
          throw new Error("Your session changed. Please sign in again.");
        }

        await saveSession(data);
        return data;
      } finally {
        googleLoginBusy.current = false;
      }
    },
    [saveSession]
  );

  const appleLogin = useCallback(async (credentials) => {
    if (googleLoginBusy.current) throw new Error("A sign-in request is already in progress.");
    const revision = sessionRevision.current;
    googleLoginBusy.current = true;
    try {
      const data = await loginWithApple(credentials);
      if (revision !== sessionRevision.current) throw new Error("Your session changed. Please sign in again.");
      await saveSession(data);
      return data;
    } finally { googleLoginBusy.current = false; }
  }, [saveSession]);

  const updateProfile = useCallback(
    async ({ name, phone } = {}) => {
      const currentToken = tokenRef.current;

      if (!currentToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const payload = {};

      if (name !== undefined) {
        payload.name = String(name ?? "").trim();
      }

      if (phone !== undefined) {
        payload.phone = String(phone ?? "").replace(/\D/g, "");
      }

      const data = await updateUserProfile(currentToken, payload);

      if (tokenRef.current !== currentToken) {
        throw new Error("Your session changed. Please try again.");
      }

      if (!data?.user) {
        throw new Error("Updated account information was not returned.");
      }

      setUser(data.user);
      return data;
    },
    []
  );

  const refreshUser = useCallback(async () => {
    const currentToken = tokenRef.current;

    if (!currentToken) {
      return null;
    }

    const data = await getCurrentUser(currentToken);

    if (tokenRef.current !== currentToken) {
      return null;
    }

    if (!data?.user) {
      throw new Error("Unable to refresh account information.");
    }

    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    sessionRevision.current += 1;
    const removed = await sessionStorage().write(null);

    sessionRevision.current += 1;
    tokenRef.current = null;

    setToken(null);
    setUser(null);
    setAuthError(null);
    setLoading(false);

    // Avoid automatically selecting the previous Google account.
    window.google?.accounts?.id?.disableAutoSelect();
    if (isNativeApp()) await clearNativeGoogleSession();

    return removed;
  }, []);

  // Retained until the old account-security page is replaced.
  const changePassword = useCallback(async () => {
    return {
      success: false,
      message:
        "Your account uses Google sign-in. Manage your password in your Google account.",
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authError,
      retrySession,
      isAuthenticated: Boolean(user && token),

      googleLogin,
      appleLogin,
      logout,
      updateProfile,
      refreshUser,

      // Compatibility for components that still reference these names.
      login: googleOnly,
      register: googleOnly,
      changePassword,
    }),
    [
      user,
      token,
      loading,
      authError,
      retrySession,
      googleLogin,
      appleLogin,
      logout,
      updateProfile,
      refreshUser,
      changePassword,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("AuthProvider is missing.");
  }

  return context;
}
