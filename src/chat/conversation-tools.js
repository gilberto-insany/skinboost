const clone = (value) => structuredClone(value);
export const CONTEXT_LABELS = {
  intent: "Seu pedido",
  detail: "O que incomoda",
  duration: "Há quanto tempo",
  existing: "O que já usa",
  sensitivity: "Cuidados e restrições",
  approach: "Seu ritmo",
  budget: "Seu orçamento",
};
export const ALTERNATIVES = [
  {
    id: "budget",
    label: "Gastar menos",
    description: "Comparar uma possibilidade com outro orçamento.",
    draft:
      "Quero explorar uma opção mais econômica, mantendo os outros cuidados. Pode me perguntar qual orçamento faz sentido?",
  },
  {
    id: "simple",
    label: "Simplificar os cuidados",
    description: "Descobrir um caminho com menos passos.",
    draft:
      "Quero explorar uma rotina com menos passos, mantendo minhas restrições e meu orçamento.",
  },
  {
    id: "focus",
    label: "Mudar meu foco",
    description: "Conversar sobre outra necessidade da sua pele.",
    draft:
      "Quero explorar outro cuidado para minha pele. Pode me perguntar o que eu gostaria de mudar?",
  },
  {
    id: "open",
    label: "Escolher outro caminho",
    description: "Começar pelo que você tem em mente.",
    draft: "",
  },
];

/** An independent conversation snapshot; the original is never mutated. */
export function createAlternative(
  state,
  { sourceId, title, choice = "open" } = {},
) {
  const option =
    ALTERNATIVES.find((item) => item.id === choice) || ALTERNATIVES[3];
  const next = clone(state);
  for (const message of next.messages) message.inherited = true;
  next.branch = {
    sourceId: sourceId || "",
    sourceTitle: title || state.context.intent || "Conversa original",
    choice: option.label,
    inheritedContext: clone(state.context),
  };
  next.sessionLabel = `${option.label} · ${next.branch.sourceTitle}`.slice(
    0,
    100,
  );
  next.messages.push({
    id: `alternative-${next.messages.length + 1}`,
    role: "assistant",
    kind: "alternative",
    text: `Vamos explorar: ${option.label.toLowerCase()}. Suas respostas anteriores estão disponíveis aqui. A conversa original continua guardada, e os próximos ajustes valem só para esta opção.`,
    snapshot: clone(state.context),
  });
  next.draft = option.draft;
  next.routine = null;
  next.selected = [];
  next.step = "conversation";
  next.photoConsent = false;
  next.error = "";
  next.failedRequest = false;
  next.requestInterrupted = false;
  next.failedText = "";
  next.generatingImage = false;
  next.questionKey = "";
  next.editingKey = "";
  delete next.streamText;
  return next;
}

/** Provenance records the actual user message, never a fabricated source. */
export function recordContextChanges(state, before, userMessage) {
  const changes = [];
  state.contextOrigins ||= {};
  for (const [key, value] of Object.entries(state.context)) {
    if (value === before[key] || !value) continue;
    if (userMessage)
      state.contextOrigins[key] = {
        messageId: userMessage.id,
        text: userMessage.text,
      };
    if (CONTEXT_LABELS[key] && before[key])
      changes.push({ key, before: before[key], after: value });
  }
  const latest = state.messages.at(-1);
  if (latest?.role === "assistant") {
    latest.contextOrigins = clone(state.contextOrigins);
    if (changes.length) latest.contextChanges = changes;
  }
  return changes;
}

export function makeConversationNote(state) {
  const lines = [
    "MEUS CUIDADOS · SKINBOOST",
    "Resumo das respostas — confira antes de usar.",
    "",
  ];
  for (const [key, label] of Object.entries(CONTEXT_LABELS))
    if (state.context[key]) lines.push(`${label}: ${state.context[key]}`);
  if (state.branch)
    lines.push(
      "",
      `Outra opção: ${state.branch.choice}`,
      `Partiu de: ${state.branch.sourceTitle}`,
    );
  if (state.routine) {
    lines.push("", "Proposta demonstrativa:");
    for (const product of state.routine.products)
      lines.push(`${product.name}: ${product.reason}`);
    lines.push(
      `Total fictício por embalagem: R$ ${state.routine.subtotal.toFixed(2).replace(".", ",")}`,
    );
  }
  lines.push(
    "",
    "LIMITES",
    "A IA pode errar. Este resumo não é diagnóstico nem prescrição. Produtos, preços e checkout são demonstrativos. Uma imagem não comprova eficácia nem prevê resultados.",
  );
  return lines.join("\n");
}
