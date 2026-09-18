import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        brandbook: resolve(import.meta.dirname, "brandbook.html"),
      },
    },
  },
  optimizeDeps: {
    include: [
      "gsap",
      "gsap/ScrollTrigger",
      "three",
      "three/addons/loaders/GLTFLoader.js",
      "three/addons/environments/RoomEnvironment.js",
    ],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.js"],
    },
  },
});
