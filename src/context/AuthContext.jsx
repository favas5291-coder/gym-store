import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentUser,
  loginUser,
  registerUser,
} from "../services/authApi.js";


const AuthContext =
  createContext(null);

const TOKEN_KEY =
  "gymdrobe-auth-token";


// ======================================================
// PROVIDER
// ======================================================

export default function AuthProvider({
  children,
}) {
  const [
    user,
    setUser,
  ] = useState(null);

  const [
    token,
    setToken,
  ] = useState(() =>
    localStorage.getItem(
      TOKEN_KEY
    )
  );

  const [
    loading,
    setLoading,
  ] = useState(true);


  // ======================================================
  // RESTORE LOGIN
  // ======================================================

  useEffect(() => {
    let cancelled =
      false;

    async function restoreUser() {
      if (!token) {
        setUser(null);
        setLoading(false);

        return;
      }

      try {
        setLoading(true);

        const data =
          await getCurrentUser(
            token
          );

        if (!cancelled) {
          setUser(
            data.user
          );
        }
      } catch (error) {
        console.error(
          "Auth restore error:",
          error
        );

        localStorage.removeItem(
          TOKEN_KEY
        );

        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restoreUser();

    return () => {
      cancelled = true;
    };
  }, [token]);


  // ======================================================
  // SAVE SESSION
  // ======================================================

  function saveSession(
    data
  ) {
    localStorage.setItem(
      TOKEN_KEY,
      data.token
    );

    setToken(
      data.token
    );

    setUser(
      data.user
    );

    return data.user;
  }


  // ======================================================
  // REGISTER
  // ======================================================

  async function register({
    name,
    email,
    password,
  }) {
    const data =
      await registerUser({
        name,
        email,
        password,
      });

    saveSession(
      data
    );

    return data;
  }


  // ======================================================
  // LOGIN
  // ======================================================

  async function login({
    email,
    password,
  }) {
    const data =
      await loginUser({
        email,
        password,
      });

    saveSession(
      data
    );

    return data;
  }


  // ======================================================
  // LOGOUT
  // ======================================================

  function logout() {
    localStorage.removeItem(
      TOKEN_KEY
    );

    setToken(null);

    setUser(null);
  }


  // ======================================================
  // CONTEXT VALUE
  // ======================================================

  const value =
    useMemo(
      () => ({
        user,

        token,

        loading,

        isAuthenticated:
          Boolean(
            user &&
            token
          ),

        login,

        register,

        logout,
      }),

      [
        user,
        token,
        loading,
      ]
    );


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
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

  if (!context) {
    throw new Error(
      "AuthProvider is missing."
    );
  }

  return context;
}