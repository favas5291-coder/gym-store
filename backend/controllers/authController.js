const jwt = require("jsonwebtoken");

const User = require("../models/User");


// ======================================================
// CREATE JWT
// ======================================================

function generateToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is missing from backend/.env"
    );
  }

  return jwt.sign(
    {
      userId,
    },

    process.env.JWT_SECRET,

    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        "7d",
    }
  );
}


// ======================================================
// SAFE USER RESPONSE
// ======================================================

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt:
      user.createdAt,
  };
}


// ======================================================
// REGISTER
// POST /api/auth/register
// ======================================================

const register = async (
  req,
  res
) => {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (
      !name ||
      !email ||
      !password
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Name, email and password are required.",
        });
    }

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

    const cleanName =
      String(name).trim();


    // Check existing user

    const existingUser =
      await User.findOne({
        email:
          cleanEmail,
      });

    if (existingUser) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "An account with this email already exists.",
        });
    }


    // Create user

    const user =
      await User.create({
        name:
          cleanName,

        email:
          cleanEmail,

        password,
      });


    // Create JWT

    const token =
      generateToken(
        user._id
      );


    return res
      .status(201)
      .json({
        success: true,

        message:
          "Account created successfully.",

        token,

        user:
          safeUser(user),
      });

  } catch (error) {
    console.error(
      "Register error:",
      error
    );


    // MongoDB duplicate email
    if (
      error.code === 11000
    ) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "An account with this email already exists.",
        });
    }


    // Mongoose validation
    if (
      error.name ===
      "ValidationError"
    ) {
      const message =
        Object.values(
          error.errors
        )[0]?.message ||
        "Invalid user information.";

      return res
        .status(400)
        .json({
          success: false,
          message,
        });
    }


    return res
      .status(500)
      .json({
        success: false,

        message:
          "Unable to create account.",
      });
  }
};


// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================

const login = async (
  req,
  res
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (
      !email ||
      !password
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Email and password are required.",
        });
    }

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();


    // Password is select:false,
    // so explicitly request it.

    const user =
      await User.findOne({
        email:
          cleanEmail,
      }).select(
        "+password"
      );


    if (!user) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Invalid email or password.",
        });
    }


    if (
      user.isActive ===
      false
    ) {
      return res
        .status(403)
        .json({
          success: false,

          message:
            "This account is currently disabled.",
        });
    }


    const passwordMatches =
      await user.comparePassword(
        password
      );


    if (
      !passwordMatches
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Invalid email or password.",
        });
    }


    const token =
      generateToken(
        user._id
      );


    return res.json({
      success: true,

      message:
        "Login successful.",

      token,

      user:
        safeUser(user),
    });

  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Unable to login.",
      });
  }
};


// ======================================================
// CURRENT USER
// GET /api/auth/me
// ======================================================

const getMe = async (
  req,
  res
) => {
  return res.json({
    success: true,

    user:
      safeUser(
        req.user
      ),
  });
};


module.exports = {
  register,
  login,
  getMe,
};