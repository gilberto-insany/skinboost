import assert from "node:assert/strict";
import { test } from "node:test";
import { preview } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import sharp from "sharp";

test(
  "Animal mobile and desktop: opt-in, real request contract, retry, photo permission and ephemeral state",
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
        const errors = [],
          calls = [];
        page.on("pageerror", (e) => errors.push(e.message));
        let fail = true;
        await page.route("**/api/chat", async (route) => {
          calls.push(route.request().postDataJSON());
          if (fail) {
            fail = false;
            return route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                error: { message: "Conexão indisponível. Tente novamente." },
              }),
            });
          }
          return route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: `data: ${JSON.stringify({ type: "delta", text: "Sete séruns" })}\n\ndata: ${JSON.stringify({ type: "complete", result: { text: "Sete séruns e nenhuma rotina. Seu banheiro virou uma startup: muito investimento, zero execução.", choices: [], ready: false, care: false } })}\n\n`,
          });
        });
        await page.goto(`${base}/animal`);
        await expect(page.locator("#animal-input")).toBeDisabled();
        assert.equal(calls.length, 0);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({ path: `/tmp/skinboost-animal-${width}.png` });
        await page.locator("#start").click();
        await page.locator("#animal-input").fill("Tenho sete séruns");
        await page.locator("#send").click();
        await expect(page.locator("#chat-error")).toContainText("indisponível");
        await page.locator("#retry").click();
        await expect(page.locator(".message-assistant").last()).toContainText(
          "zero execução",
        );
        await expect(page.locator(".message-user")).toHaveCount(1);
        assert.deepEqual(calls[0], calls[1]);
        assert.equal(calls[0].mode, "animal");
        assert.equal(calls[0].humorConsent, true);
        const image = await sharp({
          create: { width: 32, height: 32, channels: 3, background: "#aabbcc" },
        })
          .png()
          .toBuffer();
        await page.locator("#animal-photo").setInputFiles({
          name: "teste.png",
          mimeType: "image/png",
          buffer: image,
        });
        await expect(page.locator("#photo-preview")).toBeVisible();
        await page.locator("#send").click();
        await expect(page.locator("#chat-error")).toContainText("Autorize");
        assert.equal(calls.length, 2);
        await page.locator("#photo-consent").check();
        await page.locator("#send").click();
        await expect(page.locator("#photo-preview")).toBeHidden();
        assert.equal(calls[2].photoConsent, true);
        assert.match(calls[2].photoDataUrl, /^data:image\//);
        assert.equal(calls[2].messages.length, 3);
        await page.screenshot({
          path: `/tmp/skinboost-animal-chat-${width}.png`,
        });
        await page.reload();
        await expect(page.locator("#start")).toBeVisible();
        await expect(page.locator(".message")).toHaveCount(0);
        assert.equal(
          await page.locator(".animal-top a").last().getAttribute("href"),
          "/chat",
        );
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
      await new Promise((resolve) => server.httpServer.close(resolve));
    }
  },
);
