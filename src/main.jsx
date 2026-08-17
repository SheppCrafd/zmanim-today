import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App.jsx";
import "@/index.css";

// Base44's auto-generated app subdomain (pre-dates the custom
// zmanimtoday.base44.app domain) still resolves and gets shared/bookmarked
// occasionally — bounce it to the canonical domain, preserving the rest of
// the URL, before React ever mounts.
const OLD_HOST = "zmanim-today-1f2656a3.base44.app";
const CANONICAL_HOST = "zmanimtoday.base44.app";
if (window.location.hostname === OLD_HOST) {
  window.location.replace(
    `https://${CANONICAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode>
  <App />,
  // </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    window.parent?.postMessage({ type: "sandbox:beforeUpdate" }, "*");
  });
  import.meta.hot.on("vite:afterUpdate", () => {
    window.parent?.postMessage({ type: "sandbox:afterUpdate" }, "*");
  });
}
