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
  updateUserProfile,
} from "../services/authApi.js";

import {
  importGuestShopping,
  shoppingKey,
  readSession,
  writeSession,
} from "../utils/shopperStorage.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "gymdrobe-auth-token";

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function storeToken(value) {
  try {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }

    return true;
  } catch {
    return false;
  }
}

async function googleOnly() {
  throw new Error(
    "Please use Continue with Google to access your GymDrobe account."
  );
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(readStoredToken);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

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
          storeToken(null);
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
  }, [token, restoreAttempt]);

  const saveSession = useCallback((data, migrateGuest = true) => {
    if (
      typeof data?.token !== "string" ||
      !data.token ||
      !data?.user?.id
    ) {
      throw new Error("Invalid authentication response.");
    }

    if (!storeToken(data.token)) {
      throw new Error(
        "Unable to save your login session. Allow browser storage and retry."
      );
    }

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

        saveSession(data);
        return data;
      } finally {
        googleLoginBusy.current = false;
      }
    },
    [saveSession]
  );

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
    const removed = storeToken(null);

    sessionRevision.current += 1;
    tokenRef.current = null;

    setToken(null);
    setUser(null);
    setAuthError(null);
    setLoading(false);

    // Avoid automatically selecting the previous Google account.
    window.google?.accounts?.id?.disableAutoSelect();

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