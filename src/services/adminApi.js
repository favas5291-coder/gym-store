const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

async function request(path, token, signal) {
  if (!token) {
    throw new Error(
      "Please sign in to your admin account.",
    );
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Unable to connect to the GymDrobe admin server.",
    );
  }

  const data = await response
    .json()
    .catch(() => null);

  if (
    !response.ok ||
    !data ||
    data.success === false
  ) {
    const error = new Error(
      response.status === 401
        ? "Your session expired. Please sign in again."
        : response.status === 403
          ? "An admin account is required."
          : data?.message ||
            "Admin information could not be loaded.",
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export function getAdminDashboard(
  token,
  { signal } = {},
) {
  return request(
    "/admin/dashboard",
    token,
    signal,
  );
}

export function getAdminCustomers(
  token,
  {
    search = "",
    status = "",
    page = 1,
    limit = 25,
    signal,
  } = {},
) {
  const params = new URLSearchParams({
    search,
    status,
    page: String(page),
    limit: String(limit),
  });

  return request(
    `/admin/customers?${params}`,
    token,
    signal,
  );
}