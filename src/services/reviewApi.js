const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

async function request(
  productId,
  {
    token,
    method = "GET",
    body,
    signal,
  } = {},
) {
  const response = await fetch(
    `${API_URL}/products/${encodeURIComponent(productId)}/reviews`,
    {
      method,
      signal,

      headers: {
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },

      ...(body !== undefined
        ? {
            body: JSON.stringify(body),
          }
        : {}),
    },
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
        "Unable to complete the review request. Please try again.",
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export function getReviews(productId, signal) {
  return request(productId, { signal });
}

export function saveReview(
  productId,
  token,
  body,
) {
  return request(productId, {
    token,
    method: "PUT",
    body,
  });
}

export function deleteReview(productId, token) {
  return request(productId, {
    token,
    method: "DELETE",
  });
}