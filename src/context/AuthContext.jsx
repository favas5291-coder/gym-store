import { createContext, useContext, useEffect, useState } from "react";
import { importGuestShopping } from "../utils/shopperStorage.js";
import {
  makeId,
  readStorage,
  removeStorage,
  writeStorage,
} from "../utils/storage.js";
const AuthContext = createContext(null);
const ACCOUNTS = "gymdrobe-demo-accounts-v2",
  SESSION = "gymdrobe-user";
const cleanEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const profile = (value) =>
  value &&
  typeof value === "object" &&
  value.id &&
  typeof value.email === "string" &&
  typeof value.name === "string"
    ? {
        id: value.id,
        name: value.name,
        email: cleanEmail(value.email),
        phone: value.phone || "",
        createdAt: value.createdAt,
      }
    : null;
function accounts() {
  const saved = readStorage(ACCOUNTS, []);
  return Array.isArray(saved)
    ? saved.filter((a) => profile(a) && a.salt && a.hash)
    : [];
}
async function hashPassword(password, salt) {
  if (!crypto.subtle)
    throw new Error("Account previews require localhost or HTTPS.");
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: bytes.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
// Device-local account preview. Production authentication belongs on a server.
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(() => profile(readStorage(SESSION, null)));
  useEffect(() => {
    const sync = (event) => {
      if (event.key === SESSION || event.key === null)
        setUser(profile(readStorage(SESSION, null)));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  async function signup(data) {
    const email = cleanEmail(data.email),
      name = String(data.name || "").trim(),
      password = String(data.password || "");
    if (
      name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8
    )
      return {
        success: false,
        message:
          "Enter your name, a valid email and a password with at least 8 characters.",
      };
    try {
      if (accounts().some((a) => a.email === email))
        return {
          success: false,
          message: "This email already has a preview account. Please sign in.",
        };
      const archived = readStorage("gymdrobe-legacy-profiles", []);
      const legacy =
        profile(readStorage(SESSION, null)) ||
        (Array.isArray(archived)
          ? archived.map(profile).find((p) => p?.email === email)
          : null);
      const salt = makeId("salt");
      const record = {
        id: legacy?.email === email ? legacy.id : makeId("user"),
        name,
        email,
        phone: data.phone || "",
        createdAt: new Date().toISOString(),
        salt,
        hash: await hashPassword(password, salt),
      };
      const latest = accounts();
      if (latest.some((a) => a.email === email))
        return {
          success: false,
          message: "This email already has an account.",
        };
      if (!writeStorage(ACCOUNTS, [...latest, record]))
        throw new Error(
          "Browser storage is unavailable. Enable storage to save an account.",
        );
      const next = profile(record);
      importGuestShopping(next);
      if (!writeStorage(SESSION, next))
        throw new Error(
          "Account saved, but sign-in could not be saved. Please try signing in.",
        );
      setUser(next);
      return { success: true, user: next };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Unable to create account.",
      };
    }
  }
  async function login(email, password) {
    try {
      const record = accounts().find((a) => a.email === cleanEmail(email));
      if (
        !record ||
        (await hashPassword(String(password || ""), record.salt)) !==
          record.hash
      )
        return { success: false, message: "Email or password is incorrect." };
      const next = profile(record);
      importGuestShopping(next);
      if (!writeStorage(SESSION, next))
        throw new Error(
          "Browser storage is unavailable. Enable storage to sign in.",
        );
      setUser(next);
      return { success: true, user: next };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  function logout() {
    if (
      user &&
      !accounts().some((account) => String(account.id) === String(user.id))
    ) {
      const saved = readStorage("gymdrobe-legacy-profiles", []);
      const legacy = Array.isArray(saved)
        ? saved.filter((item) => item?.email !== user.email)
        : [];
      writeStorage("gymdrobe-legacy-profiles", [...legacy, user]);
    }
    if (!removeStorage(SESSION))
      throw new Error("Could not clear the session.");
    setUser(null);
  }
  function updateProfile(data) {
    if (!user) return false;
    const next = {
      ...user,
      name: String(data.name || "").trim(),
      phone: String(data.phone || "").trim(),
    };
    if (next.name.length < 2) return false;
    const records = accounts().map((record) =>
      String(record.id) === String(user.id)
        ? { ...record, name: next.name, phone: next.phone }
        : record,
    );
    if (!writeStorage(ACCOUNTS, records) || !writeStorage(SESSION, next))
      return false;
    setUser(next);
    return true;
  }
  async function changePassword(current, next) {
    if (!user || String(next).length < 8)
      return {
        success: false,
        message: "Use at least 8 characters for the new password.",
      };
    try {
      const records = accounts(),
        record = records.find((a) => String(a.id) === String(user.id));
      if (
        !record ||
        (await hashPassword(String(current), record.salt)) !== record.hash
      )
        return { success: false, message: "Current password is incorrect." };
      if (current === next)
        return { success: false, message: "Choose a different new password." };
      const salt = makeId("salt"),
        hash = await hashPassword(String(next), salt);
      if (
        !writeStorage(
          ACCOUNTS,
          accounts().map((a) =>
            String(a.id) === String(user.id) ? { ...a, salt, hash } : a,
          ),
        )
      )
        throw new Error("Unable to save the password.");
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        signup,
        login,
        logout,
        updateProfile,
        changePassword,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is missing.");
  return context;
}