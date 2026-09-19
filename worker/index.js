// Sites serves the same frontend as GitHub. Its existing Node/Sharp AI backend
// remains on Vercel; secrets and provider calls stay in that backend.
const BACKEND = "https://skinboost-design-review.vercel.app";
const SITE_ORIGIN = "https://skinboost-wireframe.insany.chatgpt.site";
const ROUTES = new Set([
  "/api/status",
  "/api/chat",
  "/api/simulate",
  "/api/voice-session",
]);
const MAX_BYTES = 3 * 1024 * 1024;
const error = (status, code, message) =>
  Response.json(
    { error: { code, message } },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );

async function boundedBody(request) {
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    throw new RangeError();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}

export function createSitesWorker(fetchBackend = fetch) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        if (!ROUTES.has(url.pathname))
          return error(404, "not_found", "Não encontrado.");
        const status = url.pathname === "/api/status";
        if (request.method !== (status ? "GET" : "POST"))
          return error(405, "method_not_allowed", "Método não permitido.");
        if (
          !status &&
          (url.origin !== SITE_ORIGIN ||
            request.headers.get("origin") !== SITE_ORIGIN)
        )
          return error(
            403,
            "origin_not_allowed",
            "Esta solicitação precisa partir do site SkinBoost.",
          );
        if (
          !status &&
          !request.headers
            .get("content-type")
            ?.toLowerCase()
            .startsWith("application/json")
        )
          return error(
            415,
            "invalid_content_type",
            "Envie a solicitação em JSON.",
          );
        try {
          const body = status ? undefined : await boundedBody(request);
          // Recreate only these headers. Never forward cookies, user credentials,
          // client-supplied forwarding headers, or Sites authorization tokens.
          const headers = new Headers({
            accept: request.headers.get("accept") || "application/json",
          });
          if (!status) {
            headers.set("content-type", "application/json");
            headers.set("origin", BACKEND);
          }
          const upstream = await fetchBackend(
            new Request(BACKEND + url.pathname, {
              method: request.method,
              headers,
              body,
              redirect: "manual",
              signal: request.signal,
            }),
          );
          if (upstream.status >= 300 && upstream.status < 400) {
            await upstream.body?.cancel();
            return error(
              502,
              "backend_unavailable",
              "A conexão com a IA está indisponível. Tente novamente.",
            );
          }
          const responseHeaders = new Headers({
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          for (const name of ["content-type", "retry-after"]) {
            const value = upstream.headers.get(name);
            if (value) responseHeaders.set(name, value);
          }
          // SSE and images pass through without buffering or logging user content.
          return new Response(upstream.body, {
            status: upstream.status,
            headers: responseHeaders,
          });
        } catch (cause) {
          return cause instanceof RangeError
            ? error(
                413,
                "body_too_large",
                "O arquivo excede o tamanho permitido.",
              )
            : error(
                502,
                "backend_unavailable",
                "Não foi possível conectar à IA. Tente novamente.",
              );
        }
      }
      const response = await env.ASSETS.fetch(request);
      const acceptsHtml = request.headers.get("accept")?.includes("text/html");
      if (
        response.status !== 404 ||
        !acceptsHtml ||
        !["GET", "HEAD"].includes(request.method)
      )
        return response;
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/index.html";
      indexUrl.search = "";
      return env.ASSETS.fetch(new Request(indexUrl, request));
    },
  };
}
export default createSitesWorker();
