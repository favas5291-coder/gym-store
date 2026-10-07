const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

function authError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function fallbackCode(status) {
  if (status === 401) return "SESSION_EXPIRED";
  if (status === 403) return "ACCESS_DENIED";
  if (status === 429) return "TOO_MANY_ATTEMPTS";
  if (status >= 500) return "SERVICE_UNAVAILABLE";
  return "REQUEST_FAILED";
}

async function request(
  path,
  { method = "GET", token, body, signal } = {}
) {
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;

  function cancelRequest() {
    controller.abort();
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  signal?.addEventListener("abort", cancelRequest, { once: true });

  // Allow time for a sleeping backend to start.
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 60000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      cache: "no-store",
      signal: controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data;

    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;

      throw authError(
        "GymDrobe returned an unreadable response. Please try again.",
        response.ok ? "INVALID_RESPONSE" : fallbackCode(response.status),
        { status: response.status }
      );
    }

    if (!response.ok || !data || data.success === false) {
      const retryAfter = response.headers.get("Retry-After");
      let retryAfterSeconds = 0;

      if (retryAfter) {
        const seconds = Number(retryAfter);

        retryAfterSeconds = Number.isFinite(seconds)
          ? Math.max(0, Math.ceil(seconds))
          : Math.max(
              0,
              Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000) || 0
            );
      }

      throw authError(
        data?.message || "Your request could not be completed.",
        data?.code || fallbackCode(response.status),
        {
          status: response.status,
          retryAfterSeconds,
          data,
        }
      );
    }

    return data;
  } catch (error) {
    // Component cancellation is not a customer-facing failure.
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (timedOut) {
      throw authError(
        "GymDrobe took too long to respond. Please try again.",
        "REQUEST_TIMEOUT"
      );
    }

    // Preserve errors already classified above.
    if (error.code) throw error;

    if (navigator.onLine === false) {
      throw authError(
        "Your device appears to be offline. Reconnect and try again.",
        "OFFLINE"
      );
    }

    // Browsers do not reliably distinguish a server outage,
    // a blocked request and a connection failure.
    throw authError(
      "Your browser could not reach GymDrobe. Check your connection and try again.",
      "CONNECTION_FAILED"
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancelRequest);
  }
}

function requireToken(token) {
  if (!token) {
    throw authError(
      "Your session has expired. Please sign in again.",
      "SESSION_EXPIRED",
      { status: 401 }
    );
  }
}

export async function getGoogleChallenge({ signal } = {}) {
  const data = await request("/auth/google/challenge", { signal });

  if (
    typeof data.nonce !== "string" ||
    !data.nonce ||
    typeof data.challenge !== "string" ||
    !data.challenge
  ) {
    throw authError(
      "Google sign-in could not start. Please try again.",
      "INVALID_RESPONSE"
    );
  }

  return data;
}

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
    throw authError(
      "Start a new Google sign-in attempt.",
      "SIGNIN_RESTART_REQUIRED"
    );
  }

  const body = { credential, challenge };

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

  if (
    !profileData ||
    typeof profileData !== "object" ||
    Array.isArray(profileData)
  ) {
    throw authError(
      "Profile information is required.",
      "INVALID_PROFILE"
    );
  }

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(profileData, "name")) {
    payload.name = String(profileData.name ?? "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(profileData, "phone")) {
    payload.phone = String(profileData.phone ?? "").replace(/\D/g, "");
  }

  if (!Object.keys(payload).length) {
    throw authError(
      "No profile changes were provided.",
      "INVALID_PROFILE"
    );
  }

  return request("/auth/profile", {
    method: "PUT",
    token,
    body: payload,
  });
}

// Keep older imports working during the Google-only migration.
function googleOnly() {
  throw authError(
    "Use Continue with Google to access your GymDrobe account.",
    "GOOGLE_ONLY"
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