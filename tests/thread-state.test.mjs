import test from "node:test";
import assert from "node:assert/strict";
import {
  createThreadState,
  sendMessage,
  act,
  createThreadFixture,
  appendUserMessage,
  acceptAssistantResponse,
} from "../src/chat/thread-state.js";

const last = (state) => state.messages.at(-1);
const fixture = (step = "routine", scenario = "acne") =>
  createThreadFixture(step, scenario);
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};

test("acne and treatment start a conversation instead of a scope block", () => {
  const state = sendMessage(createThreadState(), "Quero tratar minha acne");
  assert.equal(state.context.scenario, "acne");
  assert.equal(state.step, "context");
  assert.equal(state.questionKey, "detail");
  assert.match(last(state).text, /cravos, espinhas ou irritação/);
  assert.equal(state.messages[0].role, "user");
  assert.equal(last(state).kind, "question");
  const question = sendMessage(
    createThreadState(),
    "Qual tratamento para acne?",
  );
  assert.equal(question.context.scenario, "acne");
  assert.equal(question.questionKey, "detail");
  assert.match(
    last(question).text,
    /sem concluir um diagnóstico ou prescrever/,
  );
});

test("explicit initial facts skip known questions without inventing missing answers", () => {
  const state = sendMessage(
    createThreadState(),
    "Tenho espinhas há 3 meses. Já uso limpeza e hidratação. Quero poucos passos e gastar até R$ 150.",
  );
  assert.equal(state.context.detail, "espinhas");
  assert.equal(state.context.duration, "ha 3 meses");
  assert.match(state.context.existing, /limpeza e hidratação/);
  assert.equal(state.context.approach, "Poucos passos");
  assert.equal(state.context.budget, "R$ 150");
  assert.equal(state.questionKey, "sensitivity");
  const reviewed = sendMessage(state, "Nenhuma restrição conhecida");
  assert.equal(reviewed.step, "review");
  assert.equal(last(reviewed).kind, "review");
});

test("scenarios produce different descriptive follow-up questions", () => {
  const oily = sendMessage(createThreadState(), "Quero entender a oleosidade");
  const dry = sendMessage(createThreadState(), "Minha pele é seca");
  assert.equal(oily.context.scenario, "oiliness");
  assert.match(last(oily).text, /brilho/);
  assert.equal(dry.context.scenario, "dry");
  assert.match(last(dry).text, /repuxamento/);
  const general = sendMessage(createThreadState(), "Quero uma rotina simples");
  assert.equal(general.questionKey, "existing");
});

test("unrelated text never becomes the answer to the active question", () => {
  const state = sendMessage(fixture("context"), "Gosto de café");
  assert.equal(state.questionKey, "detail");
  assert.equal(state.context.detail, "");
  assert.match(last(state).text, /Não consegui relacionar/);
  const budget = sendMessage(fixture("context"), "Meu orçamento é R$ 120");
  assert.equal(budget.questionKey, "detail");
  assert.equal(budget.context.budget, "R$ 120");
});

test("a full natural conversation appends history and confirms a cosmetic routine", () => {
  const review = fixture("review");
  assert.equal(review.step, "review");
  assert.equal(last(review).kind, "review");
  assert.match(review.context.intent, /tratar minha acne/);
  const state = act(review, "confirm");
  assert.equal(state.step, "routine");
  assert.equal(state.messages.length, review.messages.length + 1);
  assert.equal(last(state).kind, "routine");
  assert.deepEqual(
    state.routine.products.map((p) => p.id),
    ["comfort"],
  );
  assert.match(last(state).text, /não é tratamento/);
  assert.equal(
    new Set(state.messages.map((m) => m.id)).size,
    state.messages.length,
  );
});

test("editing one field preserves all other facts and the old routine until confirmation", () => {
  const start = fixture();
  const editing = act(start, "edit", { key: "budget" });
  const review = sendMessage(editing, "R$ 60");
  assert.equal(review.step, "review");
  assert.equal(review.context.budget, "R$ 60");
  for (const key of Object.keys(start.context).filter((k) => k !== "budget"))
    assert.equal(review.context[key], start.context[key], key);
  assert.deepEqual(review.routine, start.routine);
  const confirmed = act(review, "confirm");
  assert.equal(confirmed.revision, 1);
  assert.deepEqual(confirmed.routine.products, []);
  assert.deepEqual(
    start.routine.products.map((p) => p.id),
    ["comfort"],
  );
});

