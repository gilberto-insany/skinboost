/** Continuous-chat E2E. Run: node scripts/check-experience.mjs --base=http://127.0.0.1:4173
 * --only=context,flow,editing,uploads,keyboard,routing --viewport=desktop|mobile
 * Uses synthetic text/images; outputs stay in ignored qa/experience/.
 */
import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) =>
  process.argv.find((x) => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const baseURL =
  arg("base") || process.env.SKINBOOST_QA_URL || "http://127.0.0.1:4173";
const output = path.join(root, "qa", "experience");
await mkdir(output, { recursive: true });
const report = {
  baseURL,
  startedAt: new Date().toISOString(),
  apiMode: "forced local demonstration; paid endpoints blocked",
  cases: [],
  checks: [],
  errors: [],
  writeRequests: [],
  resourceErrors: [],
  screenshots: [],
};
const launch = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
else if (
  !existsSync(chromium.executablePath()) &&
  existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
)
  launch.channel = "chrome";
const browser = await chromium.launch(launch);
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+VhA0AAAAASUVORK5CYII=",
  "base64",
);
const completePrompt =
  "Quero uma rotina de hidratação: percebo repuxamento há 3 meses. Quero explorar possibilidades e uma rotina completa. Não uso nenhum produto. Não tenho sensibilidade nem alergias. Meu orçamento é até R$ 250.";
let page, viewport, context;
function check(name, passed, details = {}) {
  report.checks.push({ viewport, name, passed: !!passed, ...details });
  if (!passed)
    console.log(`FAIL [${viewport}] ${name}`, JSON.stringify(details));
  return !!passed;
}
const shell = () => page.locator(".composer-shell");
const thread = () => page.locator(".sx-thread");
const rows = () => thread().locator("[data-message-id]");
const composer = () => page.locator('[data-form="message"]');
const action = (name) => shell().locator(`[data-action="${name}"]`).last();
const ids = () =>
  rows().evaluateAll((elements) => elements.map((el) => el.dataset.messageId));
