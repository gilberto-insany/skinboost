import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Explicit opt-in: this script can incur API charges. It never reads an API key.
// Use only after the deployment has been authorized and is ready.
// node scripts/check-openai-live.mjs --base https://skinboost-design-review.vercel.app --execute-paid [--image]
const args = process.argv.slice(2);
const baseFlag = args.indexOf("--base");
if (!args.includes("--execute-paid") || baseFlag < 0 || !args[baseFlag + 1]) {
  console.error(
    "Provide --base and --execute-paid to run the authorized live smoke test. Add --image for one consented synthetic-portrait edit.",
  );
  process.exit(2);
}
const base = new URL(args[baseFlag + 1]);
const local = ["localhost", "127.0.0.1"].includes(base.hostname);
if (
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash ||
  (!local && base.protocol !== "https:")
)
  throw new Error(
    "Use a clean HTTPS deployment origin, or a local development origin.",
  );
const directory = resolve("qa/openai-live");
await mkdir(directory, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  origin: base.origin,
  syntheticDataOnly: true,
  imageRequested: args.includes("--image"),
  checks: [],
  requests: [],
};
const check = (label, ok) => report.checks.push({ label, ok: !!ok });
const request = async (path, body) => {
  const start = Date.now();
  try {
    const response = await fetch(new URL(path, base), {
      method: body ? "POST" : "GET",
      headers: {
        Origin: base.origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(path.endsWith("simulate") ? 210_000 : 50_000),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    // No user text, provider text, keys, photos, or data URLs are written to the report.
    report.requests.push({
      path,
      status: response.status,
      elapsedMs: Date.now() - start,
      json: !!data,
      code: /^[a-z_]{1,64}$/.test(data?.error?.code || "")
        ? data.error.code
        : undefined,
      cacheControl: response.headers.get("cache-control"),
    });
    return { status: response.status, data };
  } catch (error) {
    report.requests.push({
      path,
      status: null,
      elapsedMs: Date.now() - start,
      error:
        error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "timeout"
          : "network_error",
    });
    return { status: null, data: null };
  }
};
const usable = (result) =>
  result.status === 200 &&
  typeof result.data?.text === "string" &&
  result.data.text.trim() &&
  Array.isArray(result.data.choices) &&
  result.data.context &&
  typeof result.data.ready === "boolean" &&
  typeof result.data.care === "boolean";
try {
  const status = await request("/api/status");
  check(
    "OpenAI chat configured",
    status.status === 200 && status.data?.chatAvailable === true,
  );
  check(
    "Status is uncached",
    /no-store/.test(report.requests.at(-1).cacheControl || ""),
  );
  if (status.status !== 200 || !status.data?.chatAvailable)
    throw new Error("service_not_ready");
  const prompt =
    "Quero tratar minha acne. Tenho cravos e pequenas espinhas na testa há 3 meses. Quero poucos passos, não uso nenhum produto e não conheço nenhuma alergia ou restrição. Posso gastar até R$ 250. Podemos revisar o que você entendeu?";
  const messages = [{ role: "user", text: prompt }];
  const first = await request("/api/chat", {
    messages,
    context: {},
    photoConsent: false,
  });
  check("Multifact request returns structured chat response", usable(first));
  if (usable(first)) {
    check(
      "Acne treatment wording does not block the educational conversation",
      first.data.care === false,
    );
    check(
      "Multifact request extracts acne scenario",
      first.data.context.scenario === "acne",
    );
    check("Multifact request reaches review", first.data.ready === true);
    check("Explicit duration is extracted", !!first.data.context.duration);
    check(
      "Explicit budget is extracted",
      /250/.test(first.data.context.budget || ""),
    );
    messages.push(
      { role: "assistant", text: first.data.text },
      {
        role: "user",
        text: "Na verdade, meu orçamento agora é R$ 0. Mantenha o resto do contexto e me ajude a começar sem comprar nada.",
      },
    );
    const correction = await request("/api/chat", {
      messages,
      context: first.data.context,
      photoConsent: false,
    });
    check(
      "Free-form correction returns structured response",
      usable(correction),
    );
    if (usable(correction)) {
      const merged = { ...first.data.context, ...correction.data.context };
      check(
        "Zero budget is retained as a valid choice",
        /(?:\b0(?:[,.]00)?\b|zero|nada)/i.test(merged.budget || "") &&
          !/250/.test(merged.budget || ""),
      );
      check(
        "Correction preserves declared concern",
        merged.scenario === "acne" && !!merged.detail && !!merged.duration,
      );
      check(
        "Correction remains ready and educational",
        correction.data.ready === true && correction.data.care === false,
      );
    }
  }
  if (args.includes("--image")) {
    const html = await readFile(resolve("index.html"), "utf8");
    if (
      !html.includes("/media/persona-lucas.jpg") ||
      !/RETRATO GERADO POR IA/.test(html)
    )
      throw new Error("synthetic_portrait_attribution_missing");
    const bytes = await readFile(resolve("public/media/persona-lucas.jpg"));
    if (
      bytes.length > 2 * 1024 * 1024 ||
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[2] !== 255
    )
      throw new Error("synthetic_portrait_invalid");
    const simulated = await request("/api/simulate", {
      consent: true,
      photoDataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
      concern:
        "Retrato fictício gerado por IA para teste autorizado. Crie uma variação estética sutil da textura superficial, preservando a identidade, sem representar efeito de tratamento ou produto.",
    });
    const image = simulated.data?.imageDataUrl;
    check(
      "Consented synthetic portrait produces a JPEG illustration",
      simulated.status === 200 &&
        typeof image === "string" &&
        /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image),
    );
    check(
      "Illustration response carries disclosure",
      simulated.data?.kind === "illustration" &&
        /IA/.test(simulated.data?.label || "") &&
        /Não é previsão clínica/.test(simulated.data?.disclaimer || ""),
    );
    if (
      typeof image === "string" &&
      image.startsWith("data:image/jpeg;base64,")
    ) {
      report.image = {
        kind: simulated.data.kind,
        label: simulated.data.label,
        decodedBytes: Buffer.from(image.split(",")[1], "base64").length,
      };
      // Deliberately do not log or save the face or generated image.
    }
  }
} catch (error) {
  check(
    [
      "service_not_ready",
      "synthetic_portrait_attribution_missing",
      "synthetic_portrait_invalid",
    ].includes(error?.message)
      ? error.message
      : "smoke_test_interrupted",
    false,
  );
} finally {
  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.filter((item) => item.ok).length;
  report.failed = report.checks.filter((item) => !item.ok).length;
  await writeFile(
    resolve(directory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        failed: report.failed,
        requests: report.requests.map(({ path, status, code, elapsedMs }) => ({
          path,
          status,
          code,
          elapsedMs,
        })),
        report: "qa/openai-live/report.json",
      },
      null,
      2,
    ),
  );
  process.exitCode = report.failed ? 1 : 0;
}
