import { importGuestShopping, shoppingKey, readSession, writeSession } from "../utils/shopperStorage.js";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  changeUserPassword,
  getCurrentUser,
  loginUser,
  registerUser,
  updateUserProfile,
} from "../services/authApi.js";
const AuthContext =
  createContext(null);
const TOKEN_KEY =
  "gymdrobe-auth-token";
// ======================================================
// TOKEN STORAGE
// ======================================================
function readStoredToken() {
  try {
    return (
      localStorage.getItem(
        TOKEN_KEY
      ) || null
    );
  } catch {
    return null;
  }
}
function storeToken(
  value
) {
  try {
    if (
      value
    ) {
      localStorage.setItem(
        TOKEN_KEY,
        value
      );
    } else {
      localStorage.removeItem(
        TOKEN_KEY
      );
    }
    return true;
  } catch {
    return false;
  }
}
// ======================================================
// PROVIDER
// ======================================================
export default function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] =
    useState(null);
  const [
    token,
    setToken,
  ] =
    useState(
      readStoredToken
    );
  const [
    loading,
    setLoading,
  ] =
    useState(true);
  const [authError, setAuthError] = useState(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const retrySession = useCallback(() => setRestoreAttempt(value => value + 1), []);

  useEffect(() => {
    window.addEventListener("online", retrySession);
    return () => window.removeEventListener("online", retrySession);
  }, [retrySession]);

  // ====================================================
  // RESTORE USER
  // ====================================================
  useEffect(
    () => {
      let cancelled =
        false;
      async function restoreUser() {
        if (
          !token
        ) {
          if (
            !cancelled
          ) {
            setUser(
              null
            );
            setLoading(
              false
            );
          }
          return;
        }
        try {
          setAuthError(null);
          setLoading(
            true
          );
          const data =
            await getCurrentUser(
              token
            );
          if (
            cancelled
          ) {
            return;
          }
          if (
            !data?.user
          ) {
            throw new Error(
              "Unable to restore your account."
            );
          }
          setUser(
            data.user
          );
        } catch (error) {
          if (cancelled) return;
          if (error.status === 401 || error.status === 403) {
            storeToken(null);
            setToken(null);
            setUser(null);
            setAuthError(null);
          } else {
            // Retain the token; a network failure does not invalidate a session.
            setAuthError(error.message || "Unable to verify your session. Please retry.");
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      }
      restoreUser();
      return () => {
        cancelled =
          true;
      };
    },
    [
      token,
      restoreAttempt,
    ]
  );
  // ====================================================
  // SAVE SESSION
  // ====================================================
  const saveSession =
    useCallback(
      (
        data
      ) => {
        if (
          !data?.token ||
          !data?.user
        ) {
          throw new Error(
            "Invalid authentication response."
          );
        }
        const saved =
          storeToken(
            data.token
          );
        if (
          !saved
        ) {
          throw new Error(
            "Unable to save your login session."
          );
        }
        importGuestShopping(data.user);
        const guestBuyNow = readSession("gymdrobe-buy-now", []);
        if (Array.isArray(guestBuyNow) && guestBuyNow.length) {
          if (writeSession(shoppingKey("gymdrobe-buy-now", data.user), guestBuyNow)) {
            writeSession("gymdrobe-buy-now", []);
          }
        }
        setAuthError(null);
        setToken(
          data.token
        );
        setUser(
          data.user
        );
        return (
          data.user
        );
      },
      []
    );
  // ====================================================
  // REGISTER
  // ====================================================
  const register =
    useCallback(
      async ({
        name,
        email,
        password,
        phone = "",
      }) => {
        const data =
          await registerUser({
            name,
            email,
            password,
            phone,
          });
        saveSession(
          data
        );
        return data;
      },
      [
        saveSession,
      ]
    );
  // ====================================================
  // LOGIN
  // ====================================================
  const login =
    useCallback(
      async ({
        email,
        password,
      }) => {
        const data =
          await loginUser({
            email,
            password,
          });
        saveSession(
          data
        );
        return data;
      },
      [
        saveSession,
      ]
    );
  // ====================================================
  // UPDATE PROFILE
  // ====================================================
  const updateProfile =
    useCallback(
      async ({
        name,
        phone,
      }) => {
        if (
          !token
        ) {
          throw new Error(
            "Your sign-in session has expired. Please sign in again."
          );
        }
        const payload =
          {};
        if (
          name !==
          undefined
        ) {
          payload.name =
            String(
              name ?? ""
            ).trim();
        }
        if (
          phone !==
          undefined
        ) {
          payload.phone =
            String(
              phone ?? ""
            ).replace(
              /\D/g,
              ""
            );
        }
        const data =
          await updateUserProfile(
            token,
            payload
          );
        if (
          !data?.user
        ) {
          throw new Error(
            "Profile was updated but the new account information was not returned."
          );
        }
        setUser(
          data.user
        );
        return data;
      },
      [
        token,
      ]
    );
  // ====================================================
  // CHANGE PASSWORD
  // ====================================================
  const changePassword =
    useCallback(
      async (
        currentPassword,
        newPassword
      ) => {
        if (
          !token
        ) {
          return {
            success:
              false,
            message:
              "Your sign-in session has expired. Please sign in again.",
          };
        }
        try {
          const result =
            await changeUserPassword(
              token,
              {
                currentPassword,
                newPassword,
              }
            );
          return {
            success:
              Boolean(
                result.success
              ),
            message:
              result.message ||
              "Password changed successfully.",
          };
        } catch (
          error
        ) {
          console.error(
            "Change password error:",
            error
          );
          return {
            success:
              false,
            message:
              error.message ||
              "Unable to change password.",
          };
        }
      },
      [
        token,
      ]
    );
  // ====================================================
  // REFRESH USER
  // ====================================================
  const refreshUser =
    useCallback(
      async () => {
        if (
          !token
        ) {
          return null;
        }
        const data =
          await getCurrentUser(
            token
          );
        if (
          !data?.user
        ) {
          throw new Error(
            "Unable to refresh account information."
          );
        }
        setUser(
          data.user
        );
        return (
          data.user
        );
      },
      [
        token,
      ]
    );
  // ====================================================
  // LOGOUT
  // ====================================================
  const logout =
    useCallback(
      async () => {
        storeToken(
          null
        );
        setToken(
          null
        );
        setUser(
          null
        );
        return true;
      },
      []
    );
  // ====================================================
  // CONTEXT VALUE
  // ====================================================
  const value =
    useMemo(
      () => ({
        user,
        token,
        loading,
        authError,
        retrySession,
        isAuthenticated:
          Boolean(
            user &&
            token
          ),
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
    <AuthContext.Provider
      value={
        value
      }
    >
      {
        children
      }
    </AuthContext.Provider>
  );
}
// ======================================================
// HOOK
// ======================================================
export function useAuth() {
  const context =
    useContext(
      AuthContext
    );
  if (
    !context
  ) {
    throw new Error(
      "AuthProvider is missing."
    );
  }
  return context;
}