import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

test(
  "final Home keeps hero drafts, supports reduced motion and switches actual product/comparison media",
  { timeout: 60000 },
  async () => {
    const cache = await mkdtemp(join(tmpdir(), "skinboost-home-"));
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
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
          process.env.STORYBOOK_CHROME ||
          (existsSync(chrome) ? chrome : undefined),
      });
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
      const hero = page.locator(".hero-final");
      await expect(hero).toHaveAttribute("data-hero-index", "0");
      await expect(page.locator("[data-hero-pause]")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page
        .locator("#skin-prompt")
        .fill("Quero simplificar minha rotina.");
      await page
        .getByRole("button", { name: "Próxima imagem", exact: true })
        .click();
      await expect(hero).toHaveAttribute("data-hero-index", "1");
      await expect(page.locator(".hero-metrics")).toBeVisible();
      await expect(page.locator(".hero-science")).toBeHidden();
      await expect(page.locator("#skin-prompt")).toHaveValue(
        "Quero simplificar minha rotina.",
      );
      await page
        .getByRole("button", { name: "Imagem anterior", exact: true })
        .click();
      await expect(hero).toHaveAttribute("data-hero-index", "0");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.getByRole("heading", { level: 1 }).click();
      await expect(hero).toHaveAttribute("data-hero-index", "1", {
        timeout: 14000,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator("[data-hero-pause]")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.locator("#step-2").click();
      await expect(page.locator("[data-step-image]")).toHaveAttribute(
        "src",
        /steps3-2\.webp$/,
      );
      await page.locator("#catalog-tab-comfort").press("ArrowRight");
      await expect(page.locator("#catalog-tab-cleanse")).toBeFocused();
      await expect(page.locator("#catalog-panel-cleanse")).toBeVisible();
      await expect(page.locator("#catalog-panel-comfort")).toBeHidden();
      await page.locator("#catalog-tab-cleanse").press("End");
      await expect(page.locator("#catalog-panel-balance")).toBeVisible();
      await page
        .getByRole("button", { name: "Conhecer Balance", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.locator("[data-compare-person]").nth(2).click();
      await expect(page.locator(".before-image img")).toHaveAttribute(
        "src",
        /compare-3-before\.webp$/,
      );
      await expect(page.locator(".after-image img")).toHaveAttribute(
        "src",
        /compare-3-after\.webp$/,
      );
      await page.locator("#compare-range").press("ArrowRight");
      await expect(page.locator("#compare-range")).toHaveValue("51");
      // Both external SVGs preserve their own isolated animation and reduced-motion rules.
      await expect(page.locator('img[src$="orb-glass.svg"]')).toHaveCount(2);
      await expect(page.locator('img[src*="clarity-"]')).toHaveCount(4);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await server.close();
      await rm(cache, { recursive: true, force: true });
    }
  },
);
