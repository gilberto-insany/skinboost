import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

test(
  "Home defers film and 3D media, respects reduced motion, and seeks after loading",
  { timeout: 90000 },
  async () => {
    const cache = await mkdtemp(join(tmpdir(), "skinboost-performance-"));
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
      const chrome =
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      browser = await chromium.launch({
        headless: true,
        // This test covers media scheduling; WebGL lifecycle has its own suite.
        args: ["--disable-webgl"],
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
          process.env.STORYBOOK_CHROME ||
          (existsSync(chrome) ? chrome : undefined),
      });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      const requests = [];
      const errors = [];
      page.on("request", (request) =>
        requests.push(new URL(request.url()).pathname),
      );
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
      await expect(page.locator(".hero-final")).toHaveAttribute(
        "data-hero-index",
        "0",
      );
      await expect(page.locator("#bottle-fallback")).toBeHidden();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".hero-footer")).toHaveAttribute(
        "style",
        /--hero-progress/,
      );
      assert.equal(
        requests.some((url) =>
          /manifesto-scroll|skinboost-comfort\.glb|produtos-skinboost\.(png|webp)/.test(
            url,
          ),
        ),
        false,
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page
        .locator("#manifesto")
        .evaluate((el) =>
          window.scrollTo({ top: el.offsetTop + 500, behavior: "instant" }),
        );
      await expect(page.locator(".film-toggle")).toBeHidden();
      assert.equal(
        requests.some((url) => url.includes("manifesto-scroll")),
        false,
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect
        .poll(() => requests.some((url) => url.includes("manifesto-scroll")))
        .toBe(true);
      await expect
        .poll(
          () => page.locator(".film-video").evaluate((el) => el.currentTime),
          { timeout: 15000 },
        )
        .toBeGreaterThan(0);
      const forward = await page
        .locator(".film-video")
        .evaluate((el) => el.currentTime);
      await page
        .locator("#manifesto")
        .evaluate((el) =>
          window.scrollTo({ top: el.offsetTop, behavior: "instant" }),
        );
      await expect
        .poll(() =>
          page.locator(".film-video").evaluate((el) => el.currentTime),
        )
        .toBeLessThan(forward);
      await expect(page.locator(".nav")).toHaveCSS("position", "fixed");
      await page.locator("#produtos").scrollIntoViewIfNeeded();
      await expect(page.locator("#bottle-canvas")).toHaveAttribute(
        "data-status",
        "webgl-unavailable",
        { timeout: 15000 },
      );
      await expect(page.locator("#bottle-fallback")).toBeVisible();
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await expect(page.locator(".nav")).toHaveCSS("position", "absolute");
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
      await rm(cache, { recursive: true, force: true });
    }
  },
);