async function frame() {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function screenshot(name) {
  const file = `${viewport}-${name}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: false });
  report.screenshots.push(file);
}
async function isolatedContext() {
  await context?.close();
  // Fresh non-persistent context guarantees an empty IndexedDB/localStorage per scenario.
  // Reload/back/forward within a scenario retain that same context for persistence checks.
  context = await browser.newContext({
    viewport: viewports[viewport],
    reducedMotion: "reduce",
  });
  await context.route("**/api/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: false,
        chatAvailable: false,
        simulationAvailable: false,
        photoUploadMaxBytes: 2097152,
      }),
    }),
  );
  await context.route(/\/api\/(chat|simulate)(?:\?|$)/, (route) =>
    route.abort("blockedbyclient"),
  );
  page = await context.newPage();
  page.setDefaultTimeout(6500);
  page.on("pageerror", (e) =>
    report.errors.push({ viewport, message: e.message }),
  );
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
      report.writeRequests.push({
        viewport,
        method: request.method(),
        origin: new URL(request.url()).origin,
        path: new URL(request.url()).pathname,
      });
  });
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      new URL(response.url()).origin === new URL(baseURL).origin
    )
      report.resourceErrors.push({
        viewport,
        status: response.status(),
        path: new URL(response.url()).pathname,
      });
  });
}
async function fresh(message = "") {
  await isolatedContext();
  await page.goto(baseURL, { waitUntil: "networkidle" });
  if (message) {
    await page.locator("#skin-prompt").fill(message);
    await page.locator('#prompt-form button[type="submit"]').click();
  } else
    await page.goto(new URL("/chat", baseURL).href, {
      waitUntil: "networkidle",
    });
  await shell().waitFor({ state: "visible" });
  await page.locator("#sx-message").waitFor();
  await page.waitForURL((url) => url.pathname === "/chat");
  await page.waitForFunction(
    () =>
      document.querySelector(".sx-send") &&
      !document.querySelector(".sx-send").disabled,
  );
  if (message)
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".sx-thread [data-message-id]").length >= 3,
    );
  await frame();
}
async function assertHistory(before, label, { append = true } = {}) {
  const after = await ids();
  check(
    `${label}: existing message ids remain in order`,
    before.every((id, i) => after[i] === id),
    { before, after },
  );
  if (append)
    check(
      `${label}: response appended to the same thread`,
      after.length > before.length,
      { before: before.length, after: after.length },
    );
  check(
    `${label}: composer remains available`,
    (await composer().isVisible()) &&
      !(await page.locator("#sx-message").isDisabled()),
  );
  check(
    `${label}: remains on chat route`,
    new URL(page.url()).pathname === "/chat",
  );
}
async function send(text, { keyboard = false, label = "Send" } = {}) {
  const before = await ids();
  await page.locator("#sx-message").fill(text);
  if (keyboard) await page.locator("#sx-message").press("Enter");
  else await composer().locator('button[type="submit"]').click();
  await page.waitForFunction(
    (n) => document.querySelectorAll(".sx-thread [data-message-id]").length > n,
    before.length,
  );
  await frame();
  await assertHistory(before, label);
  check(
    `${label}: sent text appears in history`,
    (await thread().innerText()).includes(text),
  );
  return before;
}
async function doAction(name, label = name) {
  const before = await ids();
  await action(name).click();
  await frame();
  await assertHistory(before, label);
  return before;
}
async function fillMissing() {
  let turns = 0;
  while (
    !(await action("confirm").count()) &&
    !(await thread().locator(".sx-product").count()) &&
    turns < 8
  ) {
    const buttons = thread().locator("[data-reply]:not([disabled])");
    const entries = await buttons.evaluateAll((es) =>
      es.map((e) => ({ label: e.textContent.trim(), value: e.dataset.reply })),
    );
    const lastText = (await rows().last().innerText()).toLowerCase();
    let reply;
    if (/orçamento|limite|gastar|valor/.test(lastText)) reply = "Até R$ 250";
    else if (/sensibil|restri|alerg|respeitar/.test(lastText))
      reply = "Nenhuma restrição conhecida";
    else if (
      /já usa|já faz|produto.*atual|rotina atual|já tem|já utiliza/.test(
        lastText,
      )
    )
      reply = "Não uso nenhum produto";
    else if (/ritmo|passos|cabe no|encaix|prefere|simplificar/.test(lastText))
      reply = "Quero conhecer a linha completa";
    else if (/há quanto|tempo|percebe isso/.test(lastText))
      reply = "Há alguns meses";
    else if (/repux|ressec/.test(lastText)) reply = "Sensação de repuxamento";
    else if (/cravos|espinhas/.test(lastText)) reply = "Mais cravos";
    else reply = "Quero hidratação e conforto";
    const preference = entries.find((e) =>
      /250|linha completa|explorar possibilidades|nenhuma restrição|nenhum produto|estou começando|quero mais conforto|há alguns meses|sensação de repuxamento|mais cravos/i.test(
        e.label + " " + e.value,
      ),
    );
    const before = await ids();
    if (preference) {
      await buttons.filter({ hasText: preference.label }).last().click();
      await frame();
      await assertHistory(before, `Suggestion ${turns + 1}`);
      check(
        "One-click suggestion adds user and assistant turn",
        (await ids()).length >= before.length + 2,
      );
    } else await send(reply, { label: `Clarification ${turns + 1}` });
    turns++;
  }
  return turns;
}
async function buildPlan() {
  await fresh(completePrompt);
  await fillMissing();
  if (await action("confirm").count())
    await doAction("confirm", "Confirm context");
  await thread().locator(".sx-product").first().waitFor();
  await frame();
}
async function layout(stage, { bottom = false } = {}) {
  if (bottom)
    await thread().evaluate((el) => {
      let node = el;
      while (node && node !== document.body) {
        if (node.scrollHeight > node.clientHeight + 2)
          node.scrollTop = node.scrollHeight;
        node = node.parentElement;
      }
    });
  await frame();
  const metrics = await shell().evaluate((el) => {
    const form = el.querySelector('[data-form="message"]'),
      input = el.querySelector("#sx-message"),
      messages = el.querySelectorAll(".sx-thread [data-message-id]");
    const last = messages[messages.length - 1]?.getBoundingClientRect(),
      f = form?.getBoundingClientRect(),
      t = input?.getBoundingClientRect();
    const horizontal = [...el.querySelectorAll("button,input,textarea,table")]
      .filter((n) => {
        const r = n.getBoundingClientRect();
        return (
          r.width > 2 &&
          r.height > 2 &&
          (r.left < -2 || r.right > innerWidth + 2)
        );
      })
      .map((n) => ({
        tag: n.tagName,
        label:
          n.getAttribute("aria-label") || n.textContent?.trim().slice(0, 80),
      }));
    return {
      shellOverflow: el.scrollWidth > el.clientWidth + 2,
      horizontal,
      form: f
        ? { top: f.top, bottom: f.bottom, left: f.left, right: f.right }
        : null,
      input: t ? { top: t.top, bottom: t.bottom } : null,
      last: last ? { top: last.top, bottom: last.bottom } : null,
      viewportHeight: innerHeight,
    };
  });
  check(
    `${stage}: no horizontal overflow`,
    !metrics.shellOverflow && !metrics.horizontal.length,
    metrics,
  );
  check(
    `${stage}: composer input remains in viewport`,
    metrics.input &&
      metrics.input.top >= 0 &&
      metrics.input.bottom <= metrics.viewportHeight + 2,
    metrics,
  );
  if (bottom)
    check(
      `${stage}: last message clears composer at scroll end`,
      metrics.last &&
        metrics.form &&
        metrics.last.bottom <= metrics.form.top + 3,
      metrics,
    );
}
async function runCase(name, fn) {
  if (arg("only") && !arg("only").split(",").includes(name)) return;
  const start = report.checks.length;
  try {
    await fn();
    report.cases.push({
      viewport,
      name,
      completed: true,
      checks: report.checks.length - start,
    });
  } catch (error) {
    report.cases.push({
      viewport,
      name,
      completed: false,
      error: error.message,
    });
    check(`${name}: journey completed`, false, { error: error.message });
    await screenshot(`${name}-failure`).catch(() => {});
  }
}

for (const [name, size] of Object.entries(viewports)) {
  if (arg("viewport") && arg("viewport") !== name) continue;
  viewport = name;
  await runCase("context", async () => {
    const cases = [
      ["acne", "Estou com acne e quero entender melhor a minha rotina."],
      ["oiliness", "Minha pele fica muito oleosa ao longo do dia."],
      ["general", "Quero começar a cuidar da minha pele."],
    ];
    const responses = {};
    for (const [key, prompt] of cases) {
      await fresh(prompt);
      const all = await rows().allTextContents();
      responses[key] = (
        await rows()
          .filter({ has: page.locator(".sx-avatar") })
          .allTextContents()
      )
        .slice(1)
        .join("\n");
      check(
        `${key}: initial user request stays visible`,
        all.join("\n").includes(prompt),
      );
      check(
        `${key}: conversation accepts typed follow-up`,
        (await composer().isVisible()) &&
          !(await page.locator("#sx-message").isDisabled()),
      );
      check(`${key}: contextual assistant responds`, !!responses[key].trim());
      await layout(key, { bottom: true });
      await screenshot(`context-${key}`);
    }
    check(
      "Acne and oiliness receive different first responses",
      responses.acne !== responses.oiliness,
      { responses },
    );
    check(
      "Oiliness and generic intent receive different first responses",
      responses.oiliness !== responses.general,
      { responses },
    );
    check(
      "Acne discussion is not replaced by blocking care page",
      !/Essa dúvida merece\s*um profissional/.test(responses.acne),
    );
    const baselineTurns = await fillMissing();
    await fresh(completePrompt);
    const turns = await fillMissing();
    check(
      "Multiple declared facts reduce follow-up questions",
      turns < baselineTurns,
      { turns, baselineTurns },
    );
    await screenshot("context-multiple-facts");
  });
  await runCase("flow", async () => {
    await buildPlan();
    await layout("routine", { bottom: true });
    await screenshot("01-routine");
    const initial = await ids();
    check(
      "Routine arrives inside message history",
      (await thread().locator(".sx-product").count()) > 0,
    );
    await doAction("source", "Inspect source");
    check(
      "Source makes missing evidence inspectable",
      /falta|não validado|conceitual|não é evidência|não comprova/i.test(
        await rows().last().innerText(),
      ),
    );
    await layout("source", { bottom: true });
    await screenshot("02-source");
    await doAction("compare", "Compare values");
    check(
      "Comparison appends a table or an accessible bar chart",
      (await thread().locator("table, .sx-bars[role=img]").count()) > 0,
    );
    check(
      "Comparison labels fictional values",
      /fictíci/.test(await rows().last().innerText()),
    );
    await layout("comparison", { bottom: true });
    await screenshot("03-comparison");
    await doAction("cart", "Review cart");
    const boxes = thread().locator("[data-cart-item]");
    check("Cart provides item controls", (await boxes.count()) > 0);
    for (let i = 0; i < (await boxes.count()); i++)
      await boxes.nth(i).uncheck();
    check(
      "Empty cart disables checkout",
      await action("checkout").isDisabled(),
    );
    const comfort = thread().locator('[data-cart-item][value="comfort"]');
    await ((await comfort.count()) ? comfort : boxes.first()).check();
    await layout("cart", { bottom: true });
    await screenshot("04-cart");
    await doAction("checkout", "Checkout demonstration");
    check(
      "Checkout remains explicitly demonstrative",
      /sem pagamento|sem cobrança|fictício|simulação|demonstrativo/i.test(
        await rows().last().innerText(),
      ),
    );
    check(
      "Checkout does not request payment credentials",
      !(await thread().locator('input[autocomplete^="cc-"]').count()),
    );
    await layout("checkout", { bottom: true });
    await screenshot("05-checkout");
    if (await action("finish").count())
      await doAction("finish", "Save selection");
    await doAction("checkin", "Check-in");
    await layout("checkin", { bottom: true });
    await screenshot("06-checkin");
    const checkinForm = thread().locator('[data-form="checkin"]').last();
    if (await checkinForm.count()) {
      const radio = checkinForm.locator('input[name="status"]');
      await radio.first().check();
      if (await checkinForm.locator("textarea").count())
        await checkinForm
          .locator("textarea")
          .fill("Exemplo QA: rotina simples.");
      const before = await ids();
      await checkinForm.locator('button[type="submit"]').click();
      await frame();
      await assertHistory(before, "Save check-in");
    } else
      await send("Consegui manter minha rotina.", {
        label: "Check-in response",
      });
    await assertHistory(initial, "Entire commerce journey", { append: true });
    await screenshot("07-final-history");
  });
  await runCase("editing", async () => {
    await buildPlan();
    const draft = "Uma pergunta que estou escrevendo antes de editar.";
    await page.locator("#sx-message").fill(draft);
    const before = await ids();
    const edit = shell()
      .locator('[data-action="edit"][data-key="budget"]')
      .last();
    await edit.click();
    await frame();
    await assertHistory(before, "Start inline budget edit", { append: false });
    check(
      "Inline edit preserves composer draft",
      (await page.locator("#sx-message").inputValue()) === draft,
    );
    const field = shell()
      .locator('[data-form="edit"] input, [data-form="edit"] textarea')
      .last();
    if (await field.count()) {
      await field.fill("0");
      const history = await ids();
      await shell()
        .locator('[data-form="edit"] button[type="submit"]')
        .last()
        .click();
      await frame();
      await assertHistory(history, "Save inline edit");
      check(
        "Saving inline edit retains unsent draft",
        (await page.locator("#sx-message").inputValue()) === draft,
      );
    } else
      await send("Meu orçamento agora é R$ 0.", { label: "Budget correction" });
    check(
      "Changing budget keeps other context in history",
      /hidratação/.test(await thread().innerText()) &&
        /250/.test(await thread().innerText()),
    );
    const currentReview = thread().locator(".sx-context-card").last();
    check(
      "Budget correction is visible in the current review",
      /R\$\s*0(?:[,.]00)?/.test(await currentReview.innerText()),
    );
    check(
      "Other current fields survive correction",
      /repuxamento/.test(await currentReview.innerText()) &&
        /Nenhum produto/.test(await currentReview.innerText()),
    );
    await doAction("confirm", "Confirm zero budget");
    const latestRoutine = thread().locator(".sx-routine").last();
    check(
      "Zero budget does not recommend buying a product",
      (await latestRoutine.locator(".sx-product").count()) === 0,
    );
    check(
      "Zero budget gives zero demonstrative cost",
      /R\$\s*0,00/.test(await latestRoutine.innerText()),
    );
    await layout("edit", { bottom: true });
    await screenshot("inline-edit");
  });
  await runCase("uploads", async () => {
    await fresh();
    const draft = "Rascunho antes do anexo.";
    await page.locator("#sx-message").fill(draft);
    await composer()
      .locator("[data-photo]")
      .setInputFiles({
        name: "invalid.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("synthetic"),
      });
    check(
      "Unsupported file is rejected",
      /JPG|PNG|WebP/.test(await shell().innerText()),
    );
    check(
      "Invalid upload preserves unsent draft",
      (await page.locator("#sx-message").inputValue()) === draft,
    );
    await composer().locator("[data-photo]").setInputFiles({
      name: "qa-pixel.png",
      mimeType: "image/png",
      buffer: png,
    });
    await composer().locator(".sx-file").waitFor();
    check(
      "Valid filename is visible in composer",
      /qa-pixel.png/.test(await composer().innerText()),
    );
    check(
      "Valid upload preserves unsent draft",
      (await page.locator("#sx-message").inputValue()) === draft,
    );
    check(
      "Successful attachment clears stale upload error",
      !(await shell().locator('[role="alert"]:visible').count()),
    );
    await screenshot("upload-valid");
    await composer().locator('[data-action="remove-photo"]').click();
    check(
      "Remove clears current attachment",
      !/qa-pixel.png/.test(await composer().innerText()),
    );
    check(
      "Remove preserves draft",
      (await page.locator("#sx-message").inputValue()) === draft,
    );
    await layout("upload", { bottom: false });
  });
  await runCase("keyboard", async () => {
    await fresh();
    const before = await ids();
    await page.locator("#sx-message").fill("Minha rotina");
    await page.locator("#sx-message").press("Shift+Enter");
    await page.locator("#sx-message").press("End");
    await page.locator("#sx-message").type("tem poucos passos.");
    check(
      "Shift+Enter inserts a newline without sending",
      (await page.locator("#sx-message").inputValue()).includes("\n") &&
        (await ids()).length === before.length,
    );
    if (viewport === "desktop") {
      await send("Minha pele fica oleosa.", {
        keyboard: true,
        label: "Desktop Enter",
      });
      check(
        "Send returns focus to persistent composer",
        await page.evaluate(() => document.activeElement?.id === "sx-message"),
      );
    }
    const draft = "Rascunho a retomar.";
    await page.locator("#sx-message").fill(draft);
    const history = await ids();
    await page.keyboard.press("Escape");
    await page.waitForURL((url) => url.pathname !== "/chat");
    check("Escape returns to landing", !(await shell().isVisible()));
    await page.locator("#resume-experience").click();
    await page.waitForURL((url) => url.pathname === "/chat");
    check(
      "Resume restores unsent composer draft",
      (await page.locator("#sx-message").inputValue()) === draft,
    );
    await assertHistory(history, "Resume", { append: false });
  });
  await runCase("routing", async () => {
    await fresh("Minha pele fica oleosa.");
    const before = await ids();
    await page.goBack();
    check("Browser Back returns to site", new URL(page.url()).pathname === "/");
    await page.goForward();
    await shell().waitFor({ state: "visible" });
    await assertHistory(before, "Browser Forward", { append: false });
    await page.waitForTimeout(850);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#sx-message").waitFor();
    check(
      "Reload restores saved conversation",
      (await thread().innerText()).includes("Minha pele fica oleosa."),
    );
    await page.keyboard.press("Escape");
    await page.waitForURL((url) => url.pathname === "/");
    await screenshot("back-to-preserved-landing");
  });
  await context?.close();
  context = null;
}
await browser.close();
report.finishedAt = new Date().toISOString();
report.summary = {
  passed: report.checks.filter((c) => c.passed).length,
  failed: report.checks.filter((c) => !c.passed).length,
  runtimeErrors: report.errors.length,
  writeRequests: report.writeRequests.length,
  resourceErrors: report.resourceErrors.length,
};
await writeFile(
  path.join(output, "report.json"),
  JSON.stringify(report, null, 2),
);
await writeFile(
  path.join(output, "report.md"),
  [
    "# Continuous chat QA",
    `\nRun: ${report.startedAt}\nURL: ${baseURL}`,
    `\n${JSON.stringify(report.summary)}`,
    "\n## Failed checks",
    ...report.checks
      .filter((c) => !c.passed)
      .map((c) => `- **${c.viewport}: ${c.name}** ${JSON.stringify(c)}`),
    "\n## Executed journeys",
    ...report.cases.map(
      (c) =>
        `- ${c.viewport} / ${c.name}: ${c.completed ? "completed" : c.error}`,
    ),
  ].join("\n"),
);
console.log(JSON.stringify(report.summary, null, 2));
if (
  report.summary.failed ||
  report.summary.runtimeErrors ||
  report.summary.writeRequests ||
  report.summary.resourceErrors
)
  process.exitCode = 1;
