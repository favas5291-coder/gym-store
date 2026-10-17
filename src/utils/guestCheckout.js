const API_URL = String(
  import.meta.env?.VITE_API_URL ||
    "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

const KEY = "gymdrobe-guest-order-access-v1";

let memory = null;
let creating = null;

function validToken(value) {
  return (
    typeof value === "string" &&
    /^gco_[a-f0-9]{64}$/.test(value)
  );
}

function usableAccess(value) {
  return (
    validToken(value?.token) &&
    Date.parse(value.expiresAt) > Date.now()
  );
}

export function guestAccess() {
  // A newly restored code takes precedence if an older
  // browser copy could not be overwritten.
  if (usableAccess(memory)) {
    return memory;
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem(KEY) || "null",
    );

    if (usableAccess(stored)) {
      memory = {
        ...stored,
        persistent: true,
      };

      return memory;
    }
  } catch {
    // Try the tab copy if local storage is unavailable.
  }

  try {
    const stored = JSON.parse(
      sessionStorage.getItem(KEY) || "null",
    );

    if (usableAccess(stored)) {
      memory = {
        ...stored,
        persistent: false,
      };

      return memory;
    }
  } catch {
    // No usable browser copy is available.
  }

  return null;
}

export function customerHeaders(token) {
  const guest = guestAccess();

  return {
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),

    ...(guest
      ? {
          "X-GymDrobe-Guest": guest.token,
        }
      : {}),
  };
}

function remember(value) {
  let saved = false;

  const stored = {
    ...value,
    persistent: true,
  };

  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(stored),
    );

    saved = true;
  } catch {
    stored.persistent = false;
  }

  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify(stored),
    );

    saved = true;
  } catch {
    // A saved local-storage copy is sufficient.
  }

  if (!saved) {
    throw new Error(
      "Enable browser storage before guest payment so your order access can be recovered. No payment was started.",
    );
  }

  memory = stored;

  window.dispatchEvent(
    new Event("gymdrobe-orders-updated"),
  );

  window.dispatchEvent(
    new Event("gymdrobe-guest-access-changed"),
  );

  return stored;
}

async function sessionRequest(
  method,
  token = "",
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    20000,
  );

  try {
    const response = await fetch(
      `${API_URL}/payments/guest-session`,
      {
        method,
        cache: "no-store",
        signal: controller.signal,

        headers: {
          Accept: "application/json",

          ...(token
            ? {
                "X-GymDrobe-Guest": token,
              }
            : {}),
        },
      },
    );

    const data = await response.json().catch(
      () => null,
    );

    if (
      !response.ok ||
      data?.success !== true
    ) {
      throw new Error(
        data?.message ||
          "Guest access could not be checked. Please retry.",
      );
    }

    const credential =
      data.guestToken || token;

    if (
      !validToken(credential) ||
      !(
        Date.parse(data.expiresAt) >
        Date.now()
      )
    ) {
      throw new Error(
        "Guest access could not be verified.",
      );
    }

    return remember({
      token: credential,
      expiresAt: data.expiresAt,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "The guest access check timed out. Please retry. No payment was started.",
      );
    }

    if (error?.name === "TypeError") {
      throw new Error(
        "Cannot reach GymDrobe to prepare guest access. Check your connection and retry. No payment was started.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureGuestAccess() {
  const current = guestAccess();

  if (current) {
    return current;
  }

  // Concurrent checkout actions share one preparation request.
  if (!creating) {
    creating = sessionRequest("POST").finally(
      () => {
        creating = null;
      },
    );
  }

  return creating;
}

export function restoreGuestAccess(code) {
  const token = String(code || "").trim();

  if (!validToken(token)) {
    throw new Error(
      "Paste the complete private guest access code beginning gco_.",
    );
  }

  return sessionRequest("GET", token);
}