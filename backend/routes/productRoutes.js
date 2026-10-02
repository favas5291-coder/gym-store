const express =
  require("express");


const {
  // Public
  getProducts,
  getProductById,

  // Admin
  getAdminProducts,
  getAdminProductById,
  createProduct,
  updateProduct,
  updateProductInventory,
  deleteProduct,
  restoreProduct,
} =
  require(
    "../controllers/productController"
  );


const {
  protect,
  adminOnly,
} =
  require(
    "../middleware/authMiddleware"
  );


const router =
  express.Router();


// ======================================================
// PUBLIC PRODUCT ROUTES
// ======================================================

/*
  GET /api/products

  Customer storefront:
  only active products are returned.
*/

router.get(
  "/",
  getProducts
);


// ======================================================
// ADMIN PRODUCT ROUTES
//
// IMPORTANT:
// These routes must stay ABOVE "/:id"
// so Express does not mistake "admin"
// for a product ID.
// ======================================================

/*
  GET /api/products/admin

  Admin:
  - active products
  - archived products
  - search
  - category filtering
  - stock filtering
  - pagination
*/

router.get(
  "/admin",
  protect,
  adminOnly,
  getAdminProducts
);


/*
  GET /api/products/admin/:id

  Admin can open active OR archived product.
*/

router.get(
  "/admin/:id",
  protect,
  adminOnly,
  getAdminProductById
);


// ======================================================
// CREATE PRODUCT
// ======================================================

/*
  POST /api/products

  Admin only.
*/

router.post(
  "/",
  protect,
  adminOnly,
  createProduct
);


// ======================================================
// INVENTORY MANAGEMENT
// ======================================================

/*
  PUT /api/products/:id/inventory

  Used specifically for:
  - variant stock
  - simple stock
*/

router.put(
  "/:id/inventory",
  protect,
  adminOnly,
  updateProductInventory
);


// ======================================================
// RESTORE ARCHIVED PRODUCT
// ======================================================

/*
  PUT /api/products/:id/restore

  Changes:

  isActive = true
*/

router.put(
  "/:id/restore",
  protect,
  adminOnly,
  restoreProduct
);


// ======================================================
// PUBLIC SINGLE PRODUCT
// ======================================================

/*
  GET /api/products/:id

  Supports:
  - MongoDB ObjectId
  - legacy numeric ID
  - slug

  Archived products are hidden from customers.
*/

router.get(
  "/:id",
  getProductById
);


// ======================================================
// UPDATE PRODUCT
// ======================================================

/*
  PUT /api/products/:id

  Admin only.
*/

router.put(
  "/:id",
  protect,
  adminOnly,
  updateProduct
);


// ======================================================
// ARCHIVE PRODUCT
// ======================================================

/*
  DELETE /api/products/:id

  This does NOT permanently remove the MongoDB document.

  It changes:

  isActive = false

  This is safer because old orders may still reference
  the product.
*/

router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteProduct
);


module.exports =
  router;