const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

export async function supportRequest(
  token,
  path = "",
  {
    method = "GET",
    body,
    signal,
  } = {},
) {
  if (!token) {
    throw new Error(
      "Please sign in to contact support.",
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_URL}/support${path}`,
      {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),
        },
        body: body
          ? JSON.stringify(body)
          : undefined,
      },
    );
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Connection interrupted. Retry to confirm whether your request was saved.",
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Support returned an unreadable response. Please retry.",
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      "Support is temporarily unavailable.",
    );
  }

  return data;
}