const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).trim().replace(/\/+$/, "");

async function request(path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      cache: "no-store",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      "Unable to connect to GymDrobe. Check your connection and try again."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.success === false) {
    const error = new Error(
      data?.message ||
        (response.ok
          ? "The server returned an unreadable response."
          : "Authentication request failed.")
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function requireToken(token) {
  if (!token) {
    throw new Error("Please sign in again.");
  }
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  if (new TextEncoder().encode(password).length > 72) {
    throw new Error("Password cannot exceed 72 UTF-8 bytes.");
  }
}

export async function registerUser(userData) {
  if (!userData || typeof userData !== "object") {
    throw new Error("Registration information is required.");
  }

  validatePassword(userData.password);

  return request("/auth/register", {
    method: "POST",
    body: {
      name: String(userData.name ?? "").trim(),
      email: String(userData.email ?? "").trim().toLowerCase(),
      phone: String(userData.phone ?? "").replace(/\D/g, ""),
      password: userData.password,
    },
  });
}

export async function loginUser(credentials) {
  if (!credentials || typeof credentials !== "object") {
    throw new Error("Login information is required.");
  }

  return request("/auth/login", {
    method: "POST",
    body: {
      email: String(credentials.email ?? "").trim().toLowerCase(),
      password: credentials.password,
    },
  });
}

export async function getCurrentUser(token) {
  requireToken(token);
  return request("/auth/me", { token });
}

export async function updateUserProfile(token, profileData) {
  requireToken(token);

  if (!profileData || typeof profileData !== "object") {
    throw new Error("Profile information is required.");
  }

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(profileData, "name")) {
    payload.name = String(profileData.name ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(profileData, "phone")) {
    payload.phone = String(profileData.phone ?? "").replace(/\D/g, "");
  }

  if (!Object.keys(payload).length) {
    throw new Error("No profile changes were provided.");
  }

  return request("/auth/profile", {
    method: "PUT",
    token,
    body: payload,
  });
}

export async function changeUserPassword(
  token,
  { currentPassword, newPassword } = {}
) {
  requireToken(token);

  if (typeof currentPassword !== "string" || !currentPassword) {
    throw new Error("Current password is required.");
  }

  validatePassword(newPassword);

  if (currentPassword === newPassword) {
    throw new Error("Choose a different new password.");
  }

  // Keep the new token and user returned by the backend.
  return request("/auth/password", {
    method: "PUT",
    token,
    body: { currentPassword, newPassword },
  });
}

export async function requestPasswordReset(email) {
  const normalized = String(email ?? "").trim().toLowerCase();

  if (
    normalized.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error("Please enter a valid email address.");
  }

  return request("/auth/forgot-password", {
    method: "POST",
    body: { email: normalized },
  });
}

export async function resetUserPassword({ token, newPassword } = {}) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    throw new Error("This reset link is invalid. Request a new link.");
  }

  validatePassword(newPassword);

  return request("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });
}