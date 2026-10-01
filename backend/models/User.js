const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [
        true,
        "Name is required",
      ],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: [
        true,
        "Email is required",
      ],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },

    password: {
      type: String,
      required: [
        true,
        "Password is required",
      ],
      minlength: 8,

      // Never return password automatically
      select: false,
    },

    role: {
      type: String,
      enum: [
        "customer",
        "admin",
      ],
      default: "customer",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);


// ======================================================
// HASH PASSWORD BEFORE SAVING
// ======================================================

userSchema.pre(
  "save",
  async function () {
    if (
      !this.isModified(
        "password"
      )
    ) {
      return;
    }

    const salt =
      await bcrypt.genSalt(12);

    this.password =
      await bcrypt.hash(
        this.password,
        salt
      );
  }
);


// ======================================================
// COMPARE LOGIN PASSWORD
// ======================================================

userSchema.methods.comparePassword =
  async function (
    enteredPassword
  ) {
    return bcrypt.compare(
      enteredPassword,
      this.password
    );
  };


const User =
  mongoose.model(
    "User",
    userSchema
  );

module.exports = User;