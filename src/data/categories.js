import { asset } from "./assets.js";
const categories = [
  ["Workout Clothes", "tshirt.jpg"],
  ["Gym Shoes", "shoes.jpg"],
  ["Shaker Bottles", "shaker.jpg"],
  ["Gym Towels", "Towel.jpg"],
  ["Socks", "Socks .jpg"],
  ["Water Bottles", "bottle.jpg"],
  ["Protein", ""],
  ["Headphones", ""],
].map(([name, file]) => ({ name, icon: asset(file), image: asset(file) }));
export default categories;