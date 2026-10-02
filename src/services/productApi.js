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
          "Product request failed."
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
// ADMIN TOKEN CHECK
// ======================================================

function requireToken(
  token
) {
  if (
    !token
  ) {
    throw new Error(
      "Admin login is required."
    );
  }
}


// ======================================================
// PUBLIC — GET ALL PRODUCTS
// ======================================================

export async function getProducts() {
  const data =
    await request(
      "/products"
    );


  return Array.isArray(
    data.products
  )
    ? data.products
    : [];
}


// ======================================================
// PUBLIC — GET ONE PRODUCT
//
// Supports:
// MongoDB ObjectId
// legacy numeric ID
// slug
// ======================================================

export async function getProductById(
  id
) {
  if (
    id == null ||
    String(id).trim() ===
      ""
  ) {
    throw new Error(
      "Product ID is required."
    );
  }


  const data =
    await request(
      `/products/${encodeURIComponent(
        id
      )}`
    );


  return (
    data.product ||
    null
  );
}


// ======================================================
// ADMIN — GET PRODUCTS
// ======================================================

export async function getAdminProducts(
  token,
  {
    search = "",
    category = "",
    stockStatus = "",
    active = "",
    page = 1,
    limit = 25,
  } = {}
) {
  requireToken(
    token
  );


  const params =
    new URLSearchParams();


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


  if (
    String(
      category
    ).trim()
  ) {
    params.set(
      "category",
      String(
        category
      ).trim()
    );
  }


  if (
    String(
      stockStatus
    ).trim()
  ) {
    params.set(
      "stockStatus",
      String(
        stockStatus
      ).trim()
    );
  }


  if (
    active === true ||
    active === false
  ) {
    params.set(
      "active",
      String(
        active
      )
    );

  } else if (
    active ===
      "true" ||
    active ===
      "false"
  ) {
    params.set(
      "active",
      active
    );
  }


  const safePage =
    Math.max(
      1,

      Number.parseInt(
        page,
        10
      ) ||
        1
    );


  const safeLimit =
    Math.min(
      100,

      Math.max(
        1,

        Number.parseInt(
          limit,
          10
        ) ||
          25
      )
    );


  params.set(
    "page",
    String(
      safePage
    )
  );


  params.set(
    "limit",
    String(
      safeLimit
    )
  );


  const query =
    params.toString();


  const data =
    await request(
      `/products/admin${
        query
          ? `?${query}`
          : ""
      }`,
      {
        token,
      }
    );


  return {
    products:
      Array.isArray(
        data.products
      )
        ? data.products
        : [],

    count:
      Number(
        data.count ??
          0
      ),

    total:
      Number(
        data.total ??
          0
      ),

    page:
      Number(
        data.page ??
          safePage
      ),

    pages:
      Math.max(
        1,
        Number(
          data.pages ??
            1
        )
      ),

    limit:
      Number(
        data.limit ??
          safeLimit
      ),
  };
}


// ======================================================
// ADMIN — GET ONE PRODUCT
// ======================================================

export async function getAdminProductById(
  token,
  id
) {
  requireToken(
    token
  );


  if (
    id == null ||
    String(id).trim() ===
      ""
  ) {
    throw new Error(
      "Product ID is required."
    );
  }


  const data =
    await request(
      `/products/admin/${encodeURIComponent(
        id
      )}`,
      {
        token,
      }
    );


  return (
    data.product ||
    null
  );
}


// ======================================================
// ADMIN — CREATE PRODUCT
// ======================================================

export async function createProduct(
  token,
  productData
) {
  requireToken(
    token
  );


  if (
    !productData ||
    typeof productData !==
      "object"
  ) {
    throw new Error(
      "Product data is required."
    );
  }


  const data =
    await request(
      "/products",
      {
        token,

        method:
          "POST",

        body:
          productData,
      }
    );


  return {
    success:
      Boolean(
        data.success
      ),

    message:
      data.message ||
      "Product created successfully.",

    product:
      data.product ||
      null,
  };
}


// ======================================================
// ADMIN — UPDATE PRODUCT
// ======================================================

export async function updateProduct(
  token,
  id,
  productData
) {
  requireToken(
    token
  );


  if (
    id == null ||
    String(id).trim() ===
      ""
  ) {
    throw new Error(
      "Product ID is required."
    );
  }


  if (
    !productData ||
    typeof productData !==
      "object"
  ) {
    throw new Error(
      "Product changes are required."
    );
  }


  const data =
    await request(
      `/products/${encodeURIComponent(
        id
      )}`,
      {
        token,

        method:
          "PUT",

        body:
          productData,
      }
    );


  return {
    success:
      Boolean(
        data.success
      ),

    message:
      data.message ||
      "Product updated successfully.",

    product:
      data.product ||
      null,
  };
}


// ======================================================
// ADMIN — UPDATE INVENTORY
//
// Variant product:
//
// {
//   variants: {
//     Black: {
//       S: 5,
//       M: 10
//     }
//   }
// }
//
// Simple product:
//
// {
//   stock: 20
// }
// ======================================================

export async function updateProductInventory(
  token,
  id,
  inventoryData
) {
  requireToken(
    token
  );


  if (
    id == null ||
    String(id).trim() ===
      ""
  ) {
    throw new Error(
      "Product ID is required."
    );
  }


  if (
    !inventoryData ||
    typeof inventoryData !==
      "object"
  ) {
    throw new Error(
      "Inventory data is required."
    );
  }


  const data =
    await request(
      `/products/${encodeURIComponent(
        id
      )}/inventory`,
      {
        token,

        method:
          "PUT",

        body:
          inventoryData,
      }
    );


  return {
    success:
      Boolean(
        data.success
      ),

    message:
      data.message ||
      "Inventory updated successfully.",

    product:
      data.product ||
      null,
  };
}


// ======================================================
// ADMIN — ARCHIVE PRODUCT
//
// DELETE no longer permanently removes the product.
//
// Backend changes:
//
// isActive = false
// ======================================================

export async function archiveProduct(
  token,
  id
) {
  requireToken(
    token
  );


  if (
    id == null ||
    String(id).trim() ===
      ""
  ) {
    throw new Error(
      "Product ID is required."
    );
  }


  const data =
    await request(
      `/products/${encodeURIComponent(
        id
      )}`,
      {
        token,

        method:
          "DELETE",
      }
    );


  return {
    success:
      Boolean(
        data.success
      ),

    message:
      data.message ||
      "Product archived successfully.",

    product:
      data.product ||
      null,
  };
}


// ======================================================
// ADMIN — RESTORE PRODUCT
// ======================================================

export async function restoreProduct(
  token,
  id
) {
  requireToken(
    token
  );


  if (
    id == null ||
    String(id).trim() ===
      ""
  ) {
    throw new Error(
      "Product ID is required."
    );
  }


  const data =
    await request(
      `/products/${encodeURIComponent(
        id
      )}/restore`,
      {
        token,

        method:
          "PUT",
      }
    );


  return {
    success:
      Boolean(
        data.success
      ),

    message:
      data.message ||
      "Product restored successfully.",

    product:
      data.product ||
      null,
  };
}


// ======================================================
// BACKWARD-COMPATIBLE NAME
//
// Older GymDrobe code may still import:
//
// deleteProduct
//
// It now performs SAFE ARCHIVING instead.
// ======================================================

export async function deleteProduct(
  token,
  id
) {
  return archiveProduct(
    token,
    id
  );
}