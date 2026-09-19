import { defineConfig } from "vite";
import { resolve } from "node:path";
import { handleNodeRequest } from "./server/openai-api.mjs";

export default defineConfig({
  plugins: [
    {
      name: "skinboost-local-api",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const route = request.url
            ?.split("?")[0]
            .match(/^\/api\/(status|chat|simulate|voice-session)$/)?.[1];
          if (route) return handleNodeRequest(route, request, response);
          next();
        });
      },
    },
  ],
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
