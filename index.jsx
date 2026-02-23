import React from "react";
import ReactDOM from "react-dom/client";
import LogRocket from "logrocket";
import App from "./App";

if (window.hostname !== "localhost") {
  LogRocket.init("qgmxv2/zi-mockmate");
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
