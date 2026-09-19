/** Decodes only the first, top-level `text` field of the strict chat schema.
 * Metadata is never emitted until the complete response passes validation.
 * https://developers.openai.com/api/docs/guides/streaming-responses
 */
export function createTextFieldDecoder() {
  let raw = "",
    emitted = "",
    closed = false;
  return {
    push(chunk) {
      if (typeof chunk !== "string") throw new Error("invalid_delta");
      if (closed) return "";
      raw += chunk;
      if (raw.length > 128_000) throw new Error("stream_too_large");
      const prefix = raw.match(/^\s*\{\s*"text"\s*:\s*"/);
      // If a provider changes field order, safely fall back to the validated
      // final response. Never search for nested or quoted occurrences of text.
      if (!prefix) return "";
      const start = prefix[0].length;
      let end = start;
      for (let i = start; i < raw.length;) {
        const character = raw[i];
        if (character === '"') {
          closed = true;
          break;
        }
        if (character === "\\") {
          if (i + 1 >= raw.length) break;
          if (raw[i + 1] === "u") {
            if (i + 6 > raw.length) break;
            if (!/^[a-fA-F0-9]{4}$/.test(raw.slice(i + 2, i + 6)))
              throw new Error("invalid_escape");
            i += 6;
          } else {
            if (!'"\\/bfnrt'.includes(raw[i + 1]))
              throw new Error("invalid_escape");
            i += 2;
          }
        } else {
          if (character.charCodeAt(0) < 32) throw new Error("invalid_control");
          i++;
        }
        end = i;
      }
      let decoded = JSON.parse(`"${raw.slice(start, end)}"`);
      // Wait for the second half of a split Unicode surrogate pair.
      if (/[\uD800-\uDBFF]$/.test(decoded) && !closed)
        decoded = decoded.slice(0, -1);
      if (decoded.length > 3200 || !decoded.startsWith(emitted))
        throw new Error("invalid_text");
      const delta = decoded.slice(emitted.length);
      emitted = decoded;
      return delta;
    },
    get text() {
      return emitted;
    },
  };
}

/** Consume OpenAI semantic SSE events. Network chunks may divide UTF-8, SSE
 * lines, escaped JSON characters or final metadata anywhere. */
export async function consumeResponseStream(response, { onText, signal } = {}) {
  if (!response.body?.getReader) throw new Error("missing_stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const field = createTextFieldDecoder();
  let buffer = "",
    bytes = 0,
    completed = null,
    lastSequence = -1,
    itemKey = null;
  const aborted = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", aborted, { once: true });
  function frame(value) {
    const data = value
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data || data === "[DONE]") return;
    const event = JSON.parse(data);
    if (typeof event.sequence_number === "number") {
      if (event.sequence_number <= lastSequence) return;
      lastSequence = event.sequence_number;
    }
    if (event.type === "response.output_text.delta") {
      const key = `${event.item_id || ""}:${event.output_index || 0}:${event.content_index || 0}`;
      if (itemKey !== null && itemKey !== key)
        throw new Error("multiple_text_items");
      itemKey = key;
      const text = field.push(event.delta);
      if (text) onText?.(text);
    } else if (event.type === "response.completed") completed = event.response;
    else if (
      ["error", "response.failed", "response.incomplete"].includes(event.type)
    )
      throw new Error("incomplete_stream");
  }
  try {
    while (!completed) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_000_000) throw new Error("stream_too_large");
      buffer += decoder.decode(value, { stream: true });
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const value = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        frame(value);
        if (completed) break;
      }
      if (buffer.length > 256_000) throw new Error("frame_too_large");
    }
    if (!completed) throw new Error("incomplete_stream");
    return completed;
  } finally {
    signal?.removeEventListener("abort", aborted);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