test("invalid budget answers stay on that question without accepting unlimited spending", () => {
  const editing = act(fixture(), "edit", "budget");
  const state = sendMessage(editing, "-150 bananas");
  assert.equal(state.context.budget, editing.context.budget);
  assert.equal(state.questionKey, "budget");
  assert.equal(state.step, "editing");
});

test("post-result refinements produce a review and do not regenerate immediately", () => {
  const initial = fixture();
  const custom = sendMessage(initial, "Até R$ 90");
  assert.equal(custom.context.budget, "R$ 90");
  assert.equal(custom.step, "review");
  assert.deepEqual(custom.routine, initial.routine);
  const explore = copyExplore(initial);
  const fewer = sendMessage(explore, "Menos passos");
  assert.equal(fewer.context.approach, "Poucos passos");
  assert.equal(fewer.step, "review");
  assert.deepEqual(fewer.routine, explore.routine);
  const cheaper = sendMessage(explore, "Mais barato");
  assert.equal(cheaper.context.approach, "Poucos passos");
  assert.equal(cheaper.step, "review");
  assert.equal(sendMessage(initial, "Mais barato").questionKey, "budget");
});
function copyExplore(state) {
  const next = structuredClone(state);
  next.context.approach = "Explorar possibilidades";
  return next;
}

test("source and cost messages retain the conversation and corresponding snapshots", () => {
  const start = fixture();
  const source = act(start, "source", { productId: "comfort" });
  assert.equal(last(source).kind, "source");
  assert.equal(last(source).productId, "comfort");
  const comparison = act(source, "compare");
  assert.equal(last(comparison).kind, "comparison");
  assert.equal(comparison.messages.length, start.messages.length + 2);
  assert.deepEqual(last(comparison).routine, start.routine);
  const why = sendMessage(start, "Por que essas escolhas?");
  assert.equal(last(why).productId, "aad-acne");
  assert.match(last(why).text, /não valida nenhum produto/);
});

test("checkout includes only selected products and excludes arbitrary catalog ids", () => {
  const start = fixture();
  const state = act(start, "selection", [
    "comfort",
    "balance",
    "comfort",
    "inventado",
  ]);
  assert.deepEqual(state.selected, ["comfort"]);
  const cart = act(state, "cart");
  assert.equal(last(cart).kind, "cart");
  const checkout = act(cart, "checkout");
  assert.equal(last(checkout).kind, "checkout");
  assert.deepEqual(last(checkout).snapshot.selected, ["comfort"]);
  assert.equal(last(checkout).snapshot.subtotal, 69);
  assert.match(last(checkout).text, /não cobra nem envia/);
  const empty = act(act(start, "selection", []), "checkout");
  assert.equal(last(empty).kind, "text");
  assert.match(last(empty).text, /não selecionou/);
});

test("photo actions preserve the draft, context and conversation", () => {
  const state = fixture();
  state.draft = "Minha pergunta ainda não foi enviada";
  const attached = act(state, "photo", { name: "minha-foto.jpg" });
  assert.equal(attached.photoName, "minha-foto.jpg");
  assert.equal(attached.draft, state.draft);
  assert.deepEqual(attached.messages, state.messages);
  assert.deepEqual(attached.context, state.context);
  assert.equal(act(attached, "photo", "").photoName, "");
});

test("check-in is appended without claiming efficacy", () => {
  const start = fixture();
  const asked = act(start, "checkin");
  assert.equal(last(asked).kind, "question");
  assert.equal(asked.questionKey, "checkin");
  const recorded = sendMessage(asked, "Quero simplificar");
  assert.equal(last(recorded).kind, "checkin");
  assert.equal(recorded.checkin.status, "Quero simplificar");
  assert.equal(recorded.messages.length, start.messages.length + 3);
});

test("urgent symptoms interrupt product actions without treating ordinary acne as urgent", () => {
  for (const text of [
    "Estou com dor forte",
    "Tenho febre",
    "Meu rosto está inchando rápido",
    "Tenho dificuldade para respirar",
  ]) {
    const state = sendMessage(fixture(), text);
    assert.equal(state.step, "care", text);
    assert.deepEqual(state.selected, []);
    assert.match(last(state).text, /avaliação profissional/);
    assert.equal(last(act(state, "confirm")).kind, "text");
    assert.equal(last(act(state, "checkout")).kind, "text");
  }
  assert.notEqual(
    sendMessage(
      createThreadState(),
      "Tenho espinhas, sem febre e sem dor forte",
    ).step,
    "care",
  );
});

