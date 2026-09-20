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
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
};
let server, browser, origin;

async function auditAccessibility(page, { landing = false } = {}) {
  // The Storybook a11y addon may be finishing its own post-play audit.
  // Serialize with that runner; never suppress a rule violation.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.waitForFunction(() => !window.axe?._running);
    try {
      const builder = new AxeBuilder({ page }).include(
        landing ? ".sb-landing-surface" : ".sb-catalog",
      );
      // WCAG text contrast excludes the decorative brand logotype itself.
      if (landing) builder.exclude(".footer-wordmark");
      return await builder.analyze();
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
      // Chromium requests the origin favicon even for a standalone iframe.
      if (pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
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

test("both catalogs share conversation stories; the current landing belongs to wireframe", async () => {
  const [wireframe, hifi] = await Promise.all(
    ["wireframe", "alta-fidelidade"].map(async (name) => {
      const response = await fetch(`${origin}/storybook/${name}/index.json`);
      assert.equal(response.status, 200);
      const data = await response.json();
      return Object.keys(data.entries).sort();
    }),
  );
  assert.deepEqual(
    hifi,
    wireframe.filter((id) => !id.startsWith("landing-componentes--")),
  );
  for (const id of [
    "home",
    "cabecalho",
    "hero-prompt",
    "prompt-erro",
    "prompt-sugestao",
    "prompt-foto",
    "introducao",
    "como-funciona",
    "escolha-explicada",
    "continuidade",
    "manifesto",
    "bento-completo",
    "bento-contexto",
    "bento-motivo",
    "bento-produtos",
    "bento-privacidade",
    "bento-checkin",
    "produto-3-d",
    "catalogo",
    "cleanse",
    "balance",
    "comfort",
    "comparador",
    "relato-lucas",
    "relato-marina",
    "relato-denise",
    "confianca",
    "perguntas-frequentes",
    "pergunta-aberta",
    "chamada-final",
    "rodape",
    "privacidade",
    "sobre",
    "redes",
  ]) {
    assert.ok(
      wireframe.includes(`landing-componentes--${id}`),
      `Missing real landing component ${id}`,
    );
  }
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
    "foto-observada",
    "foto-limitada",
    "comparacao-ilustrativa",
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
        const catalogColors = await frame
          .locator(".sb-catalog")
          .evaluate((el) => {
            const style = getComputedStyle(el);
            return { background: style.backgroundColor, text: style.color };
          });
        assert.deepEqual(
          catalogColors,
          mode === "wireframe"
            ? { background: "rgb(245, 246, 244)", text: "rgb(20, 22, 21)" }
            : { background: "rgb(248, 245, 237)", text: "rgb(24, 62, 49)" },
          `${mode} must keep its own catalog theme`,
        );
        if (id === "tipografia") {
          const family = await frame
            .locator(".sb-catalog")
            .evaluate((el) => getComputedStyle(el).fontFamily);
          assert.match(
            family,
            mode === "wireframe" ? /Manrope Variable/ : /Avenir Next/,
          );
        }
        if (id === "botoes") {
          assert.equal(
            await frame
              .getByRole("button", { name: "Aguardando resposta" })
              .isDisabled(),
            true,
          );
          assert.equal(
            await frame
              .getByRole("button", { name: "Continuar" })
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            mode === "wireframe" ? "rgb(49, 94, 75)" : "rgb(24, 62, 49)",
            `${mode} primary action must use its own functional color`,
          );
        }
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
  "every chat story isolates its named component in both themes on desktop and mobile",
  { timeout: 300000 },
  async () => {
    const report = [];
    for (const mode of ["wireframe", "alta-fidelidade"]) {
      const index = await (
        await fetch(`${origin}/storybook/${mode}/index.json`)
      ).json();
      const ids = Object.values(index.entries)
        .filter(
          (entry) =>
            entry.type === "story" &&
            entry.id.startsWith("experiencia-jornada-guiada--"),
        )
        .map((entry) => entry.id);
      assert.ok(
        ids.length >= 48,
        "All previous stories and individual chat components are covered",
      );
      const context = await browser.newContext({
        viewport: { width: 1365, height: 1050 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [],
        apiRequests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/"))
          apiRequests.push(request.url());
      });
      for (const id of ids) {
        await page.goto(
          `${origin}/storybook/${mode}/iframe.html?id=${id}&viewMode=story`,
          { waitUntil: "networkidle" },
        );
        await page.locator('.sb-chat-component[data-ready="true"]').waitFor();
        const host = page.locator(".sb-chat-component");
        const component = await host.getAttribute("data-component");
        assert.equal(
          await host
            .locator(".sx-chat,.sx-thread,.sx-scroll,.sx-history-scrim")
            .count(),
          0,
          `${id}: no application frame even when hidden`,
        );
        assert.equal(
          await host.locator(".sx-sidebar").count(),
          component === "sidebar" ? 1 : 0,
          `${id}: sidebar only in its own story`,
        );
        assert.equal(
          await host.locator(".sx-top").count(),
          component === "topbar" ? 1 : 0,
          `${id}: header only in its own story`,
        );
        assert.equal(
          await host.locator(".sx-composer").count(),
          component === "composer" ? 1 : 0,
          `${id}: composer only in its own story`,
        );
        assert.equal(
          await host.locator(".sx-dock").count(),
          component === "composer" ? 1 : 0,
        );
        assert.ok(
          (await host.innerText()).trim().length > 15,
          `${id}: populated component`,
        );
        assert.equal(await host.locator("dialog[open]").count(), 0);
        const expected = {
          welcome: ".sx-message",
          question: ".sx-message",
          "user-message": ".sx-user",
          suggestions: ".sx-chip-row",
          context: ".sx-context-card",
          routine: ".sx-routine",
          product: ".sx-product",
          refine: ".sx-refine",
          "visual-invite": ".sx-visual-invite",
          cart: ".sx-card",
          checkout: ".sx-checkout",
          "price-comparison": ".sx-comparison-table",
          source: ".sx-source-card",
          checkin: ".sx-chip-row",
          note: ".sx-note-text",
          alternative: ".sx-inherited",
          feedback: ".sx-response-tools",
          privacy: ".sx-card",
          "photo-observed": ".sx-photo-analysis",
          "photo-limited": ".sx-photo-analysis",
          "photo-products": ".sx-photo-products",
          "photo-sources": ".sx-photo-sources",
          "photo-comparison": ".sx-simulation",
          "photo-checkout": ".sx-photo-checkout",
          "photo-attachment": ".sx-file",
          topbar: ".sx-top",
          sidebar: ".sx-sidebar",
          composer: ".sx-composer",
          thinking: ".sx-thinking",
          partial: ".sx-message",
          alternatives: ".sx-alternative-options",
          verification: ".sx-verify-list",
          sources: ".sx-source-links",
          "voice-consent": ".sx-voice-orbit",
          "feedback-options": ".sx-feedback-options",
          disclaimer: ".sx-disclaimer",
        };
        assert.ok(
          expected[component],
          `${id}: component is covered by the isolation audit`,
        );
        assert.equal(
          await host.locator(expected[component]).count(),
          1,
          `${id}: exactly one named component`,
        );
        if (id.endsWith("--carrinho-vazio"))
          await page.waitForFunction(
            () => document.querySelector('[data-action="checkout"]')?.disabled,
          );
        if (id.endsWith("--voz-revisavel"))
          await page.waitForFunction(
            () =>
              document.querySelector("#sx-message")?.value ===
              "Meu rascunho inicial. Quero uma rotina com poucos passos.",
          );
        if (id.endsWith("--comparacao-ilustrativa"))
          await page.waitForFunction(
            () =>
              document
                .querySelector('[role="slider"]')
                ?.getAttribute("aria-valuetext") === "51% da foto original",
          );
        if (id.endsWith("--origem-do-contexto"))
          assert.ok((await host.locator(".sx-origin").count()) > 0);
        const family = await host.evaluate(
          (el) => getComputedStyle(el).fontFamily,
        );
        assert.match(
          family,
          mode === "wireframe" ? /Manrope Variable/ : /Avenir Next/,
        );
        const label = await page
          .locator(".sb-catalog-status strong")
          .innerText();
        assert.match(
          label,
          mode === "wireframe" ? /implementada/ : /proposta em revisão/,
        );
        const accessibility = await auditAccessibility(page);
        const violations = accessibility.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          targets: v.nodes.map((n) => n.target),
        }));
        const desktopOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        await page.setViewportSize({ width: 390, height: 844 });
        const mobileOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        assert.ok(await host.isVisible(), `${id}: visible on mobile`);
        if (
          [
            "acne",
            "rotina",
            "cabecalho",
            "historico",
            "mensagem-livre",
            "comparacao-ilustrativa",
          ].some((s) => id.endsWith("--" + s))
        ) {
          await page.screenshot({
            path: resolve(artifacts, `${mode}-${id.split("--")[1]}-mobile.png`),
            fullPage: true,
          });
        }
        report.push({
          mode,
          id,
          component,
          violations,
          desktopOverflow,
          mobileOverflow,
        });
        await page.setViewportSize({ width: 1365, height: 1050 });
      }
      // A new selection instance must not inherit the emptied previous story.
      await page.goto(
        `${origin}/storybook/${mode}/iframe.html?id=experiencia-jornada-guiada--carrinho&viewMode=story`,
        { waitUntil: "networkidle" },
      );
      assert.ok((await page.locator("[data-cart-item]:checked").count()) > 0);
      assert.deepEqual(errors, [], `${mode}: runtime errors`);
      assert.deepEqual(apiRequests, [], `${mode}: no API requests`);
      await context.close();
    }
    await writeFile(
      resolve(artifacts, "review.json"),
      JSON.stringify(report, null, 2),
    );
    assert.deepEqual(
      report.filter(
        (row) =>
          row.violations.length || row.desktopOverflow || row.mobileOverflow,
      ),
      [],
      "Inspect qa/storybook/review.json",
    );
  },
);

test(
  "isolated components preserve selection, source disclosure and touch comparison",
  { timeout: 60000 },
  async () => {
    for (const mode of ["wireframe", "alta-fidelidade"]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        reducedMotion: "reduce",
      });
      const open = async (id) => {
        await page.goto(
          `${origin}/storybook/${mode}/iframe.html?id=experiencia-jornada-guiada--${id}&viewMode=story`,
          { waitUntil: "networkidle" },
        );
        await page.locator('.sb-chat-component[data-ready="true"]').waitFor();
      };
      await open("carrinho");
      for (const checkbox of await page.locator("[data-cart-item]").all())
        await checkbox.uncheck();
      assert.ok(
        await page.getByRole("button", { name: /checkout/i }).isDisabled(),
      );
      await page.locator("[data-cart-item]").first().check();
      assert.ok(
        await page.getByRole("button", { name: /checkout/i }).isEnabled(),
      );
      await open("origem-do-contexto");
      await page.locator(".sx-origin summary").first().click();
      assert.ok(
        await page.locator(".sx-origin blockquote").first().isVisible(),
      );
      await open("comparacao-ilustrativa");
      const stage = page.locator(".sx-photo-compare");
      const box = await stage.boundingBox();
      await page.touchscreen.tap(
        box.x + box.width * 0.75,
        box.y + box.height / 2,
      );
      assert.ok(
        Number(await page.locator("[data-photo-compare]").inputValue()) > 65,
      );
      assert.equal(await page.locator("[data-example-checkout]").count(), 0);
      await open("convite-compra");
      assert.equal(await page.locator(".sx-simulation").count(), 0);
      const cta = page.locator("[data-example-checkout]");
      assert.equal(
        await cta.getAttribute("href"),
        "https://www.designengineer.com.br/oferta",
      );
      await page.close();
    }
  },
);

