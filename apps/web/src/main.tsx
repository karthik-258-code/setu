import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { LangProvider } from "./i18n/lang-context";
import { createAppRouter } from "./router";
import "./index.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <LangProvider>
      <RouterProvider router={createAppRouter()} />
    </LangProvider>
  </StrictMode>,
);
