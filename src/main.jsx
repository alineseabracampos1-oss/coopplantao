import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CoopPlantao from "./CoopPlantao.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CoopPlantao />
  </StrictMode>
);
