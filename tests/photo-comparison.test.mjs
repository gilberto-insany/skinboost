import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "@playwright/test";

test(
  "photo comparison shares image geometry, supports mouse/touch/keyboard and releases listeners",
  { timeout: 60000 },
  async () => {
    const cache = await mkdtemp(join(tmpdir(), "skinboost-comparison-test-"));
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
      for (const mobile of [false, true]) {
        const context = await browser.newContext({
          viewport: { width: mobile ? 390 : 1000, height: 1000 },
          isMobile: mobile,
          hasTouch: mobile,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/__comparison-fixture", (route) =>
          route.fulfill({
            contentType: "text/html",
            body: '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="fixture" style="max-width:600px;margin:auto;padding:12px;--sx-muted:#4e6146"></main><div style="height:900px"></div></body></html>',
          }),
        );
        await page.goto(
          `http://127.0.0.1:${server.httpServer.address().port}/__comparison-fixture`,
        );
        await page.evaluate(async () => {
          await import("/src/styles.css");
          await import("/src/experience.css");
          const { renderPhotoComparison } =
            await import("/src/chat/photo-experience.js");
          const { mountPhotoComparisonController } =
            await import("/src/chat/photo-comparison.js");
          const image = (width, height, color) => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const draw = canvas.getContext("2d");
            draw.fillStyle = color;
            draw.fillRect(0, 0, width, height);
            return canvas.toDataURL("image/png");
          };
          const fixture = document.querySelector("#fixture");
          fixture.innerHTML = renderPhotoComparison({
            id: "comparison-fixture",
            selectedProductId: "comfort",
            original: image(200, 300, "#b5c5ad"),
            image: image(300, 200, "#d2bfa9"),
          });
          window.initialComparison = fixture.innerHTML;
          window.comparison = mountPhotoComparisonController(fixture);
        });
        const stage = page.locator("[data-photo-drag]");
        const handle = page.locator("[data-photo-handle]");
        const range = page.locator("[data-photo-compare]");
        assert.match(
          await page.locator(".sx-comparison-heading").innerText(),
          /Não prevê o efeito do produto/,
        );
        await page.waitForFunction(() =>
          document
            .querySelector(".sx-simulation")
            .style.getPropertyValue("--photo-ratio"),
        );
        const geometry = await stage.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return {
            ratio: rect.width / rect.height,
            layers: [...node.querySelectorAll("img")].map((image) => {
              const bounds = image.getBoundingClientRect();
              return [
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height,
                getComputedStyle(image).objectFit,
              ];
            }),
            touchAction: getComputedStyle(node).touchAction,
            labelsOutside: !node.querySelector(".sx-compare-labels"),
          };
        });
        assert.ok(Math.abs(geometry.ratio - 2 / 3) < 0.001);
        assert.deepEqual(geometry.layers[0], geometry.layers[1]);
        assert.equal(geometry.layers[0][4], "cover");
        assert.equal(geometry.touchAction, "pan-y");
        assert.equal(geometry.labelsOutside, true);
        await stage.scrollIntoViewIfNeeded();
        const bounds = await stage.boundingBox();
        const y = bounds.y + bounds.height / 2;
        if (mobile) {
          const touch = await context.newCDPSession(page);
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: bounds.x + bounds.width * 0.2, y }],
          });
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: bounds.x + bounds.width * 0.8, y }],
          });
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          assert.equal(await range.inputValue(), "80");
          assert.equal(await handle.getAttribute("aria-valuenow"), "80");
          await page.evaluate(() => window.scrollTo(0, 0));
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: 4, y: 750 }],
          });
          for (const position of [650, 550, 450])
            await touch.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x: 4, y: position }],
            });
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await page.waitForFunction(() => window.scrollY > 0);
        } else {
          await page.mouse.move(bounds.x + bounds.width * 0.2, y);
          await page.mouse.down();
          await page.mouse.move(bounds.x + bounds.width + 50, y, { steps: 5 });
          assert.equal(await range.inputValue(), "100");
          await page.mouse.up();
        }
        assert.equal(
          await stage.evaluate((node) =>
            node.classList.contains("is-dragging"),
          ),
          false,
        );
        await handle.focus();
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("PageUp");
        assert.equal(await range.inputValue(), "11");
        assert.equal(
          await handle.getAttribute("aria-valuetext"),
          "11% da foto original",
        );
        await range.focus();
        await page.keyboard.press("ArrowRight");
        assert.equal(await handle.getAttribute("aria-valuenow"), "12");
        await page.evaluate(() => {
          document.querySelector("#fixture").innerHTML =
            window.initialComparison;
          window.comparison.refresh();
        });
        assert.equal(
          await range.inputValue(),
          "12",
          "re-render retains the reveal for this message",
        );
        await page.evaluate(() => window.comparison.destroy());
        await handle.focus();
        await page.keyboard.press("End");
        assert.equal(
          await range.inputValue(),
          "12",
          "destroy removes delegated keyboard listeners",
        );
        assert.deepEqual(errors, []);
        await context.close();
      }
    } finally {
      await browser?.close();
      await server.close();
      await rm(cache, { recursive: true, force: true });
    }
  },
);
