/** Controlled browser regression. Does not call paid endpoints. */
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
  executablePath: process.env.STORYBOOK_CHROME,
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
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    let response = PHOTO_CHAT_RESPONSE;
    let fail = false;
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
      if (fail) {
        fail = false;
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
    await page.goto(base + "/");
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
    await expect(page.locator("#sx-message")).toHaveValue(/Analise minha foto/);
    await page.locator("[data-photo-consent]").check();
    await page.locator('[data-action="analyze-photo"]').click();
    await expect(page.locator(".sx-photo-analysis")).toBeVisible();
    assert.equal(requests[0].body.analyzePhoto, true);
    assert.equal(requests[0].body.photoConsent, true);
    assert.match(requests[0].body.photoDataUrl, /^data:image/);
    await expect(page.locator(".sx-message-photo img")).toHaveCount(1);
    await expect(page.locator(".sx-photo-product")).toHaveCount(2);
    await page.locator(".sx-photo-sources summary").click();
    assert.equal(
      (await page.request.get(base + "/sources/skinboost-page-13.pdf"))
        .headers()
        ["content-type"].includes("application/pdf"),
      true,
    );
    await page.locator(".sx-photo-analysis").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${name}-observations.png` });
    const axe = await new AxeBuilder({ page })
      .include(".sb-experience")
      .analyze();
    const critical = axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact),
    );
    assert.deepEqual(
      critical.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      [],
    );
    await page.locator("#sx-message").fill("Quero ver o antes e depois");
    await page.locator(".sx-send").click();
    await expect(page.locator(".sx-photo-compare")).toHaveCount(1);
    assert.equal(requests.at(-1).path, "/api/simulate");
    const range = page.locator("[data-photo-compare]");
    await range.fill("75");
    await range.dispatchEvent("input");
    await expect(range).toHaveAttribute(
      "aria-valuetext",
      "75% da foto original",
    );
    assert.equal(
      await page
        .locator(".sx-photo-compare")
        .evaluate((el) => el.style.getPropertyValue("--reveal")),
      "75%",
    );
    await page.locator(".sx-simulation").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${name}-comparison.png` });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await expect(page.locator("[data-save-status]")).toContainText("Salvo");
    await page.reload();
    await expect(page.locator(".sx-photo-analysis")).toHaveCount(1);
    await expect(page.locator(".sx-photo-compare")).toHaveCount(1);
    await expect(page.locator("[data-photo-consent]")).not.toBeChecked();
    await page.locator("[data-photo-consent]").check();
    fail = true;
    await page.locator("#sx-message").fill("O que você percebe na foto?");
    await page.locator(".sx-send").click();
    await expect(page.locator('[data-action="retry"]')).toBeVisible();
    const count = await page.locator('[data-role="user"]').count();
    response = LIMITED_PHOTO_CHAT_RESPONSE;
    await page.locator('[data-action="retry"]').click();
    await expect(page.locator(".sx-observation-tag").last()).toHaveText(
      "Imagem limitada",
    );
    assert.equal(await page.locator('[data-role="user"]').count(), count);
    response = PHOTO_CHAT_RESPONSE;
    await page
      .locator("[data-photo]")
      .setInputFiles("public/media/persona-lucas.jpg");
    await expect(page.locator("[data-photo-consent]")).not.toBeChecked();
    await page.locator("[data-photo-consent]").check();
    await page
      .locator("#sx-message")
      .fill("Analise minha foto e mostre o antes e depois");
    await page.locator(".sx-send").click();
    await expect(page.locator(".sx-photo-compare")).toHaveCount(2);
    assert.deepEqual(
      requests.slice(-2).map((r) => r.path),
      ["/api/chat", "/api/simulate"],
    );
    assert.equal(requests.at(-2).body.analyzePhoto, true);
    assert.deepEqual(errors, []);
    report.push({
      viewport: name,
      passed: true,
      checks: [
        "landing attachment and original request retained in chat",
        "consent before upload to provider",
        "photo and draft retained on missing consent",
        "explicit vision request",
        "photo in timeline",
        "observations and sourced product cards",
        "source PDF available",
        "before-after intent",
        "keyboard range comparison",
        "session restoration",
        "fresh consent after reload",
        "retry without duplicate",
        "honest limited image",
        "no overflow",
        "axe serious/critical none",
        "no browser errors",
        "combined request observes photo before generating illustration",
      ],
    });
    await context.close();
  }
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
