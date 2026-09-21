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

const products = [
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
      "Premium lightweight gym training T-shirt designed for comfortable workouts, running and everyday fitness activities.",

    reviews: [
      {
        id: 1,
        name: "Favas",
        rating: 5,
        comment:
          "Very comfortable and good quality.",
      },
      {
        id: 2,
        name: "Nishad",
        rating: 5,
        comment:
          "Perfect for gym workouts.",
      },
      {
        id: 3,
        name: "Midlaj",
        rating: 4,
        comment:
          "Good material and fitting.",
      },
    ],
  },

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
        7: 3,
        8: 5,
        9: 8,
        10: 5,
        11: 2,
      },

      White: {
        7: 2,
        8: 4,
        9: 6,
        10: 4,
        11: 2,
      },

      Grey: {
        7: 3,
        8: 5,
        9: 7,
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
      "Performance-focused gym shoes with a lightweight design, comfortable cushioning and strong grip.",

    reviews: [
      {
        id: 1,
        name: "Arjun",
        rating: 5,
        comment:
          "Great shoes for training.",
      },
      {
        id: 2,
        name: "Rahul",
        rating: 4,
        comment:
          "Comfortable and stylish.",
      },
    ],
  },

  {
    id: 3,
    name: "Premium Shaker Bottle",
    category: "Shaker Bottles",
    price: 599,
    brand: "GymDrobe",
    rating: 4.6,
    discount: 10,

    sizes: [],

    colors: [
      "Black",
      "White",
      "Blue",
    ],

    variants: {
      Black: {
        default: 15,
      },

      White: {
        default: 12,
      },

      Blue: {
        default: 10,
      },
    },

    image: image3,

    images: [
      image3,
      image11,
      image12,
    ],

    description:
      "Premium leak-resistant shaker bottle designed for protein shakes, supplements and everyday hydration.",

    reviews: [
      {
        id: 1,
        name: "Favas",
        rating: 5,
        comment:
          "Good quality shaker.",
      },
      {
        id: 2,
        name: "Adil",
        rating: 4,
        comment:
          "Looks premium.",
      },
    ],
  },

  {
    id: 4,
    name: "Premium Gym Towel",
    category: "Gym Towels",
    price: 399,
    brand: "GymDrobe",
    rating: 4.5,
    discount: 10,

    sizes: [],

    colors: [
      "Black",
      "White",
      "Grey",
    ],

    variants: {
      Black: {
        default: 15,
      },

      White: {
        default: 10,
      },

      Grey: {
        default: 12,
      },
    },

    image: image4,

    images: [
      image4,
      image13,
      image14,
    ],

    description:
      "Soft, absorbent and lightweight gym towel designed for training sessions and everyday workouts.",

    reviews: [
      {
        id: 1,
        name: "Nihal",
        rating: 5,
        comment:
          "Very soft towel.",
      },
      {
        id: 2,
        name: "Shamil",
        rating: 4,
        comment:
          "Good for gym use.",
      },
    ],
  },

  {
    id: 5,
    name: "Training Socks",
    category: "Socks",
    price: 299,
    brand: "GymDrobe",
    rating: 4.4,
    discount: 10,

    sizes: [
      "S",
      "M",
      "L",
    ],

    colors: [
      "Black",
      "White",
      "Grey",
    ],

    variants: {
      Black: {
        S: 10,
        M: 15,
        L: 10,
      },

      White: {
        S: 8,
        M: 12,
        L: 9,
      },

      Grey: {
        S: 6,
        M: 10,
        L: 7,
      },
    },

    image: image5,

    images: [
      image5,
      image15,
      image16,
    ],

    description:
      "Comfortable training socks designed with breathable fabric and a secure fit for workouts.",

    reviews: [
      {
        id: 1,
        name: "Favas",
        rating: 4,
        comment:
          "Comfortable socks.",
      },
      {
        id: 2,
        name: "Ameen",
        rating: 5,
        comment:
          "Good quality.",
      },
    ],
  },

  {
    id: 6,
    name: "Gym Water Bottle",
    category: "Water Bottles",
    price: 499,
    brand: "GymDrobe",
    rating: 4.3,
    discount: 10,

    sizes: [],

    colors: [
      "Black",
      "White",
      "Blue",
    ],

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
      image11,
      image12,
    ],

    description:
      "Durable gym water bottle designed for hydration during workouts, running and outdoor activities.",

    reviews: [],
  },
];

export default products;