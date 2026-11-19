// Key by the exact catalogue photo, including its version. New uploads and other
// colourways continue through the regular gallery loader.
const portraits = new Map([
  [
    "https://coitonic.com/cdn/shop/files/70_76158701-9e0b-42fa-8752-1c8ba720b9b3.jpg?v=1774514502&width=900",
    "black-compression",
  ],
  [
    "https://coitonic.com/cdn/shop/files/69_801024fe-72f0-492f-9565-7f2f03f7f186.jpg?v=1774514150&width=900",
    "black-compression",
  ],
  [
    "https://coitonic.com/cdn/shop/files/10_ae26786d-4828-45f0-8468-a70af79746d7.jpg?v=1784083755&width=900",
    "womens-compression",
  ],
  [
    "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/612d7bc909d24e64bb450d907a2ea61f_9366/ADIZERO_Dropset_Pro_Training_Shoes_Black_KH6710_01_00_standard.jpg",
    "dropset-black",
  ],
  [
    "https://store.wellversed.in/_next/image?url=https%3A%2F%2Fcdn.shopify.com%2Fs%2Ffiles%2F1%2F0233%2F6459%2F9885%2Ffiles%2FELI-5___CC_33servings___Women_Creatine___Listing___Wellcore_1.png%3Fv%3D1788265357&w=1200&q=75",
    "wellcore-cranberry",
  ],
  [
    "https://images.meesho.com/images/products/483788778/ihyob_512.avif?width=512",
    "nivea-pearl",
  ],
  [
    "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/093633/01/fnd/IND/fmt/png/PUMA-PHASE-Gym-Duffel-Bag",
    "phase-duffel",
  ],
]);

export function homeGearThumbnail(source) {
  const portrait = portraits.get(source);
  if (!portrait) return null;

  const base = `/media/home-gear/${portrait}`;
  const widths = portrait === "nivea-pearl" ? [240, 480] : [240, 480, 800];
  return {
    src: `${base}-480.webp`,
    srcSet: widths.map(width => `${base}-${width}.webp ${width}w`).join(", "),
  };
}
