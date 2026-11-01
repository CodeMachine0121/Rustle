import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Rustle needs a #root element to mount into");
}

createRoot(rootElement).render(<main>Rustle</main>);
