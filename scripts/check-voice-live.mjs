/** Opt-in PAID smoke test of the deployed UI and real OpenAI WebRTC transport.
 * Uses an OS-generated synthetic WAV as Chromium's fake microphone. It NEVER
 * requests a physical device, prints a token, records a person or sends chat.
 * node scripts/check-voice-live.mjs --base=https://... --execute-paid
 * --prepare-only creates the local audio fixture without browser/API calls.
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const prepareOnly = process.argv.includes("--prepare-only");
if (!prepareOnly && !process.argv.includes("--execute-paid"))
  throw new Error(
    "Use --execute-paid only after authorizing a real transcription request, or --prepare-only.",
  );
const base = new URL(
  arg("base") || "https://skinboost-design-review.vercel.app",
);
if (!prepareOnly && base.protocol !== "https:")
  throw new Error("The live test requires an HTTPS deployment.");
const output = path.join(root, "qa", "voice-live");
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(
  path.join(os.tmpdir(), "skinboost-synthetic-voice-"),
);
const aiff = path.join(temporary, "synthetic.aiff"),
  wav = path.join(temporary, "synthetic.wav");
const sample =
  "Olá, este é um teste de voz totalmente sintético. Quero conhecer uma rotina cosmética para minha pele. Prefiro poucos passos e gostaria de organizar minhas escolhas com calma. Não uso nenhum produto neste momento. Meu orçamento é de cem reais. Quero revisar o texto antes de enviar a mensagem. Estou apenas testando a transcrição, sem solicitar diagnóstico ou resultado de tratamento.";
const report = {
  base: base.origin,
  startedAt: new Date().toISOString(),
  audio: "25-second locally synthesized pt-BR WAV; fake Chromium microphone",
  paid: !prepareOnly,
  checks: [],
  network: [],
  pageErrorCount: 0,
};
const check = (name, passed, details = {}) =>
  report.checks.push({ name, passed: !!passed, ...details });
let browser;
try {
  execFileSync(
    "/usr/bin/say",
    ["-v", "Eddy (Portuguese (Brazil))", "-r", "165", "-o", aiff, sample],
    { stdio: "ignore" },
  );
  execFileSync(
    "/opt/homebrew/bin/ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      aiff,
      "-af",
      "apad",
      "-t",
      "25",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wav,
    ],
    { stdio: "ignore" },
  );
  check(
    "synthetic WAV created without microphone capture or provider request",
    existsSync(wav),
  );
  if (!prepareOnly) {
    const launch = {
      headless: true,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${wav}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    };
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
      launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    else if (
      !existsSync(chromium.executablePath()) &&
      existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    )
      launch.channel = "chrome";
    browser = await chromium.launch(launch);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["microphone"],
      reducedMotion: "reduce",
    });
    // Guard against auto-send accidentally causing additional paid calls.
    let blockedActions = 0;
    await context.route("**/api/chat", (route) => {
      blockedActions++;
      return route.abort();
    });
    await context.route("**/api/simulate", (route) => {
      blockedActions++;
      return route.abort();
    });
    await context.addInitScript(() => {
      window.__voiceAudit = { updates: [], tracks: [] };
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (...args) => {
        const stream = await original(...args);
        window.__voiceAudit.tracks.push(...stream.getTracks());
        return stream;
      };
      let previous = "";
      setInterval(() => {
        const value = document.querySelector("#sx-message")?.value || "";
        if (value !== previous) {
          previous = value;
          window.__voiceAudit.updates.push({
            time: performance.now(),
            chars: value.length,
            listening: (
              document.querySelector("[data-voice-status]")?.textContent || ""
            ).includes("Ouvindo e transcrevendo"),
          });
        }
      }, 50);
    });
    const page = await context.newPage();
    page.on("pageerror", () => report.pageErrorCount++);
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (
        ["/api/status", "/api/voice-session", "/v1/realtime/calls"].includes(
          url.pathname,
        )
      )
        report.network.push({ path: url.pathname, status: response.status() });
    });
    await page.goto(new URL("/chat", base).href, { waitUntil: "networkidle" });
    await page.waitForSelector("#sx-message", { state: "visible" });
    await page.locator('[data-action="voice"]').waitFor({ state: "visible" });
    await page.waitForFunction(
      () => !document.querySelector('[data-action="voice"]')?.disabled,
    );
    const prefix = "Rascunho digitado antes da voz:";
    await page.locator("#sx-message").fill(prefix);
    const messagesBefore = await page
      .locator(".sx-thread [data-message-id]")
      .count();
    await page.locator('[data-action="voice"]').click();
    await page.locator('[data-action="voice-start"]').click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-voice-status]")
          ?.textContent.includes("Ouvindo e transcrevendo"),
      null,
      { timeout: 40_000 },
    );
    await page.waitForFunction(
      (prefix) =>
        document.querySelector("#sx-message")?.value.length >
          prefix.length + 4 &&
        document
          .querySelector("[data-voice-status]")
          ?.textContent.includes("Ouvindo e transcrevendo"),
      prefix,
      { timeout: 24_000 },
    );
    const during = await page.locator("#sx-message").inputValue();
    check(
      "real transcript appears while listening, before any stop/commit click",
      during.length > prefix.length + 4,
    );
    check(
      "existing typed draft survives progressive transcription",
      during.startsWith(prefix),
    );
    check(
      "send is disabled while recording",
      await page.locator(".sx-send").isDisabled(),
    );
    await page.screenshot({ path: path.join(output, "during-listening.png") });
    // The model controls chunk latency. Allow time for a second real update
    // without manufacturing a character-by-character presentation in the test.
    await page
      .waitForFunction(
        () =>
          window.__voiceAudit.updates.filter((value) => value.listening)
            .length >= 2,
        null,
        { timeout: 12_000 },
      )
      .catch(() => {});
    await page.locator('[data-action="voice-stop"]').click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-action="voice"]')
          ?.getAttribute("aria-pressed") === "false",
      null,
      { timeout: 12_000 },
    );
    const final = await page.locator("#sx-message").inputValue();
    const audit = await page.evaluate(() => ({
      updates: window.__voiceAudit.updates,
      trackCount: window.__voiceAudit.tracks.length,
      stopped: window.__voiceAudit.tracks.every(
        (track) => track.readyState === "ended",
      ),
    }));
    check(
      "multiple draft updates arrive while listening",
      audit.updates.filter((value) => value.listening).length >= 2,
      {
        progressiveUpdates: audit.updates.filter((value) => value.listening)
          .length,
      },
    );
    check(
      "final transcript remains editable in the draft",
      final.startsWith(prefix) &&
        final.length > prefix.length + 4 &&
        (await page.locator("#sx-message").isEditable()),
      { finalCharacters: final.length },
    );
    check(
      "all fake capture tracks are stopped",
      audit.trackCount > 0 && audit.stopped,
    );
    check(
      "dictation does not submit a message or call chat/image",
      blockedActions === 0 &&
        (await page.locator(".sx-thread [data-message-id]").count()) ===
          messagesBefore,
      { blockedActions },
    );
    await page.waitForTimeout(700);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(
      (expected) => document.querySelector("#sx-message")?.value === expected,
      final,
      { timeout: 10_000 },
    );
    check(
      "reload restores the saved transcribed draft",
      (await page.locator("#sx-message").inputValue()) === final,
    );
    check(
      "reload does not reactivate the microphone",
      await page.evaluate(() => window.__voiceAudit.tracks.length === 0),
    );
    await page.screenshot({ path: path.join(output, "restored-draft.png") });
    check("no browser errors", report.pageErrorCount === 0);
  }
} catch (error) {
  // Preserve only safe error classification; Playwright traces can contain
  // network/DOM details, so no raw error, token, transcript or trace is logged.
  report.failure = {
    name: error?.name || "Error",
    phase: report.checks.at(-1)?.name || "prepare",
  };
  check("live voice flow completed", false);
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: report.checks.filter((value) => value.passed).length,
      failed: report.checks.filter((value) => !value.passed).length,
      report: "qa/voice-live/report.json",
      network: report.network,
    }),
  );
  if (report.checks.some((value) => !value.passed)) process.exitCode = 1;
}
