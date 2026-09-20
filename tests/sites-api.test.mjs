import assert from "node:assert/strict";
import test from "node:test";
import { createSitesWorker } from "../worker/index.js";
const origin = "https://skinboost.insany.chatgpt.site";
const request = (headers = {}, body = "{}") =>
  new Request(origin + "/api/chat", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body,
  });
test("gateway rejects foreign origins, unsupported routes and oversized bodies before forwarding", async () => {
  let calls = 0;
  const worker = createSitesWorker(() => {
    calls++;
    throw Error("must not fetch");
  });
  for (const [req, expected] of [
    [request({ origin: "https://other.test" }), 403],
    [request({ origin: "null" }), 403],
    [request({ "content-type": "text/plain" }), 415],
    [request({}, "x".repeat(3 * 1024 * 1024 + 1)), 413],
    [new Request(origin + "/api/anything"), 404],
    [new Request(origin + "/api/chat"), 405],
  ])
    assert.equal((await worker.fetch(req, {})).status, expected);
  assert.equal(calls, 0);
});
test("gateway preserves SSE, strips credentials and pins destination without following redirects", async () => {
  let sent;
  const worker = createSitesWorker(async (req) => {
    sent = req;
    return new Response("data: hello\n\n", {
      headers: {
        "content-type": "text/event-stream",
        "set-cookie": "secret=x",
      },
    });
  });
  const res = await worker.fetch(
    request({
      cookie: "session=x",
      authorization: "Bearer secret",
      "oai-sites-authorization": "private",
      accept: "text/event-stream",
      "x-forwarded-for": "spoof",
    }),
    {},
  );
  assert.equal(sent.url, "https://skinboost-design-review.vercel.app/api/chat");
  assert.equal(sent.redirect, "manual");
  assert.equal(
    sent.headers.get("origin"),
    "https://skinboost-design-review.vercel.app",
  );
  for (const header of [
    "cookie",
    "authorization",
    "oai-sites-authorization",
    "x-forwarded-for",
  ])
    assert.equal(sent.headers.get(header), null);
  assert.equal(await sent.text(), "{}");
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  assert.equal(res.headers.get("set-cookie"), null);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(await res.text(), "data: hello\n\n");
});
test("gateway propagates rate-limit feedback and sanitizes network failures and redirects", async () => {
  const limited = createSitesWorker(
    async () =>
      new Response("{}", { status: 429, headers: { "retry-after": "30" } }),
  );
  const response = await limited.fetch(request(), {});
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  for (const upstream of [
    () => Promise.reject(Error("sensitive")),
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://elsewhere.test" },
      }),
  ]) {
    const response = await createSitesWorker(upstream).fetch(request(), {});
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes("sensitive"));
  }
});

test("slug migration accepts each exact same-origin Site and rejects crossed aliases", async () => {
  let calls = 0;
  const worker = createSitesWorker(async () => {
    calls++;
    return Response.json({ ok: true });
  });
  const previous = "https://skinboost-wireframe.insany.chatgpt.site";
  for (const site of [origin, previous]) {
    const response = await worker.fetch(
      new Request(site + "/api/chat", {
        method: "POST",
        headers: { origin: site, "content-type": "application/json" },
        body: "{}",
      }),
      {},
    );
    assert.equal(response.status, 200);
  }
  assert.equal(
    (await worker.fetch(request({ origin: previous }), {})).status,
    403,
  );
  assert.equal(calls, 2);
});
