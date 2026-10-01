const express =
  require("express");

const {
  register,
  login,
  getMe,
} = require(
  "../controllers/authController"
);

const {
  protect,
} = require(
  "../middleware/authMiddleware"
);

const router =
  express.Router();


// REGISTER

router.post(
  "/register",
  register
);


// LOGIN

router.post(
  "/login",
  login
);


// CURRENT LOGGED-IN USER

router.get(
  "/me",
  protect,
  getMe
);


module.exports =
  router;