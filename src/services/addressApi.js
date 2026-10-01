const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";


// ======================================================
// REQUEST HELPER
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
          "Address request failed."
      );

    error.status =
      response.status;

    error.errors =
      data.errors || {};

    throw error;
  }


  return data;
}


// ======================================================
// GET ADDRESSES
// ======================================================

export async function getAddresses(
  token
) {
  const data =
    await request(
      "/addresses",
      {
        token,
      }
    );


  return Array.isArray(
    data.addresses
  )
    ? data.addresses
    : [];
}


// ======================================================
// CREATE ADDRESS
// ======================================================

export async function createAddress(
  token,
  address
) {
  const data =
    await request(
      "/addresses",
      {
        token,

        method:
          "POST",

        body:
          address,
      }
    );


  return data.address;
}


// ======================================================
// UPDATE ADDRESS
// ======================================================

export async function updateAddress(
  token,
  id,
  updates
) {
  const data =
    await request(
      `/addresses/${encodeURIComponent(
        id
      )}`,
      {
        token,

        method:
          "PUT",

        body:
          updates,
      }
    );


  return data.address;
}


// ======================================================
// DELETE ADDRESS
// ======================================================

export async function deleteAddress(
  token,
  id
) {
  return request(
    `/addresses/${encodeURIComponent(
      id
    )}`,
    {
      token,

      method:
        "DELETE",
    }
  );
}