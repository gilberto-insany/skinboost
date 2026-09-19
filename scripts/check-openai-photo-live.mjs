/** Opt-in PAID smoke test. Exactly one photo chat and one image edit, no retries.
 * Only the project's attributed synthetic portrait is used. No API key is read.
 * node scripts/check-openai-photo-live.mjs --execute-paid
 * Optional: --base=https://skinboost-design-review.vercel.app
 * Run only after the parent has confirmed the deployment is ready.
 */
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SKINBOOST_SOURCES,
  PRODUCT_IDS,
  PRODUCT_LIMITATION,
} from "../server/skinboost-grounding.mjs";

const args = process.argv.slice(2);
const expectedOrigin = "https://skinboost-design-review.vercel.app";
const baseArg =
  args.find((value) => value.startsWith("--base="))?.slice(7) ||
  (args.includes("--base") ? args[args.indexOf("--base") + 1] : expectedOrigin);
if (!args.includes("--execute-paid")) {
  console.error(
    "This test makes two paid API calls. Add --execute-paid only after deployment approval.",
  );
  process.exit(2);
}
let base;
try {
  base = new URL(baseArg);
} catch {
  console.error("Use the approved production origin.");
  process.exit(2);
}
if (
  base.origin !== expectedOrigin ||
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash
) {
  console.error(
    `Only ${expectedOrigin} is permitted; no credentials, path or query.`,
  );
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "qa", "openai-photo-live");
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const registry = new Map(
  SKINBOOST_SOURCES.map((source) => [source.id, source]),
);
const report = {
  startedAt: new Date().toISOString(),
  origin: base.origin,
  syntheticDataOnly: true,
  paidCallBudget: 2,
  checks: [],
  requests: [],
  contentReviewRequired: true,
};
const check = (label, ok, details = {}) =>
  report.checks.push({ label, ok: !!ok, ...details });
const save = (name, data) =>
  writeFile(
    path.join(directory, name),
    typeof data === "string" || Buffer.isBuffer(data)
      ? data
      : JSON.stringify(data, null, 2) + "\n",
    { mode: 0o600 },
  );
const canonicalSources = (sources) =>
  Array.isArray(sources) &&
  sources.length > 0 &&
  sources.every((source) => {
    const expected = registry.get(source.id);
    return (
      expected &&
      source.title === expected.title &&
      source.page === expected.page &&
      source.url === expected.url &&
      source.kind === expected.kind
    );
  });
