import image1 from "../assets/tshirt.jpg";
import image2 from "../assets/shoes.jpg";
import image3 from "../assets/shaker.jpg";
import image4 from "../assets/Towel.jpg";
import image5 from "../assets/Socks .jpg";
import image6 from "../assets/bottle.jpg";

import image7 from "../assets/tshirt2.jpg";
import image8 from "../assets/tshirt3.jpg";

import image9 from "../assets/shoes2.jpg";
import image10 from "../assets/shoes3.jpg";

import image11 from "../assets/bottle2.jpg";
import image12 from "../assets/bottle3.jpg";

import image13 from "../assets/towel2.jpg";
import image14 from "../assets/towel3.jpg";

import image15 from "../assets/socks2.jpg";
import image16 from "../assets/socks3.jpg";

import image17 from "../assets/bottle2.jpg";
import image18 from "../assets/bottle3.jpg";


const products = [
  // =====================================================
  // 1. GYM TRAINING T-SHIRT
  // =====================================================
  {
    id: 1,
    name: "Gym Training T-Shirt",
    category: "Workout Clothes",
    price: 799,
    brand: "GymDrobe",
    rating: 4.8,
    discount: 10,

    sizes: ["S", "M", "L", "XL"],

    colors: ["Black", "White", "Blue"],

    variants: {
      Black: {
        S: 5,
        M: 10,
        L: 7,
        XL: 3,
      },

      White: {
        S: 8,
        M: 12,
        L: 6,
        XL: 4,
      },

      Blue: {
        S: 4,
        M: 8,
        L: 5,
        XL: 2,
      },
    },

    image: image1,

    images: [
      image1,
      image7,
      image8,
    ],

    description:
      "Comfortable training t-shirt designed for everyday gym workouts.",

    reviews: [
      {
        id: 1,
        name: "favas",
        rating: 5,
        comment:
          "Very comfortable and good quality for workouts.",
      },
      {
        id: 2,
        name: "nishad",
        rating: 4,
        comment:
          "Good t-shirt. The fitting is nice.",
      },
      {
        id: 3,
        name: "midlaj",
        rating: 5,
        comment:
          "The material is comfortable and perfect for gym training.",
      },
    ],
  },


  // =====================================================
  // 2. PERFORMANCE GYM SHOES
  // =====================================================
  {
    id: 2,
    name: "Performance Gym Shoes",
    category: "Gym Shoes",
    price: 2499,
    brand: "GymDrobe",
    rating: 4.7,
    discount: 10,

    sizes: ["7", "8", "9", "10", "11"],

    colors: ["Black", "White", "Grey"],

    variants: {
      Black: {
        7: 2,
        8: 4,
        9: 5,
        10: 3,
        11: 1,
      },

      White: {
        7: 3,
        8: 5,
        9: 4,
        10: 2,
        11: 1,
      },

      Grey: {
        7: 2,
        8: 3,
        9: 5,
        10: 4,
        11: 2,
      },
    },

    image: image2,

    images: [
      image2,
      image9,
      image10,
    ],

    description:
      "Lightweight performance gym shoes designed for training and workouts.",

    reviews: [
      {
        id: 1,
        name: "jouhar",
        rating: 5,
        comment:
          "Very comfortable shoes for gym training.",
      },
      {
        id: 2,
        name: "Adil",
        rating: 4,
        comment:
          "Good grip and comfortable for workouts.",
      },
      {
        id: 3,
        name: "Fahad",
        rating: 5,
        comment:
          "The shoes feel lightweight and provide good support.",
      },
    ],
  },


  // =====================================================
  // 3. PREMIUM SHAKER BOTTLE
  // =====================================================
  {
    id: 3,
    name: "Premium Shaker Bottle",
    category: "Shaker Bottles",
    price: 599,
    brand: "GymDrobe",
    rating: 4.6,
    discount: 10,

    sizes: [],

    colors: ["Black", "White", "Blue"],

    variants: {
      Black: {
        default: 5,
      },

      White: {
        default: 8,
      },

      Blue: {
        default: 6,
      },
    },

    image: image3,

    images: [
      image3,
      image11,
      image12,
    ],

    description:
      "Durable shaker bottle designed for protein shakes, supplements, and hydration.",

    reviews: [
      {
        id: 1,
        name: "Fahad",
        rating: 5,
        comment:
          "Strong shaker and easy to clean.",
      },
      {
        id: 2,
        name: "Ameen",
        rating: 4,
        comment:
          "Good quality shaker for the price.",
      },
      {
        id: 3,
        name: "Rahul",
        rating: 5,
        comment:
          "Very useful for protein shakes and the design looks good.",
      },
    ],
  },


  // =====================================================
  // 4. PREMIUM GYM TOWEL
  // =====================================================
  {
    id: 4,
    name: "Premium Gym Towel",
    category: "Gym Towels",
    price: 399,
    brand: "GymDrobe",
    rating: 4.5,
    discount: 10,

    sizes: [],

    colors: ["Black", "White", "Grey"],

    variants: {
      Black: {
        default: 20,
      },

      White: {
        default: 15,
      },

      Grey: {
        default: 24,
      },
    },

    image: image4,

    images: [
      image4,
      image13,
      image14,
    ],

    description:
      "Soft and absorbent gym towel for workouts, training, and everyday use.",

    reviews: [
      {
        id: 1,
        name: "Nihal",
        rating: 5,
        comment:
          "Very soft and comfortable to use during workouts.",
      },
      {
        id: 2,
        name: "Akhil",
        rating: 4,
        comment:
          "Good towel with decent absorbency.",
      },
      {
        id: 3,
        name: "Sameer",
        rating: 5,
        comment:
          "Good quality and perfect size for the gym.",
      },
    ],
  },


  // =====================================================
  // 5. TRAINING SOCKS
  // =====================================================
  {
    id: 5,
    name: "Training Socks",
    category: "Socks",
    price: 299,
    brand: "GymDrobe",
    rating: 4.4,
    discount: 10,

    sizes: ["S", "M", "L"],

    colors: ["Black", "White", "Grey"],

    variants: {
      Black: {
        S: 5,
        M: 8,
        L: 4,
      },

      White: {
        S: 7,
        M: 10,
        L: 5,
      },

      Grey: {
        S: 4,
        M: 6,
        L: 3,
      },
    },

    image: image5,

    images: [
      image5,
      image15,
      image16,
    ],

    description:
      "Comfortable training socks designed to provide support during everyday workouts.",

    reviews: [
      {
        id: 1,
        name: "Irfan",
        rating: 5,
        comment:
          "Very comfortable and fits perfectly.",
      },
      {
        id: 2,
        name: "Shamil",
        rating: 4,
        comment:
          "Good quality socks for everyday workouts.",
      },
      {
        id: 3,
        name: "Afsal",
        rating: 4,
        comment:
          "Comfortable and breathable during training.",
      },
    ],
  },


  // =====================================================
  // 6. GYM WATER BOTTLE
  // =====================================================
  {
    id: 6,
    name: "Gym Water Bottle",
    category: "Water Bottles",
    price: 499,
    brand: "GymDrobe",
    rating: 4.6,
    discount: 10,

    sizes: [],

    colors: ["Black", "White", "Blue"],

    variants: {
      Black: {
        default: 0,
      },

      White: {
        default: 0,
      },

      Blue: {
        default: 0,
      },
    },

    image: image6,

    images: [
      image6,
      image17,
      image18,
    ],

    description:
      "Durable gym water bottle designed to keep you hydrated throughout your workout.",

    reviews: [
      {
        id: 1,
        name: "favas",
        rating: 5,
        comment:
          "Good quality bottle and easy to carry to the gym.",
      },
      {
        id: 2,
        name: "Rashid",
        rating: 4,
        comment:
          "Nice design and good capacity.",
      },
      {
        id: 3,
        name: "Naveen",
        rating: 5,
        comment:
          "Strong bottle and perfect for daily workouts.",
      },
    ],
  },
];


export default products;