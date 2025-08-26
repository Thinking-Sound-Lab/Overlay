import { createRoot } from "react-dom/client";
import React from "react";
import "../../shared/styles/index.css";

// Import the main app component
let App: React.ComponentType = () => {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Loading Authentication...
        </h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    </div>
  );
};

// Try to load the main app, fall back to simple UI if it fails
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { App: MainApp } = require("./components/app");
  App = MainApp;
  console.log("Main app component loaded successfully");
} catch (error) {
  console.error("Failed to load main app component:", error);
  App = () => (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center max-w-md p-6">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-red-600 mb-2">App Loading Error</h2>
        <p className="text-gray-600 mb-4">
          Failed to load the main application component: {(error as Error).message}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

console.log("Renderer: Starting...");

// Analytics will be initialized after authentication is complete
console.log("Renderer: Deferring app launch tracking until user authentication completes...");

// Create root element
const container = document.getElementById("root");
console.log("Renderer: Container found:", !!container);

if (container) {
  try {
    console.log("Renderer: Creating React root...");
    const root = createRoot(container);
    
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("Renderer: React app rendered successfully");
  } catch (error) {
    console.error("Renderer: Failed to render React app:", error);
    // Fallback to simple HTML
    container.innerHTML = `
      <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6;">
        <div style="text-align: center; max-width: 400px; padding: 24px;">
          <div style="font-size: 48px; margin-bottom: 16px;">💥</div>
          <h2 style="font-size: 24px; font-weight: 600; color: #dc2626; margin-bottom: 8px;">Render Error</h2>
          <p style="color: #6b7280; margin-bottom: 16px;">${(error as Error).message}</p>
          <button onclick="window.location.reload()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Reload
          </button>
        </div>
      </div>
    `;
  }
} else {
  console.error("Renderer: Root container not found!");
  // Add fallback content directly to body
  document.body.innerHTML = `
    <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #f3f4f6;">
      <div style="text-align: center;">
        <h1 style="font-size: 24px; color: #dc2626; margin-bottom: 16px;">Container Not Found</h1>
        <p style="color: #6b7280;">The root container element is missing from the HTML.</p>
      </div>
    </div>
  `;
}
