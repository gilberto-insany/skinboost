import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SESSIONS,
  serializeSession,
  restoreSession,
  selectRecentSessions,
  loadSessions,
  saveSession,
  deleteSession,
  clearSessions,
} from "../src/chat/session-store.js";

const photo = "data:image/png;base64,c2tpbmJvb3N0";
const record = (id = "session-1", updatedAt = 123) => ({
  id,
  title: "Minha conversa",
  updatedAt,
  state: {
    context: { intent: "Quero uma rotina simples", budget: "R$ 150" },
    messages: [
      { id: "m-1", role: "user", text: "Meu pedido" },
      { id: "m-2", role: "assistant", kind: "image", imageDataUrl: photo },
    ],
    step: "routine",
    draft: "Ainda estou escrevendo…",
    photoName: "foto.png",
    photoDataUrl: photo,
    photoConsent: true,
    routine: { products: [{ id: "comfort", price: 69 }] },
    selected: ["comfort"],
    checkin: { status: "Está fácil de manter" },
    revision: 2,
    events: [{ name: "message_sent" }],
  },
});

test("serialization retains complete state, images, artifacts and consent without mutating input", () => {
  const source = record();
  source.state.error = "Erro temporário";
  source.state.failedRequest = true;
  const saved = serializeSession(source);
  assert.deepEqual(saved, source);
  assert.equal(saved.state.photoConsent, true);
  assert.equal(saved.state.photoDataUrl, photo);
  assert.equal(saved.state.messages[1].imageDataUrl, photo);
  saved.state.context.budget = "R$ 69";
  saved.state.messages[0].text = "edited";
  assert.equal(source.state.context.budget, "R$ 150");
  assert.equal(source.state.messages[0].text, "Meu pedido");
});

test("restoring requires fresh photo consent, clears transient failures and preserves the draft", () => {
  const source = record();
  Object.assign(source.state, {
    pending: true,
    loading: true,
    isPending: true,
    isLoading: true,
    photoPending: true,
    generatingImage: true,
    error: "Falhou",
    failedRequest: true,
  });
  const loaded = restoreSession(source);
  assert.equal(loaded.state.photoConsent, false);
  for (const key of [
    "pending",
    "loading",
    "isPending",
    "isLoading",
    "photoPending",
    "generatingImage",
    "failedRequest",
  ])
    assert.equal(loaded.state[key], false, key);
  assert.equal(loaded.state.error, "");
  assert.equal(loaded.state.draft, source.state.draft);
  assert.equal(loaded.state.photoDataUrl, photo);
  assert.deepEqual(loaded.state.routine, source.state.routine);
  assert.deepEqual(loaded.state.messages, source.state.messages);
  assert.equal(source.state.photoConsent, true);
  assert.equal(source.state.error, "Falhou");
});

test("restoring an interrupted operation yields a usable state instead of an eternal loader", () => {
  for (const step of ["processing", "loading", "waiting", "generating"]) {
    const source = record();
    source.state.step = step;
    assert.equal(restoreSession(source).state.step, "routine");
    source.state.routine = null;
    assert.equal(restoreSession(source).state.step, "context");
    source.state.context.intent = "";
    assert.equal(restoreSession(source).state.step, "welcome");
  }
  const care = record();
  care.state.step = "care";
  assert.equal(restoreSession(care).state.step, "care");
});

test("only the latest twenty distinct sessions are retained in descending update order", () => {
  const source = Array.from({ length: 25 }, (_, i) => record(`s-${i}`, i));
  const recent = selectRecentSessions(source);
  assert.equal(recent.length, MAX_SESSIONS);
  assert.equal(recent[0].id, "s-24");
  assert.equal(recent.at(-1).id, "s-5");
  assert.equal(source[0].id, "s-0");
  assert.equal(selectRecentSessions(source, 100).length, 20);
  assert.equal(selectRecentSessions(source, 0).length, 0);
});

test("saving an existing identity represents one conversation with its newest state", () => {
  const old = record("same", 10),
    newer = record("same", 30),
    other = record("other", 20);
  newer.state.draft = "Novo rascunho";
  const selected = selectRecentSessions([newer, old, other]);
  assert.deepEqual(
    selected.map((s) => s.id),
    ["same", "other"],
  );
  assert.equal(selected[0].state.draft, "Novo rascunho");
  selected[0].state.draft = "Mutated";
  assert.equal(newer.state.draft, "Novo rascunho");
});

test("metadata validation rejects unstoreable records and provides a safe title fallback", () => {
  for (const bad of [
    null,
    {},
    record("", 10),
    record("x", NaN),
    record("x", Infinity),
    record("x", -1),
    { ...record(), state: null },
    { ...record(), state: [] },
  ])
    assert.throws(() => serializeSession(bad), TypeError);
  const empty = record();
  empty.title = "   ";
  assert.equal(serializeSession(empty).title, "Nova conversa");
  empty.title = "x".repeat(300);
  assert.equal(serializeSession(empty).title.length, 160);
  empty.state.bad = () => {};
  assert.throws(() => serializeSession(empty));
});

test("storage unavailable rejects asynchronously with a friendly error instead of claiming a save", async () => {
  // Node has no IndexedDB; browser CRUD is exercised by the integration preview.
  assert.equal(globalThis.indexedDB, undefined);
  for (const operation of [
    () => loadSessions(),
    () => saveSession(record()),
    () => deleteSession("session-1"),
    () => clearSessions(),
  ]) {
    await assert.rejects(
      operation(),
      (error) =>
        error.code === "SESSION_STORAGE_UNAVAILABLE" &&
        /navegador/.test(error.message),
    );
  }
});
