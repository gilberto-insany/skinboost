import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

test(
  "Home reflows from narrow phones through tablet without obscuring content",
  { timeout: 120000 },
  async () => {
    const cache = await mkdtemp(join(tmpdir(), "skinboost-responsive-"));
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
      for (const width of [320, 390, 768, 1024, 1440]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        await page.goto(
          `http://127.0.0.1:${server.httpServer.address().port}/`,
        );
        await expect(page.locator(".hero-final")).toHaveAttribute(
          "data-hero-index",
          "0",
        );
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const rect = (s) => document.querySelector(s).getBoundingClientRect();
          const panel = rect(".step-visual"),
            caption = rect(".step-caption");
          const copy = rect(".bento-privacy p"),
            photos = [...document.querySelectorAll(".privacy-portrait")].map(
              (e) => e.getBoundingClientRect(),
            );
          return {
            width: innerWidth,
            scroll: document.documentElement.scrollWidth,
            captionInside:
              caption.top >= panel.top && caption.bottom <= panel.bottom,
            photosBelowText: photos.every((p) => p.top >= copy.bottom),
            heroProportional: [
              ...document.querySelectorAll(".hero-art > img"),
            ].every((e) => getComputedStyle(e).objectFit === "cover"),
            ctaProportional: [
              ...document.querySelectorAll(".cta-art img"),
            ].every((e) => {
              const r = e.getBoundingClientRect();
              return Math.abs(r.width / r.height - 2752 / 1536) < 0.01;
            }),
            fits: [
              ...document.querySelectorAll(
                ".nav > *, .bento > article, .catalog-feature, .catalog-items > button, .comparison",
              ),
            ].every((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.width === 0 || (r.left >= -1 && r.right <= innerWidth + 1)
              );
            }),
          };
        });
        assert.ok(
          layout.scroll <= width + 1,
          `${width}: horizontal page overflow`,
        );
        assert.ok(layout.fits, `${width}: content outside viewport`);
        assert.ok(
          layout.heroProportional,
          `${width}: hero stretches its images`,
        );
        assert.ok(layout.ctaProportional, `${width}: CTA stretches its images`);
        assert.ok(layout.captionInside, `${width}: step caption outside photo`);
        if (width <= 1200)
          assert.ok(
            layout.photosBelowText,
            `${width}: privacy portraits cover copy`,
          );
        if (width === 390) {
          await page
            .getByRole("button", { name: "Abrir menu", exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: "Fechar menu", exact: true }),
          ).toHaveAttribute("aria-expanded", "true");
          await page
            .locator(".nav nav")
            .getByRole("link", { name: "Como funciona", exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: "Abrir menu", exact: true }),
          ).toHaveAttribute("aria-expanded", "false");
          await expect(page.locator(".nav")).toHaveCSS("position", "fixed");
          await page.locator("#step-1").click();
          await expect(page.locator("#step-1")).toHaveAttribute(
            "aria-selected",
            "true",
          );
          await page.locator("#catalog-tab-cleanse").click();
          await expect(page.locator("#catalog-tab-cleanse")).toHaveAttribute(
            "aria-selected",
            "true",
          );
        }
        await page.close();
      }
    } finally {
      await browser?.close();
      await server.close();
      await rm(cache, { recursive: true, force: true });
    }
  },
);
