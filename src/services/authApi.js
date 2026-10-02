const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";


// ======================================================
// REQUEST HELPER
// ======================================================

async function request(
  path,
  {
    method = "GET",
    token,
    body,
  } = {}
) {
  const headers = {
    "Content-Type":
      "application/json",
  };


  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }


  const response =
    await fetch(
      `${API_URL}${path}`,
      {
        method,
        headers,

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
          "Authentication request failed."
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
// REGISTER
// POST /api/auth/register
// ======================================================

export async function registerUser(
  userData
) {
  if (
    !userData ||
    typeof userData !==
      "object"
  ) {
    throw new Error(
      "Registration information is required."
    );
  }


  return request(
    "/auth/register",
    {
      method:
        "POST",

      body:
        userData,
    }
  );
}


// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================

export async function loginUser(
  credentials
) {
  if (
    !credentials ||
    typeof credentials !==
      "object"
  ) {
    throw new Error(
      "Login information is required."
    );
  }


  return request(
    "/auth/login",
    {
      method:
        "POST",

      body:
        credentials,
    }
  );
}


// ======================================================
// GET CURRENT USER
// GET /api/auth/me
// ======================================================

export async function getCurrentUser(
  token
) {
  if (
    !token
  ) {
    throw new Error(
      "Authentication token is required."
    );
  }


  return request(
    "/auth/me",
    {
      token,
    }
  );
}


// ======================================================
// UPDATE PROFILE
// PUT /api/auth/profile
// ======================================================

export async function updateUserProfile(
  token,
  profileData
) {
  if (
    !token
  ) {
    throw new Error(
      "Authentication token is required."
    );
  }


  if (
    !profileData ||
    typeof profileData !==
      "object"
  ) {
    throw new Error(
      "Profile information is required."
    );
  }


  const payload =
    {};


  if (
    Object.prototype.hasOwnProperty.call(
      profileData,
      "name"
    )
  ) {
    payload.name =
      String(
        profileData.name ??
          ""
      ).trim();
  }


  if (
    Object.prototype.hasOwnProperty.call(
      profileData,
      "phone"
    )
  ) {
    payload.phone =
      String(
        profileData.phone ??
          ""
      ).replace(
        /\D/g,
        ""
      );
  }


  if (
    Object.keys(
      payload
    ).length ===
    0
  ) {
    throw new Error(
      "No profile changes were provided."
    );
  }


  const data =
    await request(
      "/auth/profile",
      {
        method:
          "PUT",

        token,

        body:
          payload,
      }
    );


  return {
    success:
      Boolean(
        data.success
      ),

    message:
      data.message ||
      "Profile updated successfully.",

    user:
      data.user ||
      null,
  };
}


// ======================================================
// CHANGE PASSWORD
// PUT /api/auth/password
// ======================================================

export async function changeUserPassword(
  token,
  {
    currentPassword,
    newPassword,
  }
) {
  if (
    !token
  ) {
    throw new Error(
      "Authentication token is required."
    );
  }


  const current =
    String(
      currentPassword ||
        ""
    );


  const next =
    String(
      newPassword ||
        ""
    );


  if (
    !current
  ) {
    throw new Error(
      "Current password is required."
    );
  }


  if (
    !next
  ) {
    throw new Error(
      "New password is required."
    );
  }


  if (
    next.length <
    8
  ) {
    throw new Error(
      "New password must contain at least 8 characters."
    );
  }


  if (
    next.length >
    128
  ) {
    throw new Error(
      "New password cannot exceed 128 characters."
    );
  }


  if (
    current ===
    next
  ) {
    throw new Error(
      "Choose a new password that is different from your current password."
    );
  }


  const data =
    await request(
      "/auth/password",
      {
        method:
          "PUT",

        token,

        body: {
          currentPassword:
            current,

          newPassword:
            next,
        },
      }
    );


  return {
    success:
      Boolean(
        data.success
      ),

    message:
      data.message ||
      "Password changed successfully.",
  };
}