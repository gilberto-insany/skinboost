import assert from "node:assert/strict";
import { test } from "node:test";
import { preview } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import sharp from "sharp";

test(
  "Animal mobile and desktop: direct entry, surprise photo, deliberate send, retry and ephemeral state",
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
        let care = false;
        const imageCalls = [];
        let imageFail = true;
        let releaseImage;
        const imageGate = new Promise((resolve) => {
          releaseImage = resolve;
        });
        const after = await sharp({
          create: { width: 32, height: 32, channels: 3, background: "#aa00ff" },
        })
          .jpeg()
          .toBuffer();
        await page.route("**/api/simulate", async (route) => {
          imageCalls.push(route.request().postDataJSON());
          if (imageFail) {
            imageFail = false;
            await imageGate;
            return route.fulfill({
              status: 502,
              contentType: "application/json",
              body: JSON.stringify({
                error: { message: "Falha de teste na imagem" },
              }),
            });
          }
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              kind: "parody",
              imageDataUrl: `data:image/jpeg;base64,${after.toString("base64")}`,
              caption: "Até esse depois ficou melhor, pô.",
              disclaimer: "Montagem de humor. Não é resultado de skincare.",
            }),
          });
        });
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
            body: `data: ${JSON.stringify({ type: "delta", text: "Sete séruns" })}\n\ndata: ${JSON.stringify({ type: "complete", result: { text: "Sete séruns e nenhuma rotina. Seu banheiro virou uma startup: muito investimento, zero execução.", choices: [], ready: false, care } })}\n\n`,
          });
        });
        await page.goto(`${base}/animal`);
        await expect(page.locator("#animal-input")).toBeEnabled();
        await expect(page.locator("#start")).toHaveCount(0);
        await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
        assert.doesNotMatch(
          await page.locator("body").innerText(),
          /brux[ao]|palhaço/i,
        );
        assert.equal(calls.length, 0);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await page.screenshot({ path: `/tmp/skinboost-animal-${width}.png` });
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
        await expect(page.locator("#photo-permission")).toContainText("OpenAI");
        assert.doesNotMatch(
          await page.locator("body").innerText(),
          /brux[ao]|palhaço/i,
        );
        assert.equal(calls.length, 2, "attachment alone must not upload");
        assert.equal(
          imageCalls.length,
          0,
          "attachment alone must not generate",
        );
        await page.locator("#send").click();
        await expect(page.locator("#photo-preview")).toBeHidden();
        assert.equal(calls[2].photoConsent, true);
        assert.match(calls[2].photoDataUrl, /^data:image\//);
        assert.equal(calls[2].messages.length, 3);
        await expect(page.locator(".parody-loader")).toBeVisible();
        await expect(page.locator(".animal-parody")).toHaveAttribute(
          "aria-busy",
          "true",
        );
        await expect(page.locator(".parody-progress")).toContainText(
          "Vou fazer seu antes e depois com nossos produtos",
        );
        await expect(page.locator(".parody-result")).toBeHidden();
        await expect(page.locator(".rebirth-card")).toBeHidden();
        assert.doesNotMatch(
          await page.locator(".animal-parody").innerText(),
          /brux[ao]|palhaç[ao]|fantasia|crime artístico/i,
        );
        await expect(page.locator(".parody-spinner")).toHaveCSS(
          "animation-name",
          "none",
        );
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await expect(page.locator(".parody-spinner")).toHaveCSS(
          "animation-name",
          "parody-spin",
        );
        await page.locator(".animal-parody").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/animal-loading-${width}.png` });
        await page.emulateMedia({ reducedMotion: "reduce" });
        releaseImage();
        await expect(page.locator(".parody-progress")).toContainText(
          "Falha de teste",
        );
        await expect(page.locator(".parody-loader")).toBeHidden();
        await expect(page.locator("#send")).toBeEnabled();
        await page.locator(".parody-retry").click();
        await expect(page.locator(".parody-result")).toBeVisible();
        await expect(page.locator(".sx-compare-base")).toHaveJSProperty(
          "naturalWidth",
          32,
        );
        await expect(page.locator(".parody-loader")).toBeHidden();
        await expect(page.locator(".animal-parody")).toHaveAttribute(
          "aria-busy",
          "false",
        );
        await expect(page.locator("#send")).toBeEnabled();
        assert.equal(calls.length, 3, "retry must not rerun the chat");
        assert.equal(imageCalls.length, 2);
        assert.equal(imageCalls[0].mode, "animal");
        assert.equal(imageCalls[0].parodyConsent, true);
        assert.deepEqual(imageCalls[0], imageCalls[1]);
        const handle = page.locator("[data-photo-handle]");
        await handle.focus();
        await handle.press("End");
        await expect(handle).toHaveAttribute("aria-valuenow", "100");
        const stage = page.locator("[data-photo-drag]");
        const bounds = await stage.boundingBox();
        await page.mouse.move(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          bounds.x + bounds.width * 0.25,
          bounds.y + bounds.height / 2,
        );
        await page.mouse.up();
        await expect(handle).toHaveAttribute("aria-valuenow", /^2[45]$/);
        await expect(page.locator(".rebirth-copy")).toContainText(
          "NASCER DE NOVO",
        );
        await page.screenshot({
          path: `/tmp/skinboost-animal-parody-${width}.png`,
        });
        await page.locator(".rebirth-copy button").click();
        await expect(page.locator("#send")).toBeEnabled();
        assert.match(calls.at(-1).messages.at(-1).text, /NASCER DE NOVO/);
        care = true;
        await page.locator("#animal-photo").setInputFiles({
          name: "test.png",
          mimeType: "image/png",
          buffer: image,
        });
        await expect(page.locator("#photo-preview")).toBeVisible();
        await page
          .locator("#animal-input")
          .fill("Não quero mais a brincadeira");
        await page.locator("#send").click();
        await expect(page.locator("#connection-status")).toContainText(
          "Brincadeira pausada",
        );
        assert.equal(
          imageCalls.length,
          2,
          "no generation after care/withdrawal",
        );
        await page.reload();
        await expect(page.locator("#intro")).toBeVisible();
        await expect(page.locator("#animal-input")).toBeEnabled();
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
