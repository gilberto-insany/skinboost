import assert from "node:assert/strict";
import { test } from "node:test";
import { preview } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import worker from "../worker/index.js";

test("Sites keeps archived Home and chat reloads in the wireframe entry", async () => {
  for (const path of [
    "/wireframe",
    "/wireframe/",
    "/wireframe/chat",
    "/wireframe/chat/",
  ]) {
    const calls = [];
    const response = await worker.fetch(
      new Request(`https://example.test${path}`, {
        headers: { accept: "text/html" },
      }),
      {
        ASSETS: {
          fetch: async (request) => {
            const pathname = new URL(request.url).pathname;
            calls.push(pathname);
            return new Response("archive", {
              status: pathname === "/wireframe/index.html" ? 200 : 404,
            });
          },
        },
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [path, "/wireframe/index.html"]);
  }
});

test(
  "built wireframe is isolated from the new Home and preserves its chat navigation",
  { timeout: 90000 },
  async () => {
    const server = await preview({
      preview: { host: "127.0.0.1", port: 0, open: false },
    });
    const chrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const browser = await chromium.launch({
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync(chrome) ? chrome : undefined),
    });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    try {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/api/**", (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"enabled":false}',
          }),
        );
        await page.goto(`${base}/`);
        await expect(page.locator(".hero-final")).toHaveCount(1);
        await page.goto(`${base}/wireframe`);
        await expect(page.locator(".hero-final")).toHaveCount(0);
        await expect(page.locator("#skin-prompt")).toBeVisible();
        await page.locator("#skin-prompt").fill("Quero cuidar da oleosidade");
        await page.locator('#prompt-form button[type="submit"]').click();
        await expect(page).toHaveURL(`${base}/wireframe/chat`);
        await expect(page.locator(".composer-shell")).toBeVisible();
        await page.reload();
        await expect(page.locator(".composer-shell")).toBeVisible();
        await page.locator('[data-action="close"]').click();
        await expect(page).toHaveURL(`${base}/wireframe`);
        await expect(page.locator("#skin-prompt")).toBeVisible();
        await page.goto(`${base}/wireframe/chat/`);
        await expect(page.locator(".composer-shell")).toBeVisible();
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
      await new Promise((resolve) => server.httpServer.close(resolve));
    }
  },
);
