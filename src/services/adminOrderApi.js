const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";


// ======================================================
// BASE REQUEST
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
      "Admin login is required."
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


  if (
    !response.ok
  ) {
    const error =
      new Error(
        data.message ||
          "Admin order request failed."
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
// GET RETURN / EXCHANGE REQUESTS
// ======================================================

export async function getAdminReturnRequests(
  token,
  status = ""
) {
  const query =
    status
      ? `?status=${encodeURIComponent(
          status
        )}`
      : "";


  const data =
    await request(
      `/orders/admin/returns${query}`,
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
// APPROVE / REJECT
// ======================================================

export async function reviewReturnRequest(
  token,
  orderId,
  {
    decision,
    response = "",
  }
) {
  const data =
    await request(
      `/orders/admin/returns/${encodeURIComponent(
        orderId
      )}/review`,
      {
        token,

        method:
          "PUT",

        body: {
          decision,
          response,
        },
      }
    );


  return data.order;
}


// ======================================================
// COMPLETE RETURN / EXCHANGE
// ======================================================

export async function completeReturnRequest(
  token,
  orderId,
  {
    response = "",
  } = {}
) {
  const data =
    await request(
      `/orders/admin/returns/${encodeURIComponent(
        orderId
      )}/complete`,
      {
        token,

        method:
          "PUT",

        body: {
          response,
        },
      }
    );


  return data.order;
}


// ======================================================
// RECORD MANUAL REFUND
// ======================================================

export async function recordReturnRefund(
  token,
  orderId,
  {
    reference,
  }
) {
  const cleanReference =
    String(
      reference || ""
    ).trim();


  if (
    cleanReference.length <
    3
  ) {
    throw new Error(
      "Enter a valid refund reference."
    );
  }


  const data =
    await request(
      `/orders/admin/returns/${encodeURIComponent(
        orderId
      )}/refund`,
      {
        token,

        method:
          "PUT",

        body: {
          reference:
            cleanReference,
        },
      }
    );


  return data.order;
}