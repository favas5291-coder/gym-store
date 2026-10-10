const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
)
  .trim()
  .replace(/\/+$/, "");

async function request(
  path,
  token,
  {
    method = "GET",
    body,
    signal,
  } = {},
) {
  if (!token) {
    throw new Error(
      "Please sign in to your admin account.",
    );
  }

  const headers = {
    Accept: "application/json",
    Authorization: "Bearer " + token,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(API_URL + path, {
      method,
      headers,
      signal,
      cache: "no-store",

      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Unable to connect to the GymDrobe admin server. Check the connection and retry.",
    );
  }

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok || data?.success !== true) {
    const error = new Error(
      data?.message ||
        (response.status === 401
          ? "Your session expired. Please sign in again."
          : response.status === 403
            ? "An admin account is required."
            : "Admin information could not be loaded."),
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getAdminDashboard(
  token,
  {
    days = 7,
    source = "real",
    signal,
  } = {},
) {
  const params = new URLSearchParams({
    days: String(days),
    source,
  });

  const data = await request(
    "/admin/dashboard?" + params,
    token,
    { signal },
  );

  if (
    !data.stats ||
    !data.sales?.summary ||
    !Array.isArray(data.sales?.points) ||
    !Array.isArray(data.recentOrders)
  ) {
    throw new Error(
      "The dashboard response is incomplete. Check that the backend admin update is running.",
    );
  }

  return data;
}

export async function getAdminCustomers(
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

  const data = await request(
    "/admin/customers?" + params,
    token,
    { signal },
  );

  if (!Array.isArray(data.customers)) {
    throw new Error(
      "The customer list could not be read. Please retry.",
    );
  }

  return data;
}

export function setAdminCustomerStatus(
  token,
  customer,
  isActive,
  { signal } = {},
) {
  return request(
    "/admin/customers/" +
      encodeURIComponent(customer.id) +
      "/status",
    token,
    {
      method: "PATCH",
      signal,

      body: {
        isActive,
        expectedIsActive: customer.isActive,
      },
    },
  );
}