import test from "node:test";
import assert from "node:assert/strict";
import {
  createExperienceState,
  transitionExperience,
} from "../src/chat/conversation.js";
test("editing a composer step preserves the context, attachment and check-in without mutating the source", () => {
  const state = createExperienceState();
  state.context.intent = "Minha rotina";
  state.photoName = "foto.png";
  state.checkin = { status: "Consegui manter" };
  state.error = "erro anterior";
  const next = transitionExperience(state, "context", {
    question: 2,
    returnStep: "routine",
  });
  assert.equal(next.context.intent, "Minha rotina");
  assert.equal(next.photoName, "foto.png");
  assert.deepEqual(next.checkin, state.checkin);
  assert.equal(next.error, "");
  assert.equal(state.step, "welcome");
  assert.equal(next.returnStep, "routine");
});
test("independent sessions do not share answers or events", () => {
  const a = createExperienceState(),
    b = createExperienceState();
  a.context.intent = "A";
  a.events.push({ name: "start" });
  assert.equal(b.context.intent, "");
  assert.equal(b.events.length, 0);
  assert.throws(() => transitionExperience(a, "unknown"));
});