const cited = new Set();
async function post(route, body, timeout) {
  const start = Date.now();
  try {
    const response = await fetch(new URL(route, base), {
      method: "POST",
      headers: {
        Origin: base.origin,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    const raw = await response.text();
    let data = null;
    if (raw.length <= 8_000_000) {
      try {
        data = JSON.parse(raw);
      } catch {}
    }
    report.requests.push({
      route,
      status: response.status,
      elapsedMs: Date.now() - start,
      json: !!data,
      cacheControl: response.headers.get("cache-control"),
      errorCode: /^[a-z_]{1,64}$/.test(data?.error?.code || "")
        ? data.error.code
        : null,
    });
    if (Array.isArray(data?.sources))
      for (const source of data.sources)
        if (registry.has(source.id)) cited.add(source.id);
    return { status: response.status, data };
  } catch (error) {
    report.requests.push({
      route,
      status: null,
      elapsedMs: Date.now() - start,
      errorCode: ["TimeoutError", "AbortError"].includes(error?.name)
        ? "timeout"
        : "network_error",
    });
    return { status: null, data: null };
  }
}
try {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  if (
    !html.includes("/media/persona-lucas.jpg") ||
    !/RETRATO GERADO POR IA/.test(html)
  )
    throw new Error("synthetic_attribution_missing");
  const portrait = await readFile(
    path.join(root, "public/media/persona-lucas.jpg"),
  );
  if (
    portrait.length > 2 * 1024 * 1024 ||
    portrait[0] !== 255 ||
    portrait[1] !== 216 ||
    portrait[2] !== 255
  )
    throw new Error("synthetic_portrait_invalid");
  const photoDataUrl = `data:image/jpeg;base64,${portrait.toString("base64")}`;
  const chat = await post(
    "/api/chat",
    {
      messages: [
        {
          role: "user",
          text: "Observe a aparência desta foto autorizada, com uma descrição do que está visível e dos limites da imagem, sem diagnóstico. Quero poucos passos e custo claro. Relacione Cleanse, Balance e Comfort ao papel ilustrativo de cada um no protótipo, usando as fontes do PDF e explicando o que ainda não está documentado. Não espero previsão de resultado.",
        },
      ],
      context: { approach: "Poucos passos" },
      photoDataUrl,
      photoConsent: true,
      analyzePhoto: true,
    },
    65_000,
  );
  await save(
    "chat-response.json",
    chat.data || { error: { code: "unreadable_response" } },
  );
  const photo = chat.data?.photoAnalysis;
  check(
    "explicit photo request returns the revised structured contract",
    chat.status === 200 &&
      typeof chat.data?.text === "string" &&
      Array.isArray(chat.data?.choices) &&
      typeof chat.data?.ready === "boolean" &&
      typeof chat.data?.care === "boolean",
  );
  check(
    "vision produces observations or an honest image limitation",
    ["observed", "limited"].includes(photo?.status) &&
      typeof photo?.summary === "string" &&
      photo.summary.length > 0 &&
      Array.isArray(photo?.limitations) &&
      photo.limitations.length > 0 &&
      (photo.status === "limited" || photo.observations?.length > 0),
    {
      status: photo?.status || null,
      observationCount: photo?.observations?.length || 0,
      limitationCount: photo?.limitations?.length || 0,
    },
  );
  check(
    "photo references use canonical document pages and URLs",
    canonicalSources(chat.data?.sources) &&
      chat.data.sources.some((source) => source.id === "skinboost-p6"),
    { sourceIds: chat.data?.sources?.map((source) => source.id) || [] },
  );
  const matches = chat.data?.productMatches;
  check(
    "product explanations are grounded and carry the document limitation",
    Array.isArray(matches) &&
      matches.length > 0 &&
      matches.every(
        (match) =>
          PRODUCT_IDS.includes(match.productId) &&
          typeof match.reason === "string" &&
          match.reason.length > 0 &&
          match.limitation === PRODUCT_LIMITATION &&
          match.sourceIds?.includes("skinboost-p13"),
      ),
    {
      productIds: Array.isArray(matches)
        ? matches.map((match) => match.productId)
        : [],
    },
  );
  check(
    "the synthetic cosmetic request does not become a clinical care result",
    chat.data?.care === false,
  );
  console.log(
    JSON.stringify({
      phase: "chat",
      status: chat.status,
      analysisStatus: photo?.status || null,
      products: matches?.length || 0,
      sources: chat.data?.sources?.length || 0,
    }),
  );
  if (chat.status === 429) throw new Error("quota_stopped_no_retry");

  const simulation = await post(
    "/api/simulate",
    {
      photoDataUrl,
      consent: true,
      concern:
        "Retrato fictício gerado por IA para teste autorizado. Crie uma variação cosmética conceitual e sutil da aparência superficial, preservando identidade, traços, textura real, cabelo, roupa, luz, fundo e enquadramento. Não represente efeito de produto, diagnóstico, cura ou prazo de melhora.",
    },
    230_000,
  );
  const { imageDataUrl, ...metadata } = simulation.data || {};
  const match =
    typeof imageDataUrl === "string" &&
    imageDataUrl.match(
      /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/,
    );
  let image = null,
    filename = null,
    dimensions = null;
  if (match && match[2].length % 4 === 0 && match[2].length < 8_000_000) {
    const bytes = Buffer.from(match[2], "base64");
    const signature =
      match[1] === "jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (
      signature &&
      bytes.length > 1024 &&
      bytes.toString("base64") === match[2]
    ) {
      image = bytes;
      filename = match[1] === "jpeg" ? "simulation.jpg" : "simulation.png";
      await save(filename, bytes);
      if (existsSync("/opt/homebrew/bin/ffprobe")) {
        try {
          const decoded = JSON.parse(
            execFileSync(
              "/opt/homebrew/bin/ffprobe",
              [
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=codec_name,width,height",
                "-of",
                "json",
                path.join(directory, filename),
              ],
              { stdio: ["ignore", "pipe", "ignore"] },
            ).toString(),
          ).streams?.[0];
          if (
            ["mjpeg", "png"].includes(decoded?.codec_name) &&
            decoded.width > 0 &&
            decoded.height > 0
          )
            dimensions = { width: decoded.width, height: decoded.height };
        } catch {}
      }
    }
  }
  await save("simulation-response.json", { ...metadata, imageFile: filename });
  check(
    "simulation returns a valid, decodable JPEG or PNG",
    simulation.status === 200 && image && dimensions,
    { decodedBytes: image?.length || 0, dimensions },
  );
  check(
    "comparison labels distinguish input photo from generated illustration",
    metadata.kind === "illustration" &&
      metadata.originalLabel === "Foto enviada" &&
      metadata.generatedLabel === "Simulação ilustrativa" &&
      /não é previsão/i.test(metadata.comparisonLabel || "") &&
      /Não é previsão clínica/.test(metadata.disclaimer || ""),
  );
  check(
    "simulation policy points to the original page26 excerpt",
    canonicalSources(metadata.sources) &&
      metadata.sources.some((source) => source.id === "skinboost-p26"),
  );
  console.log(
    JSON.stringify({
      phase: "simulate",
      status: simulation.status,
      imageBytes: image?.length || 0,
      dimensions,
    }),
  );
  if (simulation.status === 429) throw new Error("quota_stopped_no_retry");

  // Static evidence requests do not call OpenAI or increase the paid budget.
  for (const id of cited) {
    const source = registry.get(id);
    const start = Date.now();
    try {
      const response = await fetch(new URL(source.url, base), {
        method: "HEAD",
        headers: { Origin: base.origin },
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
      report.requests.push({
        route: source.url,
        method: "HEAD",
        status: response.status,
        elapsedMs: Date.now() - start,
      });
      check(
        `cited excerpt ${id} is available`,
        response.ok &&
          /application\/pdf/.test(response.headers.get("content-type") || ""),
      );
    } catch {
      check(`cited excerpt ${id} is available`, false);
    }
  }
} catch (error) {
  const allowed = [
    "synthetic_attribution_missing",
    "synthetic_portrait_invalid",
    "quota_stopped_no_retry",
  ];
  report.failure = allowed.includes(error?.message)
    ? error.message
    : "smoke_interrupted";
  check(report.failure, false);
} finally {
  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.filter((item) => item.ok).length;
  report.failed = report.checks.filter((item) => !item.ok).length;
  report.paidCalls = report.requests.filter((item) =>
    ["/api/chat", "/api/simulate"].includes(item.route),
  ).length;
  await save("report.json", report);
  // The response text, image and base64 stay in ignored local files. No request
  // body, authentication header, token or raw error appears in stdout.
  console.log(
    JSON.stringify({
      passed: report.passed,
      failed: report.failed,
      paidCalls: report.paidCalls,
      requests: report.requests.map(
        ({ route, status, errorCode, elapsedMs }) => ({
          route,
          status,
          errorCode,
          elapsedMs,
        }),
      ),
      report: "qa/openai-photo-live/report.json",
    }),
  );
  process.exitCode = report.failed ? 1 : 0;
}
