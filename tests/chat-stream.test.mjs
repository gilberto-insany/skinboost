import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  createTextFieldDecoder,
  consumeResponseStream,
} from "../server/chat-stream.mjs";
import {
  createOpenAIService,
  handleNodeRequest,
  CONTEXT_KEYS,
} from "../server/openai-api.mjs";

const encode = new TextEncoder();
const patch = () => Object.fromEntries(CONTEXT_KEYS.map((key) => [key, null]));
const result = (extra = {}) => ({
  text: 'Olá! "Texto" com ação, /, \\ e 😊.\nContinuo.',
  choices: [],
  context: patch(),
  ready: false,
  care: false,
  ...extra,
});
const output = (value) => ({
  status: "completed",
  output: [
    {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: JSON.stringify(value) }],
    },
  ],
});
const frame = (event) =>
  `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`;
const delta = (value, sequence_number = 1) => ({
  type: "response.output_text.delta",
  delta: value,
  sequence_number,
  item_id: "one",
  output_index: 0,
  content_index: 0,
});
const complete = (value, sequence_number = 1000) => ({
  type: "response.completed",
  response: output(value),
  sequence_number,
});
const streamed = (value, size = 7) => {
  const raw = JSON.stringify(value);
  const frames = [
    frame({ type: "response.created", sequence_number: 0 }),
    ...Array.from({ length: Math.ceil(raw.length / size) }, (_, i) =>
      frame(delta(raw.slice(i * size, (i + 1) * size), i + 1)),
    ),
    frame(complete(value)),
  ].join("");
  const bytes = encode.encode(frames);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += size)
          controller.enqueue(bytes.slice(i, i + size));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
};
const request = (
  body = {
    messages: [{ role: "user", text: "Quero conhecer o catálogo" }],
    context: {},
  },
) =>
  Object.assign(new EventEmitter(), {
    method: "POST",
    headers: {
      host: "localhost:4173",
      origin: "http://localhost:4173",
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body,
    socket: { remoteAddress: "127.0.0.1" },
  });
class Sink extends EventEmitter {
  headers = {};
  chunks = [];
  writableEnded = false;
  destroyed = false;
  setHeader(name, value) {
    this.headers[name] = value;
  }
  flushHeaders() {
    this.flushed = true;
  }
  write(value) {
    this.chunks.push(value);
    return true;
  }
  end(value) {
    if (value) this.chunks.push(value);
    this.writableEnded = true;
  }
  get events() {
    return this.chunks
      .join("")
      .split("\n\n")
      .filter(Boolean)
      .map((value) => JSON.parse(value.replace(/^data: /, "")));
  }
}
const env = { NODE_ENV: "test", OPENAI_API_KEY: "mock-no-real-credential" };

test("incremental JSON decoding handles every boundary, escapes and split surrogate pairs without metadata", () => {
  const value = result();
  const raw = JSON.stringify(value).replace("😊", "\\ud83d\\ude0a");
  for (let size = 1; size <= raw.length; size++) {
    const parser = createTextFieldDecoder();
    let text = "";
    for (let i = 0; i < raw.length; i += size)
      text += parser.push(raw.slice(i, i + size));
    assert.equal(text, value.text);
    assert.equal(parser.text, value.text);
  }
});
test("only a first top-level text string streams; nested and quoted text keys never leak", () => {
  for (const value of [
    '{"context":{"text":"private"},"text":"final"}',
    '{"choices":[{"label":"text","value":"hidden"}],"text":"final"}',
  ]) {
    const parser = createTextFieldDecoder();
    assert.equal(parser.push(value), "");
  }
  assert.throws(() => createTextFieldDecoder().push('{"text":"bad\\q'));
  assert.throws(() =>
    createTextFieldDecoder().push('{"text":"' + "a".repeat(3201)),
  );
});
test("provider SSE tolerates UTF-8, CRLF, event and JSON boundaries and returns full final output", async () => {
  const value = result();
  let text = "";
  const data = await consumeResponseStream(streamed(value, 1), {
    onText: (delta) => {
      text += delta;
    },
  });
  assert.equal(text, value.text);
  assert.deepEqual(data, output(value));
});
test("duplicate semantic event sequence numbers are not repeated", async () => {
  const value = result({ text: "Olá" });
  const text = [];
  const d = delta('{"text":"Olá', 1);
  const response = new Response(
    frame(d) + frame(d) + frame(delta('"}', 2)) + frame(complete(value)),
  );
  await consumeResponseStream(response, {
    onText: (value) => text.push(value),
  });
  assert.equal(text.join(""), "Olá");
});
test("streaming keeps strict schema/store=false and emits only text while final context is validated", async () => {
  const value = result();
  const events = [];
  let body;
  const service = createOpenAIService({
    env,
    fetchImpl: async (_, init) => {
      body = JSON.parse(init.body);
      return streamed(value);
    },
  });
  const response = await service("chat", request(), {
    onEvent: (event) => events.push(event),
  });
  assert.equal(body.stream, true);
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.equal(response.status, 200);
  assert.equal(response.body.text, value.text);
  assert.equal(
    events.every(
      (event) =>
        event.type === "delta" && Object.keys(event).join(",") === "type,text",
    ),
    true,
  );
  assert.equal(events.map((event) => event.text).join(""), value.text);
});
test("SSE is optional: default JSON remains compatible even when Accept is set without a streaming consumer", async () => {
  let body;
  const service = createOpenAIService({
    env,
    fetchImpl: async (_, init) => {
      body = JSON.parse(init.body);
      return Response.json(output(result()));
    },
  });
  const response = await service("chat", request());
  assert.equal(response.status, 200);
  assert.equal(body.stream, undefined);
});
test("Node handler flushes a real delta before provider completion and emits validated complete once", async () => {
  const value = result({ text: "Olá, você." });
  let upstream, markDelta;
  const emitted = new Promise((resolve) => {
    markDelta = resolve;
  });
  const service = createOpenAIService({
    env,
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            upstream = controller;
            controller.enqueue(encode.encode(frame(delta('{"text":"Olá,'))));
          },
        }),
      ),
  });
  const sink = new Sink();
  const originalWrite = sink.write.bind(sink);
  sink.write = (text) => {
    const result = originalWrite(text);
    markDelta();
    return result;
  };
  const work = handleNodeRequest("chat", request(), sink, service);
  await emitted;
  assert.equal(sink.flushed, true);
  assert.equal(sink.writableEnded, false);
  assert.deepEqual(sink.events, [{ type: "delta", text: "Olá," }]);
  upstream.enqueue(
    encode.encode(frame(delta(' você."}', 2)) + frame(complete(value))),
  );
  upstream.close();
  await work;
  assert.equal(sink.events.at(-1).type, "complete");
  assert.equal(sink.events.at(-1).result.text, value.text);
  assert.equal(
    sink.headers["Content-Type"],
    "text/event-stream; charset=utf-8",
  );
  assert.match(sink.headers["Cache-Control"], /no-store/);
});
test("invalid final schema never exposes complete/metadata, even after valid initial text", async () => {
  const service = createOpenAIService({
    env,
    fetchImpl: async () =>
      streamed(result({ context: { private: "DO_NOT_FORWARD" } })),
  });
  const sink = new Sink();
  await handleNodeRequest("chat", request(), sink, service);
  assert.equal(sink.events.at(-1).type, "error");
  assert.equal(sink.events.at(-1).error.code, "invalid_provider_response");
  assert.equal(
    sink.events.some((event) => event.type === "complete"),
    false,
  );
  assert.equal(sink.chunks.join("").includes("DO_NOT_FORWARD"), false);
});
test("truncated streams, provider error events and incomplete outcomes produce sanitized failures", async () => {
  for (const suffix of [
    "",
    frame({ type: "error", message: "PRIVATE_PROVIDER_DETAIL" }),
    frame({ type: "response.incomplete", response: { status: "incomplete" } }),
  ]) {
    const service = createOpenAIService({
      env,
      fetchImpl: async () =>
        new Response(frame(delta('{"text":"Olá')) + suffix),
    });
    const sink = new Sink();
    await handleNodeRequest("chat", request(), sink, service);
    assert.equal(sink.events.at(-1).type, "error");
    assert.equal(
      sink.events.some((event) => event.type === "complete"),
      false,
    );
    assert.equal(
      sink.chunks.join("").includes("PRIVATE_PROVIDER_DETAIL"),
      false,
    );
  }
});
test("preflight validation failures return normal JSON and never contact the provider", async () => {
  let calls = 0;
  const service = createOpenAIService({
    env,
    fetchImpl: async () => {
      calls++;
    },
  });
  const sink = new Sink();
  await handleNodeRequest("chat", request({ messages: [] }), sink, service);
  assert.equal(calls, 0);
  assert.equal(sink.statusCode, 400);
  assert.match(sink.headers["Content-Type"], /application\/json/);
});
test("closing the browser stream aborts provider fetch, cancels its body and never completes stale UI", async () => {
  let signal,
    cancelled = false,
    started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const service = createOpenAIService({
    env,
    fetchImpl: async (_, init) => {
      signal = init.signal;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encode.encode(frame(delta('{"text":"Olá'))));
          },
          cancel() {
            cancelled = true;
          },
        }),
      );
    },
  });
  const sink = new Sink();
  const write = sink.write.bind(sink);
  sink.write = (value) => {
    const result = write(value);
    started();
    return result;
  };
  const work = handleNodeRequest("chat", request(), sink, service);
  await ready;
  sink.destroyed = true;
  sink.emit("close");
  await work;
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
  assert.equal(
    sink.events.some((event) => event.type === "complete"),
    false,
  );
});
test("a stalled provider stream respects the overall deadline and cancels the reader", async () => {
  let cancelled = false;
  const service = createOpenAIService({
    env,
    timeouts: { chat: 5 },
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
  });
  const response = await service("chat", request(), { onEvent() {} });
  assert.equal(response.status, 504);
  assert.equal(response.body.error.code, "timeout");
  assert.equal(cancelled, true);
});
