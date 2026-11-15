import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles/theme.css";
import "./styles/gate.css";
import "./styles/popup.css";
import "./styles/editor.css";
import "./styles/settings.css";
import "./styles/app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PopupApp from "./popup/App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>
);
