import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("找不到挂载点 #root");
}

createRoot(container).render(<App />);
