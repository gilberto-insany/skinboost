import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

test(
  "real landing controls and Three previews mount repeatedly without sharing state or keeping canvases",
  { timeout: 90000 },
  async () => {
    const cache = await mkdtemp(join(tmpdir(), "skinboost-catalog-test-"));
    const server = await createServer({
      configFile: false,
      root: resolve(import.meta.dirname, ".."),
      cacheDir: cache,
      logLevel: "error",
      server: { host: "127.0.0.1", port: 0 },
    });
    let browser;
    try {
      await server.listen();
      const address = server.httpServer.address();
      const chrome =
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      browser = await chromium.launch({
        headless: true,
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
          process.env.STORYBOOK_CHROME ||
          (existsSync(chrome) ? chrome : undefined),
      });
      const page = await browser.newPage({
        viewport: { width: 1000, height: 800 },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && message.text().includes("THREE."))
          errors.push(message.text());
      });
      await page.route("**/__landing-lifecycle", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body><main id="fixture"></main></body></html>',
        }),
      );
      await page.goto(`http://127.0.0.1:${address.port}/__landing-lifecycle`);
      await page.evaluate(async () => {
        await import("/src/styles.css");
        window.catalog = await import("/src/landing/catalog.js");
        window.mountCatalog = (component) =>
          window.catalog.mountLandingCatalog(
            document.querySelector("#fixture"),
            { component },
          );
        const NativeObserver = window.ResizeObserver;
        window.activeResizeObservers = 0;
        window.ResizeObserver = class extends NativeObserver {
          active = false;
          observe(...args) {
            if (!this.active) {
              this.active = true;
              window.activeResizeObservers++;
            }
            return super.observe(...args);
          }
          disconnect() {
            if (this.active) {
              this.active = false;
              window.activeResizeObservers--;
            }
            return super.disconnect();
          }
        };
        window.preview = window.mountCatalog("tabs");
      });
      await page.getByRole("tab").nth(2).click();
      assert.equal(
        await page.getByRole("tab").nth(2).getAttribute("aria-selected"),
        "true",
      );
      await page.evaluate(() => {
        window.preview.destroy();
        window.preview = window.mountCatalog("tabs");
      });
      assert.equal(
        await page.getByRole("tab").first().getAttribute("aria-selected"),
        "true",
      );
      for (let cycle = 0; cycle < 2; cycle++) {
        await page.evaluate(() => {
          window.preview.destroy();
          window.preview = window.mountCatalog("product");
        });
        await page.waitForFunction(
          () =>
            document.querySelector("#bottle-canvas")?.dataset.status ===
            "ready",
          null,
          { timeout: 30000 },
        );
        assert.equal(await page.locator("#bottle-canvas canvas").count(), 1);
        assert.equal(
          await page.locator("#bottle-canvas").getAttribute("data-phase"),
          "closed",
        );
        assert.equal(
          await page.evaluate(() => window.activeResizeObservers),
          1,
        );
        await page.evaluate(() => window.preview.destroy());
        assert.equal(await page.locator("#bottle-canvas canvas").count(), 0);
        assert.equal(
          await page.evaluate(() => window.activeResizeObservers),
          0,
        );
      }
      // Destroy during the asynchronous model load as well as after a complete render.
      await page.evaluate(() => {
        window.preview = window.mountCatalog("product");
        window.preview.destroy();
      });
      await page.waitForTimeout(100);
      assert.equal(await page.locator("canvas").count(), 0);
      assert.equal(await page.evaluate(() => window.activeResizeObservers), 0);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
      await rm(cache, { recursive: true, force: true });
    }
  },
);
