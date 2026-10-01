const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";


// ======================================================
// BASE REQUEST HELPER
// ======================================================

async function request(
  path,
  {
    token,
    method = "GET",
    body,
  } = {}
) {
  if (!token) {
    throw new Error(
      "You must be logged in."
    );
  }


  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        method,

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          body !== undefined
            ? JSON.stringify(
                body
              )
            : undefined,
      }
    );


  let data = {};


  try {
    data =
      await response.json();
  } catch {
    data = {};
  }


  if (!response.ok) {
    const error =
      new Error(
        data.message ||
          "Order request failed."
      );


    error.status =
      response.status;


    error.data =
      data;


    throw error;
  }


  return data;
}


// ======================================================
// CREATE ORDER
// ======================================================

export async function createOrder(
  token,
  orderData
) {
  return request(
    "/orders",
    {
      token,

      method:
        "POST",

      body:
        orderData,
    }
  );
}


// ======================================================
// GET ALL CURRENT USER ORDERS
// ======================================================

export async function getOrders(
  token
) {
  const data =
    await request(
      "/orders",
      {
        token,
      }
    );


  return Array.isArray(
    data.orders
  )
    ? data.orders
    : [];
}


// ======================================================
// GET ONE ORDER
// ======================================================

export async function getOrderById(
  token,
  id
) {
  const data =
    await request(
      `/orders/${encodeURIComponent(
        id
      )}`,
      {
        token,
      }
    );


  return data.order;
}


// ======================================================
// CANCEL ORDER
// ======================================================

export async function cancelOrder(
  token,
  id,
  reason
) {
  const data =
    await request(
      `/orders/${encodeURIComponent(
        id
      )}/cancel`,
      {
        token,

        method:
          "PUT",

        body: {
          reason,
        },
      }
    );


  return data.order;
}