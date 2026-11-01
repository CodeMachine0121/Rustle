import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import "./app/app.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Rustle needs a #root element to mount into");
}

// No StrictMode: its double mount would rebuild the editor under the cursor,
// which is exactly what breaks input method composition.
createRoot(rootElement).render(<App />);
