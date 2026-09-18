import { resolve } from "node:path";

/** Shared story inventory; each catalog still has its own build and preview. */
export function makeConfig(configDirectory) {
  return {
    stories: ["../src/stories/**/*.stories.js"],
    addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
    framework: {
      name: "@storybook/html-vite",
      options: {
        builder: { viteConfigPath: resolve(configDirectory, "vite.config.js") },
      },
    },
    staticDirs: ["../public"],
    core: { disableTelemetry: true },
    async viteFinal(config) {
      // Relative bundles work both as an independent build and below /storybook/.
      return { ...config, base: "./", publicDir: false };
    },
  };
}
