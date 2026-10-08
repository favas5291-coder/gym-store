const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

export async function supportRequest(
  token,
  path = "",
  { method = "GET", body, signal } = {},
) {
  if (!token) {
    const error = new Error("Please sign in to contact support.");
    error.status = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_URL}/support${path}`, {
      method,
      signal,
      headers,
      cache: "no-store",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (failure) {
    if (failure.name === "AbortError") throw failure;

    const error = new Error(
      method === "GET"
        ? "Unable to load support requests. Check your connection and retry."
        : "The connection was interrupted. Check your conversation or inbox before retrying; your message may have been saved.",
    );

    error.code = "NETWORK_ERROR";
    throw error;
  }

  const data = await response.json().catch(() => null);

  if (
    !response.ok ||
    !data ||
    typeof data !== "object" ||
    data.success !== true
  ) {
    let message = data?.message;

    if (typeof message !== "string" || !message.trim()) {
      if (response.status === 401) {
        message = "Your session has expired. Please sign in again.";
      } else if (response.status === 403) {
        message = "You do not have permission to access this support request.";
      } else if (response.status === 404) {
        message = "This support request could not be found.";
      } else if (response.status === 429) {
        message = "Too many requests. Please wait and try again.";
      } else {
        message =
          method === "GET"
            ? "Support returned an unexpected response. Please retry."
            : "The server could not confirm this update. Check your inbox before retrying; it may have been saved.";
      }
    }

    const error = new Error(message);
    error.status = response.status;
    error.code = data?.code || "SUPPORT_REQUEST_FAILED";
    error.data = data;

    throw error;
  }

  return data;
}