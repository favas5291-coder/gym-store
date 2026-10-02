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
// ADMIN — GET ALL ORDERS
// ======================================================

export async function getAdminOrders(
  token,
  {
    status = "",
    search = "",
    page = 1,
    limit = 25,
  } = {}
) {
  const params =
    new URLSearchParams();


  if (
    status &&
    status !==
      "all"
  ) {
    params.set(
      "status",
      status
    );
  }


  if (
    String(
      search
    ).trim()
  ) {
    params.set(
      "search",
      String(
        search
      ).trim()
    );
  }


  params.set(
    "page",
    String(
      page
    )
  );


  params.set(
    "limit",
    String(
      limit
    )
  );


  const query =
    params.toString();


  const data =
    await request(
      `/orders/admin/orders${
        query
          ? `?${query}`
          : ""
      }`,
      {
        token,
      }
    );


  return {
    orders:
      Array.isArray(
        data.orders
      )
        ? data.orders
        : [],

    count:
      Number(
        data.count ||
        0
      ),

    total:
      Number(
        data.total ||
        0
      ),

    page:
      Number(
        data.page ||
        1
      ),

    pages:
      Number(
        data.pages ||
        1
      ),

    limit:
      Number(
        data.limit ||
        limit
      ),
  };
}


// ======================================================
// ADMIN — GET ONE ORDER
// ======================================================

export async function getAdminOrderById(
  token,
  orderId
) {
  if (
    !orderId
  ) {
    throw new Error(
      "Order ID is required."
    );
  }


  const data =
    await request(
      `/orders/admin/orders/${encodeURIComponent(
        orderId
      )}`,
      {
        token,
      }
    );


  return data.order;
}


// ======================================================
// ADMIN — UPDATE ORDER STATUS / TRACKING
// ======================================================

export async function updateAdminOrderStatus(
  token,
  orderId,
  {
    status,
    carrier,
    trackingNumber,
    estimatedDelivery,
  } = {}
) {
  if (
    !orderId
  ) {
    throw new Error(
      "Order ID is required."
    );
  }


  if (
    !status
  ) {
    throw new Error(
      "Order status is required."
    );
  }


  const body = {
    status,
  };


  if (
    carrier !==
    undefined
  ) {
    body.carrier =
      String(
        carrier || ""
      ).trim();
  }


  if (
    trackingNumber !==
    undefined
  ) {
    body.trackingNumber =
      String(
        trackingNumber ||
        ""
      ).trim();
  }


  if (
    estimatedDelivery !==
    undefined
  ) {
    body.estimatedDelivery =
      estimatedDelivery ||
      "";
  }


  const data =
    await request(
      `/orders/admin/orders/${encodeURIComponent(
        orderId
      )}/status`,
      {
        token,

        method:
          "PUT",

        body,
      }
    );


  return data.order;
}


// ======================================================
// ADMIN — GET RETURN / EXCHANGE REQUESTS
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
// ADMIN — APPROVE / REJECT RETURN / EXCHANGE
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
// ADMIN — COMPLETE RETURN / EXCHANGE
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
// ADMIN — RECORD MANUAL REFUND
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