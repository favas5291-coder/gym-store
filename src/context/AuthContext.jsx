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
  changeUserPassword,
  getCurrentUser,
  loginUser,
  registerUser,
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

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(readStoredToken);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  const tokenRef = useRef(token);

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

        if (cancelled || tokenRef.current !== token) return;

        if (!data?.user) {
          throw new Error("Unable to restore your account.");
        }

        setUser(data.user);
      } catch (error) {
        if (cancelled || tokenRef.current !== token) return;

        if (error.status === 401 || error.status === 403) {
          storeToken(null);
          tokenRef.current = null;
          setToken(null);
          setUser(null);
          setAuthError(null);
        } else {
          // A network or server failure does not invalidate the token.
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
    if (typeof data?.token !== "string" || !data.token || !data?.user) {
      throw new Error("Invalid authentication response.");
    }

    if (!storeToken(data.token)) {
      throw new Error("Unable to save your login session.");
    }

    if (migrateGuest) {
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
    }

    tokenRef.current = data.token;
    setToken(data.token);
    setUser(data.user);
    setAuthError(null);
    setLoading(false);

    return data.user;
  }, []);

  const register = useCallback(
    async ({ name, email, password, phone = "" }) => {
      const data = await registerUser({ name, email, password, phone });
      saveSession(data);
      return data;
    },
    [saveSession]
  );

  const login = useCallback(
    async ({ email, password }) => {
      const data = await loginUser({ email, password });
      saveSession(data);
      return data;
    },
    [saveSession]
  );

  const updateProfile = useCallback(
    async ({ name, phone }) => {
      if (!token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const payload = {};

      if (name !== undefined) {
        payload.name = String(name ?? "").trim();
      }

      if (phone !== undefined) {
        payload.phone = String(phone ?? "").replace(/\D/g, "");
      }

      const data = await updateUserProfile(token, payload);

      if (tokenRef.current !== token) {
        throw new Error("Your session changed. Please try again.");
      }

      if (!data?.user) {
        throw new Error("Updated account information was not returned.");
      }

      setUser(data.user);
      return data;
    },
    [token]
  );

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!token) {
        return {
          success: false,
          message: "Your session has expired. Please sign in again.",
        };
      }

      try {
        const result = await changeUserPassword(token, {
          currentPassword,
          newPassword,
        });

        if (tokenRef.current !== token) {
          return {
            success: false,
            message: "Your session changed. Sign in with your new password.",
          };
        }

        // The backend invalidates the old token after a password change.
        // Save the replacement without importing guest shopping again.
        saveSession(result, false);

        return {
          success: true,
          message: result.message || "Password changed successfully.",
        };
      } catch (error) {
        return {
          success: false,
          message: error.message || "Unable to change password.",
        };
      }
    },
    [token, saveSession]
  );

  const refreshUser = useCallback(async () => {
    if (!token) return null;

    const data = await getCurrentUser(token);

    if (tokenRef.current !== token) return null;

    if (!data?.user) {
      throw new Error("Unable to refresh account information.");
    }

    setUser(data.user);
    return data.user;
  }, [token]);

  const logout = useCallback(async () => {
    storeToken(null);
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setAuthError(null);
    setLoading(false);

    return true;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authError,
      retrySession,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refreshUser,
    }),
    [
      user,
      token,
      loading,
      authError,
      retrySession,
      login,
      register,
      logout,
      updateProfile,
      changePassword,
      refreshUser,
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