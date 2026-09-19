/** Browser QA for conversation upgrades. Synthetic text only, paid APIs blocked.
 * Run against Vite: node scripts/check-chat-upgrades.mjs --base=http://127.0.0.1:4173
 * The harness imports the real renderer; only voice transport and API responses are controlled.
 */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const base =
  process.argv.find((arg) => arg.startsWith("--base="))?.slice(7) ||
  "http://127.0.0.1:4173";
const output = resolve("qa/chat-upgrades");
await mkdir(output, { recursive: true });
const implementation = resolve("qa/implementation");
await mkdir(implementation, { recursive: true });
const captures = [];
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.STORYBOOK_CHROME,
});
const report = {
  base,
  time: new Date().toISOString(),
  api: "controlled responses; no provider requests",
  checks: [],
  errors: [],
};
const complete =
  "Quero começar uma rotina de cuidados. Já uso limpeza. Nenhuma restrição conhecida. Quero poucos passos. Meu orçamento é até R$ 150.";
const response = {
  text: "Resposta controlada para avaliar a interface. O que você quer ajustar?",
  choices: [],
  context: {},
  ready: false,
  care: false,
};
const harness = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA SkinBoost</title><style>html,body{margin:0;height:100%}#qa-host{height:100dvh}</style></head><body><main id="qa-host"></main></body></html>`;
for (const [viewport, size] of Object.entries({
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
})) {
  const context = await browser.newContext({
    viewport: size,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let live = false,
    hold = false;
  const held = [],
    requests = [];
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    requests.push(pathname);
    if (pathname === "/api/status")
      return route.fulfill({
        json: {
          available: live,
          chatAvailable: live,
          simulationAvailable: false,
        },
      });
    if (pathname === "/api/chat") {
      if (hold) {
        held.push(route);
        return;
      }
      return route.fulfill({ json: response });
    }
    return route.fulfill({
      status: 501,
      json: { error: { message: "Endpoint blocked by local QA." } },
    });
  });
  await page.route("**/__qa-chat-harness", (route) =>
    route.fulfill({ contentType: "text/html", body: harness }),
  );
  const capture = async (name, kind = "deterministic app demonstration") => {
    if (viewport === "mobile" && name !== "mobile-history") return;
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    await page.screenshot({
      path: resolve(implementation, `${name}.png`),
      animations: "disabled",
    });
    captures.push({ file: `${name}.png`, viewport, kind, url: page.url() });
  };
  const saved = () =>
    expect(page.locator("[data-save-status]")).toHaveText(
      /Salvo neste navegador/,
    );
  const record = (name, details = {}) =>
    report.checks.push({ viewport, name, passed: true, ...details });
  const mount = async (options = {}) => {
    await page.goto(base + "/__qa-chat-harness");
    await page.evaluate(async (options) => {
      await import("/src/styles.css");
      const { mountExperience } = await import("/src/experience.js");
      const { createThreadFixture } = await import("/src/chat/thread-state.js");
      const state = createThreadFixture(options.step || "welcome", "general");
      const voiceFactory = ({ getDraft, onDraft, onState }) => {
        let before = "";
        return {
          supported: true,
          start() {
            before = getDraft();
            onState({ status: "listening" });
          },
          stop() {
            onDraft([before, "Quero poucos passos."].filter(Boolean).join(" "));
            onState({ status: "idle" });
          },
          cancel() {
            onState({ status: "idle" });
          },
          destroy() {},
          handleTypedInput() {},
        };
      };
      window.qa = mountExperience(document.querySelector("#qa-host"), {
        state,
        liveApi: options.live || false,
        ...(options.voice
          ? {
              voiceFactory,
              getSaveStatus: () => "Voz demonstrativa · nenhum áudio capturado",
            }
          : {}),
      });
    }, options);
    await page.getByRole("log").waitFor();
  };
  try {
    // Actual page adapter: storage and alternative remain browser-local.
    await page.goto(base + "/chat");
    await page
      .locator(".sx-mode")
      .filter({ hasText: "Demonstração" })
      .waitFor({ state: "attached" });
    await page.getByRole("textbox", { name: "Sua mensagem" }).fill(complete);
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await capture("review");
    await page.locator('[data-action="confirm"]').last().click();
    await page.locator(".sx-routine").last().waitFor();
    await page.locator('[data-action="compare"]').last().click();
    await capture("comparison");
    await page.locator('[data-action="alternative"]:visible').last().click();
    await page
      .locator('[data-action="new-alternative"][data-choice="budget"]')
      .click();
    await expect(page.locator(".sx-branch-banner")).toContainText(
      "Gastar menos",
    );
    await expect(
      page.getByRole("textbox", { name: "Sua mensagem" }),
    ).toHaveValue(/mais econômica/);
    await expect
      .poll(() => page.locator('[data-action="session"]').count())
      .toBe(2);
    await page
      .getByRole("textbox", { name: "Sua mensagem" })
      .fill("Meu orçamento agora é até R$ 50.");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByRole("log")).toContainText("R$ 50");
    await page.locator('[data-action="parent-session"]').click();
    await expect(page.locator(".sx-branch-banner")).toHaveCount(0);
    await expect(page.getByRole("log")).not.toContainText(
      "Meu orçamento agora é até R$ 50.",
    );
    await saved();
    await page.reload();
    await expect
      .poll(() => page.locator('[data-action="session"]').count())
      .toBe(2);
    if (viewport === "mobile") {
      await page
        .getByRole("button", { name: "Conversas salvas", exact: true })
        .click();
      await capture("mobile-history");
      await page
        .locator('[data-action="close-history"]')
        .click({ position: { x: size.width - 12, y: 40 } });
    } else await capture("history");
    record(
      "Alternative preserves original and both conversations survive reload",
    );

    await page.locator('[data-action="verify"]').click();
    await expect(page.getByRole("dialog")).toContainText(
      "Confira o que foi entendido",
    );
    await page.locator('[data-action="sources-panel"]').click();
    await expect(page.getByRole("dialog")).toContainText(
      "não têm fórmula ou estudos validados",
    );
    await capture("source");
    const sourcesAxe = await new AxeBuilder({ page })
      .include(".sx-dialog")
      .analyze();
    assert.deepEqual(
      sourcesAxe.violations.map((item) => item.id),
      [],
    );
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await page
      .getByRole("button", { name: "Seu contexto", exact: true })
      .click();
    await page.locator(".sx-origin summary").last().click();
    await expect(page.locator(".sx-origin[open]")).toContainText(
      "Interpretado da sua mensagem",
    );
    await capture("context");
    await page.locator('[data-action="note"]').last().click();
    await expect(page.locator(".sx-note-text").last()).toContainText(
      "não é diagnóstico",
    );
    await capture("notes");
    record(
      "Context has actual message provenance, inspectable sources and revisable note",
    );

    await page.locator('[data-action="feedback"]').last().click();
    await expect(page.getByRole("dialog")).toContainText(
      "não é enviada à equipe",
    );
    await capture("feedback");
    await page
      .getByRole("button", { name: "Fonte insuficiente", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Anotado nesta conversa",
    );
    await capture("feedback-receipt");
    const feedbackAxe = await new AxeBuilder({ page })
      .include(".sx-dialog")
      .analyze();
    assert.deepEqual(
      feedbackAxe.violations.map((item) => item.id),
      [],
    );
    await page.screenshot({
      path: resolve(output, `${viewport}-feedback.png`),
    });
    await page.getByRole("button", { name: "Fechar painel" }).click();
    await saved();
    await page.reload();
    await expect(page.getByRole("log")).toContainText(
      "Feedback salvo nesta conversa",
    );
    record(
      "Feedback has a local receipt and persists without claiming training",
    );

    await page.locator('[data-action="privacy"]:visible').last().click();
    await capture("privacy");
    await page.locator("[data-photo]").setInputFiles({
      name: "foto-demonstrativa.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+VhA0AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.locator("[data-photo-consent]").waitFor();
    await capture(
      "photo-consent",
      "synthetic one-pixel attachment; consent not granted",
    );
    const beforeVoice = requests.length;
    await mount({ voice: true });
    await page
      .getByRole("textbox", { name: "Sua mensagem" })
      .fill("Meu texto antes do ditado.");
    await page.getByRole("button", { name: "Ditar mensagem" }).click();
    await page.getByRole("button", { name: "Ativar microfone" }).click();
    await expect(page.locator("[data-voice-status]")).toContainText(
      "Revise antes de enviar",
    );
    await expect(
      page.getByRole("button", { name: "Enviar mensagem" }),
    ).toBeDisabled();
    await capture(
      "voice",
      "deterministic voice fixture; no microphone or audio transmission",
    );
    await page.getByRole("button", { name: "Concluir ditado" }).click();
    await expect(
      page.getByRole("textbox", { name: "Sua mensagem" }),
    ).toHaveValue("Meu texto antes do ditado. Quero poucos passos.");
    assert.equal(await page.locator('[data-role="user"]').count(), 0);
    assert.equal(requests.length, beforeVoice);
    await page.screenshot({
      path: resolve(output, `${viewport}-voice-review.png`),
    });
    record(
      "Demonstration voice preserves draft, requires review and never auto-sends",
    );

    live = true;
    hold = true;
    await mount({ live: true, step: "routine" });
    await page
      .locator(".sx-mode")
      .filter({ hasText: "Com OpenAI" })
      .waitFor({ state: "attached" });
    const userCount = await page.locator('[data-role="user"]').count();
    await page
      .getByRole("textbox", { name: "Sua mensagem" })
      .fill("Quero rever os motivos desta opção.");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect.poll(() => held.length).toBe(1);
    await capture(
      "working",
      "controlled pending API response; no provider request",
    );
    await page
      .getByRole("textbox", { name: "Sua mensagem" })
      .fill("Meu próximo rascunho permanece aqui.");
    await page
      .getByRole("button", { name: "Parar resposta", exact: true })
      .click();
    await expect(page.locator("[data-error]")).toContainText("interrompida");
    await expect(
      page.getByRole("textbox", { name: "Sua mensagem" }),
    ).toHaveValue("Meu próximo rascunho permanece aqui.");
    await capture(
      "stopped",
      "controlled interrupted API response; no provider request",
    );
    hold = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByRole("log")).toContainText(response.text);
    assert.equal(
      await page.locator('[data-role="user"]').count(),
      userCount + 1,
    );
    for (const route of held.splice(0))
      await route.fulfill({ json: response }).catch(() => {});
    record(
      "Stop and retry preserve draft/history without duplicating the request",
    );

    hold = true;
    await page
      .getByRole("textbox", { name: "Sua mensagem" })
      .fill("Pode continuar a explicação?");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect.poll(() => held.length).toBe(1);
    await page.evaluate(
      () =>
        new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(done)),
        ),
    );
    await page.locator(".sx-scroll").evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    await held.shift().fulfill({
      json: {
        ...response,
        text: "Nova resposta controlada, mantendo sua leitura anterior.",
      },
    });
    await expect(page.locator('[data-action="latest"]')).toBeVisible();
    assert.ok(
      await page
        .locator(".sx-scroll")
        .evaluate((element) => element.scrollTop < 20),
    );
    await page.locator('[data-action="latest"]').click();
    await expect(page.locator('[data-action="latest"]')).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false);
    record(
      "New response preserves reading position and offers an explicit return",
      { mobileOverflow: overflow },
    );
    assert.deepEqual(errors, []);
  } catch (error) {
    report.errors.push({ viewport, message: error.message, runtime: errors });
    await page
      .screenshot({ path: resolve(output, `${viewport}-failure.png`) })
      .catch(() => {});
  } finally {
    await context.close();
  }
}
await browser.close();
await writeFile(
  resolve(implementation, "capture-manifest.json"),
  JSON.stringify(captures, null, 2),
);
await writeFile(
  resolve(output, "report.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    { passed: report.checks.length, errors: report.errors },
    null,
    2,
  ),
);
if (report.errors.length) process.exitCode = 1;
