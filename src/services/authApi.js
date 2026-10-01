const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";


// ======================================================
// REGISTER
// ======================================================

export async function registerUser(
  userData
) {
  const response =
    await fetch(
      `${API_URL}/auth/register`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            userData
          ),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Registration failed."
    );
  }

  return data;
}


// ======================================================
// LOGIN
// ======================================================

export async function loginUser(
  credentials
) {
  const response =
    await fetch(
      `${API_URL}/auth/login`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            credentials
          ),
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Login failed."
    );
  }

  return data;
}


// ======================================================
// GET CURRENT USER
// ======================================================

export async function getCurrentUser(
  token
) {
  const response =
    await fetch(
      `${API_URL}/auth/me`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to load user."
    );
  }

  return data;
}