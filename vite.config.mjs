import { defineConfig } from "vite";
import { resolve } from "node:path";
import { handleNodeRequest } from "./server/openai-api.mjs";

function wireframeRoutes(server) {
  server.middlewares.use((request, response, next) => {
    const [pathname, query] = (request.url || "").split("?");
    if (/^\/animal\/?$/.test(pathname)) {
      request.url = "/animal/index.html" + (query ? `?${query}` : "");
    }
    if (/^\/wireframe(?:\/chat)?\/?$/.test(pathname)) {
      request.url = "/wireframe/index.html" + (query ? `?${query}` : "");
    }
    next();
  });
}

export default defineConfig({
  plugins: [
    {
      name: "skinboost-wireframe-routes",
      configureServer: wireframeRoutes,
      configurePreviewServer: wireframeRoutes,
    },
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
        animal: resolve(import.meta.dirname, "animal/index.html"),
        wireframe: resolve(import.meta.dirname, "wireframe/index.html"),
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
