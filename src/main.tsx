import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";
import App from "./App";
import { SolanaProviders } from "./providers";

(globalThis as any).Buffer = Buffer;
(globalThis as any).global = globalThis;
(globalThis as any).process = (globalThis as any).process ?? { env: {} };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SolanaProviders>
      <App />
    </SolanaProviders>
  </StrictMode>
);
