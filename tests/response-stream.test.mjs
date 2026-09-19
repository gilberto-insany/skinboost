import test from "node:test";
import assert from "node:assert/strict";
import { readChatResponse } from "../src/chat/response-stream.js";
const complete = {
  text: "Sua intenção",
  choices: [],
  context: {},
  ready: false,
  care: false,
};
function response(raw) {
  const bytes = new TextEncoder().encode(raw);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
test("real deltas survive byte boundaries and only a complete event releases context", async () => {
  const deltas = [];
  const result = await readChatResponse(
    response(
      `data: {"type":"delta","text":"Sua intenção"}\r\n\r\ndata: ${JSON.stringify({ type: "complete", result: complete })}\n\n`,
    ),
    { onDelta: (text) => deltas.push(text) },
  );
  assert.deepEqual(deltas, ["Sua intenção"]);
  assert.deepEqual(result, complete);
});
test("truncated streams remain incomplete and errors preserve the server explanation", async () => {
  await assert.rejects(
    readChatResponse(response('data: {"type":"delta","text":"Parcial"}\n\n')),
    /antes da resposta completa/,
  );
  await assert.rejects(
    readChatResponse(
      response(
        'data: {"type":"error","error":{"message":"Tente novamente"}}\n\n',
      ),
    ),
    /Tente novamente/,
  );
});
test("JSON remains supported for local mocked and older servers", async () => {
  assert.deepEqual(await readChatResponse(Response.json(complete)), complete);
  await assert.rejects(
    readChatResponse(
      Response.json({ error: { message: "Sem conexão" } }, { status: 503 }),
    ),
    /Sem conexão/,
  );
});
