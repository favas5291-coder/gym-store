const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

async function request(
  path,
  { method = "GET", token, body, signal } = {}
) {
  const headers = {
    Accept: "application/json",
  };

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
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

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
    error.code = data?.code;
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

// Prepare a Google sign-in attempt.
export async function getGoogleChallenge({ signal } = {}) {
  const data = await request("/auth/google/challenge", { signal });

  if (
    typeof data.nonce !== "string" ||
    typeof data.challenge !== "string"
  ) {
    throw new Error("Google sign-in could not start.");
  }

  return data;
}

// Verify Google credentials on the backend.
// existingPassword is only used when linking certain existing accounts.
export async function loginWithGoogle({
  credential,
  challenge,
  existingPassword,
} = {}) {
  if (
    typeof credential !== "string" ||
    !credential ||
    typeof challenge !== "string" ||
    !challenge
  ) {
    throw new Error("Please start Google sign-in again.");
  }

  const body = {
    credential,
    challenge,
  };

  if (existingPassword !== undefined) {
    body.existingPassword = existingPassword;
  }

  return request("/auth/google", {
    method: "POST",
    body,
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

// Compatibility exports prevent older pages from breaking
// while we replace the password screens.
function googleOnly() {
  throw new Error(
    "Please use Continue with Google to access your GymDrobe account."
  );
}

export async function registerUser() {
  return googleOnly();
}

export async function loginUser() {
  return googleOnly();
}

export async function changeUserPassword() {
  return googleOnly();
}

export async function requestPasswordReset() {
  return googleOnly();
}

export async function resetUserPassword() {
  return googleOnly();
}