import { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthProvider from "./context/AuthContext.jsx";
import App from "./App.jsx";
import "./style.css";
import "./features.css";
import { readStorage } from "./utils/storage.js";
import { importGuestShopping } from "./utils/shopperStorage.js";
importGuestShopping(readStorage("gymdrobe-user", null));
const root = document.getElementById("app");
if (!root) throw new Error('Missing root element with id "app".');
createRoot(root).render(
  createElement(
    StrictMode,
    null,
    createElement(AuthProvider, null, createElement(App)),
  ),
);