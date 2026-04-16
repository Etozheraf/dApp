import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  base: "/dApp/",
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "process"],
    }),
  ],
  define: {
    global: "globalThis",
    "process.env": {},
  },
});