test(
  "wireframe landing stories reuse current markup, behavior and assets",
  { timeout: 180000 },
  async () => {
    const index = await (
      await fetch(`${origin}/storybook/wireframe/index.json`)
    ).json();
    const ids = Object.keys(index.entries).filter((id) =>
      id.startsWith("landing-componentes--"),
    );
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [],
      apiRequests = [],
      report = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        apiRequests.push(request.url());
    });
    try {
      for (const id of ids) {
        await page.goto(
          `${origin}/storybook/wireframe/iframe.html?id=${id}&viewMode=story`,
          { waitUntil: "networkidle" },
        );
        await page.locator('.sb-landing-surface[data-ready="true"]').waitFor();
        assert.equal(
          await page
            .locator(".sb-landing-surface")
            .evaluate((el) => getComputedStyle(el).backgroundColor),
          id.endsWith("--cabecalho") ? "rgb(59, 64, 60)" : "rgb(245, 246, 244)",
          `${id}: landing surface must use the semantic theme`,
        );
        if (await page.locator(".hero").count()) {
          assert.equal(
            await page
              .locator(".hero")
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            "rgb(59, 64, 60)",
          );
          assert.equal(
            await page
              .locator(".send")
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            "rgb(49, 94, 75)",
          );
        }
        if (await page.locator(".final-cta").count())
          assert.equal(
            await page
              .locator(".final-cta")
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            "rgb(112, 120, 114)",
          );
        if (
          (await page.locator(".bento-context").count()) &&
          (await page.locator(".bento-reason").count()) &&
          (await page.locator(".bento-checkin").count())
        ) {
          const bentoColors = await page.evaluate(() => ({
            context: getComputedStyle(document.querySelector(".bento-context"))
              .backgroundColor,
            reason: getComputedStyle(document.querySelector(".bento-reason"))
              .backgroundColor,
            checkin: getComputedStyle(document.querySelector(".bento-checkin"))
              .backgroundColor,
          }));
          assert.deepEqual(bentoColors, {
            context: "rgb(227, 236, 228)",
            reason: "rgb(236, 238, 236)",
            checkin: "rgb(14, 40, 32)",
          });
        }
        if (await page.locator(".story-card").count())
          assert.equal(
            await page
              .locator(".story-card")
              .first()
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            "rgb(236, 238, 236)",
          );
        if (await page.locator("#footer").count())
          assert.equal(
            await page
              .locator("#footer")
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            "rgb(227, 236, 228)",
          );
        if (id.endsWith("--prompt-foto"))
          await page.getByRole("button", { name: "Remover foto" }).waitFor();
        if (
          [
            "cleanse",
            "balance",
            "comfort",
            "privacidade",
            "sobre",
            "redes",
          ].some((name) => id.endsWith(`--${name}`))
        )
          await page.locator("dialog[open]").waitFor();
        if (id.endsWith("--produto-3-d")) {
          await page.waitForFunction(
            () =>
              ["ready", "webgl-unavailable", "unavailable"].includes(
                document.querySelector("#bottle-canvas")?.dataset.status,
              ),
            { timeout: 30000 },
          );
          assert.equal(
            await page.locator("#bottle-canvas").getAttribute("data-status"),
            "ready",
            "The real GLB should render with WebGL in Chromium.",
          );
          assert.equal(await page.locator("#bottle-canvas canvas").count(), 1);
        }
        await page.waitForFunction(() =>
          [...document.querySelectorAll(".sb-landing-surface img")]
            .filter((image) => {
              const rect = image.getBoundingClientRect();
              return (
                image.loading !== "lazy" ||
                (rect.bottom > 0 && rect.top < innerHeight)
              );
            })
            .every((image) => image.complete && image.naturalWidth > 0),
        );
        const accessibility = await auditAccessibility(page, { landing: true });
        const violations = accessibility.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
        if (id.endsWith("--comparador")) {
          const slider = page.getByRole("slider");
          await slider.fill("72");
          assert.equal(
            await page
              .locator(".comparison")
              .evaluate((el) => el.style.getPropertyValue("--split")),
            "72%",
          );
        }
        if (id.endsWith("--como-funciona")) {
          await page.getByRole("tab").first().focus();
          await page.keyboard.press("ArrowRight");
          assert.equal(
            await page.getByRole("tab").nth(1).getAttribute("aria-selected"),
            "true",
          );
        }
        if (id.endsWith("--prompt-sugestao"))
          assert.equal(
            await page.locator("#skin-prompt").inputValue(),
            "Quero começar a cuidar da minha pele com poucos passos.",
          );
        if (id.endsWith("--prompt-erro"))
          assert.equal(await page.locator("#prompt-error").isVisible(), true);
        if (id.endsWith("--rodape"))
          assert.equal(await page.locator(".footer-image").count(), 0);
        if (id.endsWith("--pergunta-aberta"))
          assert.equal(
            await page.locator("details").first().getAttribute("open"),
            "",
          );
        if (await page.locator("dialog[open]").count()) {
          assert.equal(
            await page
              .locator("dialog[open]")
              .evaluate((el) => getComputedStyle(el).backgroundColor),
            "rgb(245, 246, 244)",
          );
          await page.keyboard.press("Escape");
          assert.equal(await page.locator("dialog[open]").count(), 0);
        }
        const desktopOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        await page.setViewportSize({ width: 390, height: 844 });
        const mobileOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        if (id.endsWith("--cabecalho")) {
          await page.getByRole("button", { name: "Abrir menu" }).click();
          assert.equal(
            await page
              .getByRole("button", { name: "Fechar menu" })
              .getAttribute("aria-expanded"),
            "true",
          );
        }
        report.push({ id, desktopOverflow, mobileOverflow, violations });
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
    } finally {
      await writeFile(
        resolve(artifacts, "landing-review.json"),
        JSON.stringify({ report, errors, apiRequests }, null, 2),
      );
      await context.close();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(apiRequests, []);
    assert.deepEqual(
      report.filter(
        (row) =>
          row.desktopOverflow || row.mobileOverflow || row.violations.length,
      ),
      [],
      "Inspect qa/storybook/landing-review.json",
    );
  },
);
