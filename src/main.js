import { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error('Missing app root element with id "app".');
}

createRoot(rootElement).render(
	createElement(StrictMode, null, createElement(App)),
);
