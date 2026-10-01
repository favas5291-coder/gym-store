const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const deliverySchema = new mongoose.Schema(
  {
    available: {
      type: Boolean,
      default: true,
    },

    estimatedDays: {
      type: String,
      default: null,
    },

    freeDeliveryAbove: {
      type: Number,
      default: 500,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const productSchema = new mongoose.Schema(
  {
    // Old frontend numeric ID
    legacyId: {
      type: Number,
      index: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    subcategory: {
      type: String,
      default: "",
      trim: true,
    },

    brand: {
      type: String,
      default: "GymDrobe",
      trim: true,
    },

    gender: {
      type: String,
      default: "Unisex",
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    badge: {
      type: String,
      default: "",
      trim: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isBestSeller: {
      type: Boolean,
      default: false,
    },

    // We do NOT use "isNew" because Mongoose
    // reserves that property internally.
    isNewArrival: {
      type: Boolean,
      default: false,
    },

    material: {
      type: String,
      default: "",
    },

    highlights: {
      type: [String],
      default: [],
    },

    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    careInstructions: {
      type: [String],
      default: [],
    },

    whatsIncluded: {
      type: String,
      default: "",
    },

    sizes: {
      type: [String],
      default: [],
    },

    colors: {
      type: [String],
      default: [],
    },

    variants: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    image: {
      type: String,
      default: "",
    },

    images: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      default: "",
    },

    delivery: {
      type: deliverySchema,
      default: () => ({}),
    },

    returnPolicy: {
      type: String,
      default: "",
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    stockStatus: {
      type: String,

      enum: [
        "in-stock",
        "low-stock",
        "out-of-stock",
      ],

      default: "in-stock",
    },

    reviews: {
      type: [reviewSchema],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,

    // MongoDB stores isNewArrival,
    // but frontend receives isNew.
    toJSON: {
      transform: (doc, ret) => {
        ret.isNew = Boolean(
          ret.isNewArrival
        );

        delete ret.isNewArrival;

        return ret;
      },
    },
  }
);

const Product =
  mongoose.model(
    "Product",
    productSchema
  );

module.exports = Product;