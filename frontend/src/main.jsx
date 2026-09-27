import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Global 12-hour time format ──────────────────────────────────────────────
// Override Date.prototype methods so every toLocaleString / toLocaleTimeString
// call in the app defaults to 12-hour (h12) format.
const _toLocaleString = Date.prototype.toLocaleString;
const _toLocaleTimeString = Date.prototype.toLocaleTimeString;

Date.prototype.toLocaleString = function (locale, options) {
  return _toLocaleString.call(this, locale || "en-US", {
    hour12: true,
    ...options,
  });
};

Date.prototype.toLocaleTimeString = function (locale, options) {
  return _toLocaleTimeString.call(this, locale || "en-US", {
    hour12: true,
    ...options,
  });
};
// ────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
    <QueryClientProvider client={queryClient}>
        <App />
    </QueryClientProvider>
);