test("public operations are immutable, including nested historical routine snapshots", () => {
  const original = fixture();
  const before = structuredClone(original);
  freeze(original);
  const next = sendMessage(original, "Até R$ 120");
  next.messages.find((m) => m.routine).routine.products[0].reason =
    "mutated in new state";
  assert.deepEqual(original, before);
  assert.deepEqual(act(original, "reset"), createThreadState());
  assert.equal(act(original, "photo", "a.jpg").photoName, "a.jpg");
});

test("unknown actions and premature confirmation recover into conversation", () => {
  const initial = createThreadState();
  assert.equal(act(initial, "confirm").questionKey, "goal");
  assert.equal(last(act(initial, "unknown")).kind, "text");
  assert.equal(last(act(fixture(), "edit", "bad-key")).kind, "text");
  for (const step of [
    "welcome",
    "context",
    "review",
    "routine",
    "source",
    "comparison",
    "cart",
    "checkout",
    "checkin",
    "editing",
    "care",
    "unknown",
  ]) {
    const state = fixture(step);
    assert.ok(Array.isArray(state.messages));
  }
});

test("API mode appends one user message and cumulatively accepts assistant context", () => {
  const initial = createThreadState();
  initial.context.existing = "Já uso limpeza";
  initial.draft = "Tenho acne";
  const waiting = appendUserMessage(initial, "Tenho acne");
  assert.equal(waiting.messages.length, 1);
  assert.equal(waiting.messages[0].role, "user");
  assert.equal(waiting.draft, "");
  assert.equal(waiting.context.intent, "Tenho acne");
  const next = acceptAssistantResponse(waiting, {
    text: "O que você percebe mais?",
    choices: [
      { label: "Cravos", value: "Mais cravos" },
      null,
      { label: "Sem valor" },
    ],
    context: {
      scenario: "acne",
      goal: "Entender os cuidados",
      existing: "",
      intent: "pedido reescrito",
      secret: "ignored",
    },
    ready: false,
    care: false,
  });
  assert.equal(next.messages.length, 2);
  assert.equal(next.messages.filter((m) => m.role === "user").length, 1);
  assert.equal(next.context.existing, "Já uso limpeza");
  assert.equal(next.context.intent, "Tenho acne");
  assert.equal(next.context.secret, undefined);
  assert.equal(last(next).kind, "question");
  assert.deepEqual(last(next).choices, [
    { label: "Cravos", value: "Mais cravos" },
  ]);
  assert.equal(waiting.context.scenario, "");
});

test("API ready response creates a review and confirmation builds only a cosmetic example", () => {
  const start = appendUserMessage(createThreadState(), "Quero tratar acne");
  const ready = acceptAssistantResponse(start, {
    text: "Confira o contexto antes de continuar.",
    context: {
      scenario: "acne",
      goal: "Entender acne",
      existing: "Já uso limpeza",
      approach: "Poucos passos",
      budget: "Até R$ 150",
    },
    ready: true,
    care: false,
  });
  assert.equal(ready.step, "review");
  assert.equal(last(ready).kind, "review");
  assert.equal(ready.routine, null);
  const state = act(ready, "confirm");
  assert.equal(state.step, "routine");
  assert.equal(last(state).kind, "routine");
  assert.deepEqual(
    state.routine.products.map((p) => p.id),
    ["comfort"],
  );
});

test("API care responses stop product actions and incomplete responses preserve context", () => {
  const start = appendUserMessage(fixture(), "Estou com dor forte");
  const care = acceptAssistantResponse(start, {
    text: "Procure avaliação profissional presencial.",
    context: {},
    care: true,
    ready: true,
  });
  assert.equal(care.step, "care");
  assert.deepEqual(care.selected, []);
  assert.equal(last(act(care, "confirm")).kind, "text");
  const invalid = acceptAssistantResponse(start, { choices: [] });
  assert.deepEqual(invalid.context, start.context);
  assert.match(last(invalid).text, /tentar novamente/);
});
