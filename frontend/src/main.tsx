import { SpeedInsights } from "@vercel/speed-insights/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { initializeAnalytics } from "./analytics";
import { PageViewTracker } from "./analytics/PageViewTracker";
import App from "./App";
import "./index.scss";
import "./i18n";

initializeAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SpeedInsights />
      <PageViewTracker />
      <App />
    </BrowserRouter>
  </StrictMode>,
);
