import React from "react";
import { createRoot } from "react-dom/client";
import "../../shared/styles/index.css";

import { InformationWindow } from "./app";

console.log("Information window renderer starting...");

// Initialize the React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <InformationWindow />
    </React.StrictMode>
  );
} else {
  console.error("Root container not found");
}
