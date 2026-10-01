const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

// GET all products
export const getProducts = async () => {
  const response = await fetch(
    `${API_URL}/products`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }

  const data = await response.json();

  return data.products;
};

// GET one product
export const getProductById = async (id) => {
  const response = await fetch(
    `${API_URL}/products/${id}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch product");
  }

  const data = await response.json();

  return data.product;
};

// CREATE product
export const createProduct = async (productData) => {
  const response = await fetch(
    `${API_URL}/products`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(productData),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create product");
  }

  return response.json();
};

// UPDATE product
export const updateProduct = async (
  id,
  productData
) => {
  const response = await fetch(
    `${API_URL}/products/${id}`,
    {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(productData),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update product");
  }

  return response.json();
};

// DELETE product
export const deleteProduct = async (id) => {
  const response = await fetch(
    `${API_URL}/products/${id}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete product");
  }

  return response.json();
};