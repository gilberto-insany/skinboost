import test from "node:test";
import assert from "node:assert/strict";
import {
  photoResponseFields,
  photoRequestIntent,
  renderPhotoEvidence,
  renderPhotoComparison,
} from "../src/chat/photo-experience.js";
import {
  acceptAssistantResponse,
  createThreadState,
} from "../src/chat/thread-state.js";
import { serializeSession, restoreSession } from "../src/chat/session-store.js";
import {
  PHOTO_CHAT_RESPONSE,
  LIMITED_PHOTO_CHAT_RESPONSE,
} from "./fixtures/photo-chat.mjs";

test("photo observations and documented products survive history without becoming declared facts", () => {
  const state = createThreadState();
  state.context.intent = "Quero entender minha pele";
  const next = acceptAssistantResponse(state, PHOTO_CHAT_RESPONSE);
  assert.equal(next.context.detail, "");
  assert.equal(next.messages.at(-1).photoAnalysis.status, "observed");
  assert.equal(next.messages.at(-1).productMatches.length, 2);
  const restored = restoreSession(
    serializeSession({
      id: "photo",
      title: "Foto",
      updatedAt: Date.now(),
      state: next,
    }),
  );
  assert.deepEqual(restored.state.messages, next.messages);
  assert.equal(restored.state.photoConsent, false);
  assert.equal(state.messages.length, 0);
});
test("review retains photo evidence; care blocks all product matches", () => {
  const review = acceptAssistantResponse(createThreadState(), {
    ...PHOTO_CHAT_RESPONSE,
    ready: true,
  });
  assert.equal(review.messages.at(-1).photoAnalysis.status, "observed");
  const care = acceptAssistantResponse(createThreadState(), {
    ...PHOTO_CHAT_RESPONSE,
    care: true,
  });
  assert.deepEqual(care.messages.at(-1).productMatches, []);
});
test("sources are canonical and ungrounded catalog items are discarded", () => {
  const fields = photoResponseFields({
    ...PHOTO_CHAT_RESPONSE,
    sources: PHOTO_CHAT_RESPONSE.sources.map((s) => ({
      ...s,
      url: "javascript:alert(1)",
    })),
    productMatches: [
      ...PHOTO_CHAT_RESPONSE.productMatches,
      { productId: "made-up", reason: "works", sourceIds: ["skinboost-p13"] },
    ],
  });
  assert.equal(fields.productMatches.length, 2);
  assert.ok(
    fields.sources.every((s) => s.url.startsWith("/sources/skinboost-page-")),
  );
  assert.deepEqual(
    photoResponseFields({ productMatches: PHOTO_CHAT_RESPONSE.productMatches })
      .productMatches ?? [],
    [],
  );
});
test("limited image renders an honest observation without product cards or invented diagnosis", () => {
  const html = renderPhotoEvidence(LIMITED_PHOTO_CHAT_RESPONSE);
  assert.match(html, /Imagem limitada/);
  assert.doesNotMatch(html, /sx-photo-product"/);
  assert.match(html, /skinboost-page-6.pdf/);
});
test("before/after requests are recognized and image rendering rejects unsafe sources", () => {
  assert.equal(
    photoRequestIntent("Quero ver o antes e depois").simulation,
    true,
  );
  assert.deepEqual(
    photoRequestIntent("Analise minha foto e mostre antes e depois"),
    { analysis: true, simulation: true },
  );
  assert.equal(
    renderPhotoComparison({ original: "javascript:alert(1)", image: "x" }),
    "",
  );
  const html = renderPhotoComparison({
    original: "data:image/jpeg;base64,YQ==",
    image: "data:image/png;base64,Yg==",
  });
  assert.match(html, /type="range"/);
  assert.match(html, /NÃO É PREVISÃO/);
  assert.match(html, /skinboost-page-26.pdf/);
});
