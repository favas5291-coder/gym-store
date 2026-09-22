import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser =
        localStorage.getItem("gymdrobe-user");

      return savedUser
        ? JSON.parse(savedUser)
        : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(
        "gymdrobe-user",
        JSON.stringify(user)
      );
    } else {
      localStorage.removeItem("gymdrobe-user");
    }
  }, [user]);

  function signup(userData) {
    const newUser = {
      id: Date.now(),
      name: userData.name,
      email: userData.email,
      phone: userData.phone || "",
      createdAt: new Date().toISOString(),
    };

    setUser(newUser);

    return {
      success: true,
      user: newUser,
    };
  }

  function login(email) {
    const savedUser =
      localStorage.getItem("gymdrobe-user");

    if (!savedUser) {
      return {
        success: false,
        message: "Account not found.",
      };
    }

    try {
      const existingUser = JSON.parse(savedUser);

      if (
        existingUser.email.toLowerCase() !==
        email.toLowerCase()
      ) {
        return {
          success: false,
          message: "Invalid email.",
        };
      }

      setUser(existingUser);

      return {
        success: true,
        user: existingUser,
      };
    } catch {
      return {
        success: false,
        message: "Unable to login.",
      };
    }
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        signup,
        login,
        logout,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthProvider;