import test from "node:test";
import assert from "node:assert/strict";
import { createThreadFixture } from "../src/chat/thread-state.js";
import {
  createAlternative,
  recordContextChanges,
  makeConversationNote,
} from "../src/chat/conversation-tools.js";

test("an alternative preserves original and inherited context while separating purchases and permissions", () => {
  const original = createThreadFixture("routine", "oiliness");
  original.photoDataUrl = "data:image/jpeg;base64,example";
  original.photoConsent = true;
  const snapshot = structuredClone(original);
  const next = createAlternative(original, {
    sourceId: "original",
    choice: "budget",
  });
  assert.deepEqual(original, snapshot);
  assert.deepEqual(next.context, original.context);
  assert.equal(next.branch.sourceId, "original");
  assert.equal(next.photoConsent, false);
  assert.equal(next.routine, null);
  assert.deepEqual(next.selected, []);
  assert.match(next.draft, /econômica/);
  next.context.budget = "R$ 0";
  next.messages[0].text = "Independent";
  assert.deepEqual(original, snapshot);
  assert.equal(next.branch.inheritedContext.budget, original.context.budget);
});
test("context provenance records only changed fields and shows before/after", () => {
  const state = createThreadFixture("review", "oiliness");
  const before = structuredClone(state.context);
  state.context.budget = "R$ 0";
  const message = { id: "user-change", text: "Não quero gastar nada agora" };
  const changes = recordContextChanges(state, before, message);
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], {
    key: "budget",
    before: before.budget,
    after: "R$ 0",
  });
  assert.deepEqual(state.contextOrigins.budget, {
    messageId: message.id,
    text: message.text,
  });
  assert.equal(state.contextOrigins.sensitivity, undefined);
});
test("notes include declared context and honest scope without private image data", () => {
  const state = createThreadFixture("routine", "oiliness");
  state.photoDataUrl = "private-image-data";
  const note = makeConversationNote(state);
  assert.match(note, /Seu orçamento/);
  assert.match(note, /Total fictício por embalagem/);
  assert.match(note, /não é diagnóstico/);
  assert.doesNotMatch(note, /private-image-data/);
});
