import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist/client");
const artifacts = resolve(root, "qa/storybook");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};
let server, browser, origin;

async function auditAccessibility(page) {
  // The Storybook a11y addon may be finishing its own post-play audit.
  // Serialize with that runner; never suppress a rule violation.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForFunction(() => !window.axe?._running);
    try {
      return await new AxeBuilder({ page }).include(".sb-catalog").analyze();
    } catch (error) {
      if (!error.message.includes("Axe is already running") || attempt === 2)
        throw error;
    }
  }
}

before(async () => {
  assert.ok(
    existsSync(resolve(output, "storybook/wireframe/index.html")),
    "Run npm run build:review first.",
  );
  await mkdir(artifacts, { recursive: true });
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let file = resolve(output, `.${pathname}`);
      if (file !== output && !file.startsWith(output + sep))
        throw new Error("Outside build");
      if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
      const data = await readFile(file);
      res.writeHead(200, {
        "content-type": types[extname(file)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const localChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.STORYBOOK_CHROME ||
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync(localChrome) ? localChrome : undefined),
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
});

test("two independent builds expose the same CSF3 inventory", async () => {
  const [wireframe, hifi] = await Promise.all(
    ["wireframe", "alta-fidelidade"].map(async (name) => {
      const response = await fetch(`${origin}/storybook/${name}/index.json`);
      assert.equal(response.status, 200);
      const data = await response.json();
      return Object.keys(data.entries).sort();
    }),
  );
  assert.deepEqual(hifi, wireframe);
  for (const name of [
    "boas-vindas",
    "contexto",
    "rotina",
    "carrinho",
    "checkout",
    "checkin",
    "acne",
    "oleosidade",
    "cuidados-gerais",
    "ressecamento",
    "mensagem-livre",
    "sugestao-como-mensagem",
    "origem-do-contexto",
    "resumo-da-conversa",
    "alternativa",
    "feedback-registrado",
    "voz-revisavel",
  ]) {
    assert.ok(
      wireframe.includes(`experiencia-jornada-guiada--${name}`),
      `Missing ${name}`,
    );
  }
});

test(
  "the manager opens foundation stories and proposed typography stays isolated",
  { timeout: 60000 },
  async () => {
    for (const mode of ["wireframe", "alta-fidelidade"]) {
      const page = await browser.newPage({
        viewport: { width: 1480, height: 1050 },
      });
      for (const id of ["paleta", "tipografia", "botoes"]) {
        await page.goto(
          `${origin}/storybook/${mode}/?path=/story/fundamentos-identidade--${id}`,
          { waitUntil: "networkidle" },
        );
        const frame = page.frameLocator("#storybook-preview-iframe");
        await frame.locator(".sb-foundation").waitFor();
        if (id === "tipografia") {
          const family = await frame
            .locator(".sb-catalog")
            .evaluate((el) => getComputedStyle(el).fontFamily);
          assert.match(
            family,
            mode === "wireframe" ? /Manrope Variable/ : /Avenir Next/,
          );
        }
        if (id === "botoes")
          assert.equal(
            await frame
              .getByRole("button", { name: "Aguardando resposta" })
              .isDisabled(),
            true,
          );
      }
      await page.screenshot({
        path: resolve(artifacts, `${mode}-manager.png`),
        fullPage: true,
      });
      await page.close();
    }
  },
);

test(
  "continuous conversation states work at deployed subpaths, with keyboard access, mobile layout and accessibility",
  { timeout: 120000 },
  async () => {
    const report = [];
    for (const mode of ["wireframe", "alta-fidelidade"]) {
      const context = await browser.newContext({
        viewport: { width: 1365, height: 1050 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      const apiRequests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/"))
          apiRequests.push(request.url());
      });
      const story = (id) =>
        `${origin}/storybook/${mode}/iframe.html?id=experiencia-jornada-guiada--${id}&viewMode=story`;
      for (const id of [
        "boas-vindas",
        "contexto",
        "rotina",
        "carrinho",
        "checkout",
        "checkin",
        "acne",
        "oleosidade",
        "cuidados-gerais",
        "ressecamento",
        "mensagem-livre",
        "sugestao-como-mensagem",
        "carrinho-vazio",
        "origem-do-contexto",
        "resumo-da-conversa",
        "alternativa",
        "feedback-registrado",
        "voz-revisavel",
      ]) {
        await page.goto(story(id), { waitUntil: "networkidle" });
        await page.getByRole("log").waitFor();
        await page.locator(".sb-experience #sx-message").waitFor();
        if (id === "mensagem-livre") {
          await page.waitForFunction(() =>
            document
              .querySelector('[role="log"]')
              ?.textContent.includes(
                "Minha pele fica oleosa ao longo do dia. Quero poucos passos.",
              ),
          );
        }
        if (id === "carrinho-vazio")
          await page.waitForFunction(
            () => document.querySelector('[data-action="checkout"]')?.disabled,
          );
        if (id === "voz-revisavel") {
          await page.waitForFunction(
            () =>
              document.querySelector("#sx-message")?.value ===
              "Meu rascunho inicial. Quero uma rotina com poucos passos.",
          );
          assert.equal(await page.locator('[data-role="user"]').count(), 0);
          assert.match(
            await page.locator("[data-save-status]").innerText(),
            /sem microfone nem envio de áudio/,
          );
        }
        if (id === "resumo-da-conversa")
          assert.match(
            await page.locator(".sx-note-text").innerText(),
            /não é diagnóstico nem prescrição/,
          );
        if (id === "alternativa")
          assert.match(
            await page.getByRole("log").innerText(),
            /conversa original continua guardada/,
          );
        const accessibility = await auditAccessibility(page);
        const violations = accessibility.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          targets: v.nodes.map((n) => n.target),
        }));
        const ink = await page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--ink")
            .trim(),
        );
        assert.equal(ink, mode === "wireframe" ? "#121f21" : "#183e31");
        const label = await page
          .locator(".sb-catalog-status strong")
          .innerText();
        assert.match(
          label,
          mode === "wireframe" ? /implementada/ : /proposta em revisão/,
        );
        await page.locator("#sx-message").focus();
        await page.keyboard.press("Tab");
        const focusInside = await page.evaluate(() =>
          Boolean(document.activeElement.closest(".sb-experience")),
        );
        await page.setViewportSize({ width: 390, height: 844 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        if (["boas-vindas", "rotina"].includes(id))
          await page.screenshot({
            path: resolve(artifacts, `${mode}-${id}-mobile.png`),
            fullPage: true,
          });
        await page.setViewportSize({ width: 1365, height: 1050 });
        report.push({
          mode,
          story: id,
          violations,
          focusInside,
          mobileOverflow: overflow,
        });
      }
      // A new story instance must not inherit the previous canvas selection.
      await page.goto(story("carrinho"), { waitUntil: "networkidle" });
      assert.ok((await page.locator("[data-cart-item]:checked").count()) > 0);
      assert.deepEqual(errors, [], `${mode}: runtime errors`);
      assert.deepEqual(
        apiRequests,
        [],
        `${mode}: stories must remain local demonstrations`,
      );
      await context.close();
    }
    await writeFile(
      resolve(artifacts, "review.json"),
      JSON.stringify(report, null, 2),
    );
    const failures = report.filter(
      (row) => row.violations.length || !row.focusInside || row.mobileOverflow,
    );
    assert.deepEqual(
      failures,
      [],
      "Inspect qa/storybook/review.json for accessibility/layout findings.",
    );
  },
);

test(
  "freeform messages and suggested replies retain the conversation in both catalogs",
  { timeout: 60000 },
  async () => {
    for (const mode of ["wireframe", "alta-fidelidade"]) {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 950 },
        reducedMotion: "reduce",
      });
      await page.goto(
        `${origin}/storybook/${mode}/iframe.html?id=experiencia-jornada-guiada--boas-vindas&viewMode=story`,
        { waitUntil: "networkidle" },
      );
      await page.getByRole("log").waitFor();
      const messageIds = () =>
        page
          .locator(".sx-thread [data-message-id]")
          .evaluateAll((elements) =>
            elements.map((el) => el.dataset.messageId),
          );
      const initial = await messageIds();
      const messages = [
        "Minha pele fica oleosa ao longo do dia. Quero poucos passos.",
        "Já uso um limpador e prefiro gastar até R$ 150.",
      ];
      for (const message of messages) {
        await page.locator("#sx-message").fill(message);
        await page.getByRole("button", { name: "Enviar mensagem" }).click();
        await page.waitForFunction(
          (text) =>
            document.querySelector('[role="log"]')?.textContent.includes(text),
          message,
        );
        await page.waitForFunction(
          () => !document.querySelector("#sx-message")?.disabled,
        );
        const ids = await messageIds();
        for (const id of initial)
          assert.ok(
            ids.includes(id),
            `${mode}: original message ${id} disappeared`,
          );
        assert.ok(
          await page.locator("#sx-message").isVisible(),
          `${mode}: composer disappeared`,
        );
      }
      for (const text of messages)
        assert.ok((await page.getByRole("log").innerText()).includes(text));
      const beforeSuggestion = await messageIds();
      const reply = page.locator("button[data-reply]").last();
      await reply.waitFor();
      const replyText = await reply.getAttribute("data-reply");
      await reply.click();
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll(".sx-thread [data-message-id]").length >
          count,
        beforeSuggestion.length,
      );
      const afterSuggestion = await messageIds();
      for (const id of beforeSuggestion)
        assert.ok(
          afterSuggestion.includes(id),
          `${mode}: message ${id} disappeared after suggestion`,
        );
      assert.ok((await page.getByRole("log").innerText()).includes(replyText));
      for (const text of messages)
        assert.ok((await page.getByRole("log").innerText()).includes(text));
      await page.close();
    }
  },
);
