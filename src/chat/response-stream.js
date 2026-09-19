/** Read real server deltas; never fabricate a typing animation or parse partial context. */
export async function readChatResponse(response, { onDelta = () => {} } = {}) {
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error?.message || "Não foi possível receber a resposta.",
      );
    return result;
  }
  if (!response.ok || !response.body)
    throw new Error("Não foi possível abrir a resposta. Tente novamente.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    result,
    length = 0;
  const consume = (frame) => {
    const raw = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!raw) return;
    const event = JSON.parse(raw);
    if (event.type === "error")
      throw new Error(
        event.error?.message || "A resposta foi interrompida. Tente novamente.",
      );
    if (event.type === "delta" && typeof event.text === "string")
      onDelta(event.text);
    if (event.type === "complete") result = event.result;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024 * 1024)
        throw new Error(
          "A resposta ficou maior do que o esperado. Tente um pedido menor.",
        );
      buffer += decoder.decode(value, { stream: true });
      let split;
      while ((split = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const delimiter = buffer.slice(split).match(/^\r?\n\r?\n/)[0];
        consume(buffer.slice(0, split));
        buffer = buffer.slice(split + delimiter.length);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (
      !result ||
      typeof result.text !== "string" ||
      !Array.isArray(result.choices) ||
      typeof result.ready !== "boolean" ||
      typeof result.care !== "boolean"
    )
      throw new Error(
        "A conexão terminou antes da resposta completa. Seu pedido foi preservado; tente novamente.",
      );
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
