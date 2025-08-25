import React from "react";
import { createRoot } from "react-dom/client";
import { RecordingWindow } from "./recording";
import "../../shared/styles/globals.css";

console.log("Recording window renderer starting...");

const renderApp = () => {
  const container = document.getElementById("root");
  if (!container) {
    console.error("Root container not found in recording window!");
    return;
  }
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <RecordingWindow />
    </React.StrictMode>
  );
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", renderApp, { once: true });
} else {
  renderApp();
}
