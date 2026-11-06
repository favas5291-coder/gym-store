import { useLocation } from "react-router-dom";
import ProductSection from "../components/ProductSection.jsx";
import { STOREFRONT_COLLECTIONS } from "../utils/storefrontCollections.js";

export default function Shop() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "");
  const collection = Object.hasOwn(STOREFRONT_COLLECTIONS, path) ? STOREFRONT_COLLECTIONS[path] : undefined;
  return <ProductSection storefrontCollection={collection} />;
}
