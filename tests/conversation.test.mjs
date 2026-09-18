import assert from "node:assert/strict";
import test from "node:test";
import {
  createConversation,
  answerQuestion,
  confirmContext,
  editAnswer,
  buildDemoPlan,
  questions,
} from "../src/chat/conversation.js";
import { escapeHtml } from "../src/ui/dom.js";

function complete(pace = "Quero poucos passos") {
  return [
    "Ainda não tenho uma rotina",
    "Já tive sensibilidade",
    pace,
    "Até R$ 150",
  ].reduce(
    answerQuestion,
    createConversation("Quero entender minha rotina", "foto.png"),
  );
}

test("requires all answers and explicit review before a proposal", () => {
  let state = createConversation("Meu objetivo");
  assert.equal(buildDemoPlan(state), null);
  assert.throws(() => confirmContext(state));
  for (const question of questions)
    state = answerQuestion(state, question.options[0]);
  assert.equal(state.phase, "review");
  assert.equal(buildDemoPlan(state), null);
  assert.equal(confirmContext(state).phase, "plan");
});

test("editing an earlier answer clears all dependent answers and the old plan", () => {
  const original = confirmContext(complete("Quero conhecer a linha completa"));
  const edited = editAnswer(original, 1);
  assert.deepEqual(Object.keys(edited.answers), ["routine"]);
  assert.equal(edited.step, 1);
  assert.equal(edited.messages.at(-1).question, 1);
  assert.equal(buildDemoPlan(edited), null);
  assert.equal(original.phase, "plan");
  assert.equal(Object.keys(original.answers).length, 4);
});

test("a revised preference updates the demo catalog, without retaining the old choice", () => {
  let state = confirmContext(complete("Quero conhecer a linha completa"));
  assert.deepEqual(
    buildDemoPlan(state).products.map((item) => item.name),
    ["Cleanse", "Balance", "Comfort"],
  );
  state = editAnswer(state, 2);
  state = answerQuestion(state, "Quero poucos passos");
  state = answerQuestion(state, "Prefiro decidir depois");
  assert.deepEqual(
    buildDemoPlan(confirmContext(state)).products.map((item) => item.name),
    ["Cleanse", "Comfort"],
  );
});

test("free text and attachment name survive the conversation without making clinical claims", () => {
  const state = complete();
  assert.equal(state.attachment, "foto.png");
  assert.equal(state.answers.sensitivity, "Já tive sensibilidade");
  const plan = buildDemoPlan(confirmContext(state));
  assert.match(plan.note, /não interpreta sintomas/);
});

test("empty or oversized input cannot advance the conversation", () => {
  const state = createConversation("Meu objetivo");
  assert.throws(() => answerQuestion(state, "   "));
  assert.throws(() => answerQuestion(state, "a".repeat(801)));
  assert.equal(state.step, 0);
});

test("new conversation has no previous answers or attachments", () => {
  complete();
  const state = createConversation();
  assert.equal(state.phase, "start");
  assert.deepEqual(state.answers, {});
  assert.equal(state.attachment, "");
});

test("message text is escaped before insertion into HTML", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
});
