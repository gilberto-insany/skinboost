/** Controlled browser regression. All API responses are intercepted; no paid calls. */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import {
  PHOTO_CHAT_RESPONSE,
  LIMITED_PHOTO_CHAT_RESPONSE,
} from "../tests/fixtures/photo-chat.mjs";
const base = process.env.PHOTO_QA_BASE || "http://127.0.0.1:4173";
const image = await readFile("public/media/persona-lucas.jpg");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.STORYBOOK_CHROME,
});
const out = "qa/photo-experience";
await mkdir(out, { recursive: true });
const report = [];
try {
  for (const [name, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000 },
    mobile: { width: 390, height: 844 },
  })) {
    const context = await browser.newContext({
      viewport,
      hasTouch: name === "mobile",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    const checks = [];
    let response = PHOTO_CHAT_RESPONSE;
    let failPath = "";
    const record = (check) => checks.push(check);
    const simulations = () =>
      requests.filter((r) => r.path === "/api/simulate");
    const send = async (text) => {
      await page.locator("#sx-message").fill(text);
      await page.locator(".sx-send").click();
    };
    const capture = async (state) =>
      page.screenshot({
        path: `${out}/${name}-${state}.png`,
        animations: "disabled",
      });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/status")
        return route.fulfill({
          json: {
            chatAvailable: true,
            simulationAvailable: true,
            available: true,
          },
        });
      const body = route.request().postDataJSON();
      requests.push({ path, body });
      if (failPath === path) {
        failPath = "";
        return route.fulfill({
          status: 502,
          json: {
            error: { message: "Falha temporária controlada. Tente novamente." },
          },
        });
      }
      if (path === "/api/chat") return route.fulfill({ json: response });
      if (path === "/api/simulate")
        return route.fulfill({
          json: {
            imageDataUrl: "data:image/jpeg;base64," + image.toString("base64"),
          },
        });
      return route.fulfill({ status: 501, json: {} });
    });
    try {
      await page.goto(base + "/");
      await expect(page.locator(".nav-cta")).toHaveText(/Começar/);
      const cta = await page.locator(".nav-cta").evaluate((button) => {
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent.includes("Começar")) continue;
          const range = document.createRange();
          range.setStart(node, node.textContent.indexOf("Começar"));
          range.setEnd(
            node,
            node.textContent.indexOf("Começar") + "Começar".length,
          );
          const rects = [...range.getClientRects()].filter(
            (r) => r.width && r.height,
          );
          const text = rects[0];
          const icon = button.querySelector("i")?.getBoundingClientRect();
          return {
            lines: rects.length,
            iconAligned:
              !icon ||
              Math.abs(text.y + text.height / 2 - icon.y - icon.height / 2) <
                text.height,
          };
        }
        return { lines: 0, iconAligned: false };
      });
      assert.equal(cta.lines, 1);
      assert.equal(cta.iconAligned, true);
      record("header Começar label and arrow remain on one line");
      await page
        .locator("#photo")
        .setInputFiles("public/media/persona-lucas.jpg");
      await expect(page.locator("#attachment")).toBeVisible();
      await page
        .locator("#skin-prompt")
        .fill("Analise minha foto. Quero entender o brilho da minha pele.");
      await page.locator("#prompt-form .send").click();
      await expect(page.locator("[data-mode]")).toContainText("OpenAI");
      await expect(page.locator('[data-action="analyze-photo"]')).toBeVisible();
      await expect(page.locator("#sx-message")).toHaveValue(
        "Analise minha foto. Quero entender o brilho da minha pele.",
      );
      await page.locator('[data-action="analyze-photo"]').click();
      await expect(page.locator("[data-error]")).toContainText("Autorize");
      assert.equal(requests.length, 0);
      await expect(page.locator("#sx-message")).toHaveValue(
        /Analise minha foto/,
      );
      record(
        "landing photo and draft retained; missing consent blocks all sending",
      );
      await page.locator("[data-photo-consent]").check();
      await page.locator('[data-action="analyze-photo"]').click();
      await expect(page.locator(".sx-photo-analysis")).toBeVisible();
      assert.equal(requests[0].body.analyzePhoto, true);
      assert.equal(requests[0].body.photoConsent, true);
      assert.match(requests[0].body.photoDataUrl, /^data:image/);
      await expect(page.locator(".sx-message-photo img")).toHaveCount(1);
      await expect(page.locator(".sx-photo-product")).toHaveCount(2);
      assert.equal(simulations().length, 0);
      record(
        "explicit image request returns observations and products without generating",
      );
      const card = page.locator(".sx-photo-product").first();
      await expect(card.locator("img")).toBeVisible();
      const layout = await card.evaluate((el) => {
        const image = el.querySelector("img").getBoundingClientRect();
        const heading = el.querySelector("h4").getBoundingClientRect();
        return {
          image: {
            x: image.x,
            y: image.y,
            right: image.right,
            bottom: image.bottom,
          },
          heading: { x: heading.x, y: heading.y },
        };
      });
      if (name === "mobile")
        assert.ok(
          layout.image.bottom <= layout.heading.y + 1,
          "mobile product image must precede the text vertically",
        );
      else
        assert.ok(
          layout.image.right <= layout.heading.x + 1 &&
            layout.heading.y < layout.image.bottom,
          "desktop product image must sit beside the text",
        );
      record(`${name} product image layout follows the responsive composition`);
      await page.locator(".sx-photo-sources summary").click();
      const source = await page.request.get(
        base + "/sources/skinboost-page-13.pdf",
      );
      assert.equal(source.ok(), true);
      assert.match(source.headers()["content-type"], /application\/pdf/);
      record("original PDF source is available");
      await page.locator(".sx-photo-analysis").scrollIntoViewIfNeeded();
      await capture("observations");
      await card.scrollIntoViewIfNeeded();
      await capture("product-choice");
      const axe = await new AxeBuilder({ page })
        .include(".sb-experience")
        .analyze();
      assert.deepEqual(
        axe.violations
          .filter((v) => ["serious", "critical"].includes(v.impact))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        [],
      );
      record("axe serious and critical violations absent");

      await send("Quero ver o antes e depois");
      const pickCleanse = page
        .locator(
          '[data-action="select-photo-product"][data-product-id="cleanse"]',
        )
        .last();
      await expect(pickCleanse).toBeVisible();
      await expect(page.locator(".sx-photo-compare")).toHaveCount(0);
      assert.equal(
        simulations().length,
        0,
        "before/after must wait for an explicit product",
      );
      record(
        "before-after intent without product opens choices and never calls simulate",
      );
      failPath = "/api/simulate";
      await pickCleanse.click();
      await expect(page.locator('[data-action="retry"]')).toBeVisible();
      assert.equal(simulations().length, 1);
      assert.equal(simulations()[0].body.selectedProductId, "cleanse");
      const beforeRetry = await page.locator('[data-role="user"]').count();
      await page.locator('[data-action="retry"]').click();
      await expect(page.locator(".sx-photo-compare")).toHaveCount(1);
      assert.equal(simulations().length, 2);
      assert.equal(simulations()[1].body.selectedProductId, "cleanse");
      assert.equal(
        await page.locator('[data-role="user"]').count(),
        beforeRetry,
      );
      record(
        "card choice sends product ID; retry preserves it without duplicate user turn",
      );

      const range = page.locator("[data-photo-compare]").first();
      await range.fill("75");
      await range.dispatchEvent("input");
      await expect(range).toHaveAttribute(
        "aria-valuetext",
        "75% da foto original",
      );
      await range.focus();
      await range.press("ArrowLeft");
      await expect(range).toHaveValue("74");
      const compare = page.locator(".sx-photo-compare").first();
      await expect
        .poll(() =>
          compare.evaluate((el) => el.style.getPropertyValue("--reveal")),
        )
        .toBe("74%");
      record("range and keyboard update the accessible comparison value");
      const geometry = await compare.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const layers = [...el.querySelectorAll(":scope > img")].map((img) => {
          const r = img.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            original: img.classList.contains("sx-compare-original"),
          };
        });
        return {
          box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          layers,
        };
      });
      assert.equal(geometry.layers.length, 2);
      for (const layer of geometry.layers)
        for (const key of ["x", "y", "width", "height"])
          assert.ok(
            Math.abs(layer[key] - geometry.box[key]) < 1,
            `comparison ${key}: both images must occupy the same box`,
          );
      const original = geometry.layers.find((layer) => layer.original);
      assert.ok(original.naturalWidth > 0 && original.naturalHeight > 0);
      assert.ok(
        Math.abs(
          geometry.box.width / geometry.box.height -
            original.naturalWidth / original.naturalHeight,
        ) < 0.02,
        "comparison preserves the original image aspect ratio",
      );
      record(
        "comparison layers share one box and preserve the original aspect ratio",
      );
      await range.fill("50");
      await range.dispatchEvent("input");
      await compare.scrollIntoViewIfNeeded();
      const bounds = await compare.boundingBox();
      const start = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
      const finish = { x: bounds.x + bounds.width * 0.24, y: start.y };
      if (name === "mobile") {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ ...start, id: 1, radiusX: 3, radiusY: 3, force: 1 }],
        });
        for (let i = 1; i <= 5; i++)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              {
                x: start.x + ((finish.x - start.x) * i) / 5,
                y: start.y,
                id: 1,
                radiusX: 3,
                radiusY: 3,
                force: 1,
              },
            ],
          });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await cdp.detach();
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(finish.x, finish.y, { steps: 5 });
        await page.mouse.up();
      }
      await expect
        .poll(async () => Number(await range.inputValue()))
        .toBeGreaterThan(18);
      await expect
        .poll(async () => Number(await range.inputValue()))
        .toBeLessThan(30);
      record(
        `${name === "mobile" ? "touch" : "mouse"} drag directly from image center controls the reveal`,
      );
      await capture("comparison");
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      record("no horizontal page overflow");
      await expect(page.locator("[data-save-status]")).toContainText("Salvo");
      await page.reload();
      await expect(page.locator(".sx-photo-analysis")).toHaveCount(1);
      await expect(page.locator(".sx-photo-compare")).toHaveCount(1);
      await expect(page.locator("[data-photo-consent]")).not.toBeChecked();
      record("session restores artifacts but requires fresh photo consent");
      await page.locator("[data-photo-consent]").check();
      failPath = "/api/chat";
      await send("O que você percebe na foto?");
      await expect(page.locator('[data-action="retry"]')).toBeVisible();
      const beforeAnalysisRetry = await page
        .locator('[data-role="user"]')
        .count();
      response = LIMITED_PHOTO_CHAT_RESPONSE;
      await page.locator('[data-action="retry"]').click();
      await expect(page.locator(".sx-observation-tag").last()).toHaveText(
        "Imagem limitada",
      );
      assert.equal(
        await page.locator('[data-role="user"]').count(),
        beforeAnalysisRetry,
      );
      assert.equal(simulations().length, 2);
      record(
        "analysis retry preserves turn and limited image does not trigger generation",
      );

      response = PHOTO_CHAT_RESPONSE;
      await page
        .locator("[data-photo]")
        .setInputFiles("public/media/persona-lucas.jpg");
      await expect(page.locator("[data-photo-consent]")).not.toBeChecked();
      await page.locator("[data-photo-consent]").check();
      await send("Analise minha foto e mostre o antes e depois");
      await expect(page.locator(".sx-photo-analysis")).toHaveCount(3);
      assert.equal(requests.at(-1).path, "/api/chat");
      assert.equal(requests.at(-1).body.analyzePhoto, true);
      assert.equal(
        simulations().length,
        2,
        "a new image must not inherit the previous product selection",
      );
      await expect(page.locator(".sx-photo-compare")).toHaveCount(1);
      record(
        "combined request analyzes first and waits for product; new photo resets selection",
      );
      await send("Quero o Comfort");
      await expect(page.locator(".sx-photo-compare")).toHaveCount(2);
      assert.equal(simulations().length, 3);
      assert.equal(simulations().at(-1).body.selectedProductId, "comfort");
      assert.equal(requests.at(-1).path, "/api/simulate");
      record(
        "explicit text choice selects Comfort and generates after a valid observation",
      );
      assert.deepEqual(errors, []);
      record("no browser errors");
      report.push({ viewport: name, passed: true, checks });
    } catch (error) {
      await capture("failure");
      report.push({
        viewport: name,
        passed: false,
        checks,
        failure: error.message,
        errors,
      });
      throw error;
    } finally {
      await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
      await context.close();
    }
  }
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
