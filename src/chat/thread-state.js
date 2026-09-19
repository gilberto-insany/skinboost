import { CATALOG, buildRoutine } from "../routine.js";

// Local, deterministic conversation for the prototype; not a model or diagnosis.
const norm = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const clean = (value) =>
  String(value ?? "")
    .trim()
    .slice(0, 2000);
const copy = (value) => structuredClone(value);
const CONTEXT = {
  intent: "",
  scenario: "",
  goal: "",
  detail: "",
  duration: "",
  existing: "",
  sensitivity: "",
  approach: "",
  budget: "",
};
const FIELD_NAMES = {
  intent: "pedido",
  goal: "foco",
  detail: "o que você percebe",
  duration: "há quanto tempo percebe isso",
  existing: "produtos atuais",
  sensitivity: "restrições ou tratamento em curso",
  approach: "quantidade de passos",
  budget: "orçamento",
};
const UNSURE =
  /^(?:nao sei|ainda nao sei|nao tenho certeza|nao lembro|prefiro nao informar|nao consigo dizer|nao consigo saber)[.!]?$/;
const choices = (...items) =>
  items.map((item) =>
    typeof item === "string"
      ? { label: item, value: item }
      : { label: item[0], value: item[1] },
  );

export function createThreadState() {
  return {
    context: { ...CONTEXT },
    messages: [],
    step: "welcome",
    questionKey: "",
    photoName: "",
    draft: "",
    routine: null,
    selected: [],
    checkin: null,
    events: [],
    revision: 0,
  };
}

function cloneState(state) {
  const next = copy(state || createThreadState());
  next.context = { ...CONTEXT, ...next.context };
  next.messages ||= [];
  next.events ||= [];
  next.selected ||= [];
  return next;
}
function append(state, role, text, extra = {}) {
  state.messages.push({
    id: `m-${state.messages.length + 1}`,
    role,
    text,
    kind: "text",
    ...extra,
  });
}
function event(state, name) {
  state.events.push({ name });
}

function scenarioFrom(text) {
  const value = norm(text);
  if (/\b(?:acne|espinhas?|cravos?)\b/.test(value)) return "acne";
  if (/oleos|pele oleosa|muito brilho|brilho (?:no rosto|na testa)/.test(value))
    return "oiliness";
  if (
    /ressec|pele(?: e| esta| fica)? (?:muito )?seca|repux|descam|hidratacao|hidratar/.test(
      value,
    )
  )
    return "dry";
  if (/rotina|basico|comecar|conhecer|cuidados|cuidar/.test(value))
    return "general";
  return "";
}
function goalFor(scenario) {
  return (
    {
      acne: "Entender os cuidados diante de cravos ou espinhas",
      oiliness: "oleosidade",
      dry: "hidratação",
      general: "conhecer",
    }[scenario] || ""
  );
}
function urgent(text) {
  const clauses = norm(text).split(/[,.!?;]|\bmas\b/);
  return clauses.some((clause) => {
    const absent = /\b(?:sem|nao tenho|nao estou com|nao sinto|nao ha)\b/.test(
      clause,
    );
    return (
      !absent &&
      /\b(?:dor (?:muito )?(?:forte|intensa)|febre|inchaco (?:muito )?rapido|inchando (?:muito )?rapido|inchou (?:muito )?rapido|dificuldade (?:para|de) respirar)\b/.test(
        clause,
      )
    );
  });
}
function askCare(state) {
  state.step = "care";
  state.questionKey = "";
  state.selected = [];
  append(
    state,
    "assistant",
    "Dor forte, febre, inchaço rápido ou dificuldade para respirar precisam de avaliação profissional. Procure atendimento presencial com prontidão; se houver dificuldade para respirar ou piora rápida, busque um serviço de urgência. Não vou continuar a seleção de produtos a partir desse relato.",
  );
  event(state, "professional_care_suggested");
}

function budgetFrom(text, bare = false) {
  const value = norm(text);
  if (
    /^(?:prefiro )?(?:decidir|ver) depois[.!]?$/.test(value) ||
    /^(?:sem limite|a definir)$/.test(value)
  )
    return "Prefiro decidir depois";
  const match =
    value.match(
      /(?:r\$\s*|(?:ate|orcamento(?: de)?|limite(?: de)?|maximo(?: de)?|gastar(?: ate)?)\s+)(\d[\d.,]*)/,
    ) ||
    value.match(/\b(\d[\d.,]*)\s*reais\b/) ||
    (bare && value.match(/^(\d[\d.,]*)$/));
  if (!match || /(?:r\$\s*|ate\s+)-/.test(value)) return "";
  // Reuse the catalog's strict BRL parser, including malformed-budget handling.
  const raw = match[1].replace(/[.,]$/, "");
  const result = buildRoutine({ budget: raw });
  return result.budgetValue === null ? "" : `R$ ${raw}`;
}

function factsFrom(text) {
  const value = norm(text),
    facts = {};
  const scenario = scenarioFrom(text);
  if (scenario) {
    facts.scenario = scenario;
    facts.goal = goalFor(scenario);
  }
  const concerns = [];
  if (/\bcravos?\b/.test(value)) concerns.push("cravos");
  if (/\bespinhas?\b/.test(value)) concerns.push("espinhas");
  if (/irritac|ardor|ardencia/.test(value))
    concerns.push("irritação percebida");
  if (/descam/.test(value)) concerns.push("descamação percebida");
  if (/repux/.test(value)) concerns.push("sensação de repuxamento");
  if (concerns.length) facts.detail = concerns.join(" e ");
  else if (
    /brilho (?:no rosto|na testa)|oleosidade (?:no rosto|na testa|ao longo do dia)/.test(
      value,
    )
  )
    facts.detail = "Oleosidade ou brilho percebido ao longo do dia";
  const duration = value.match(
    /(?:\bha\s+|\bfaz\s+|\bdesde\s+)?(?:\d+|um|uma|dois|duas|tres|alguns|algumas|poucos|poucas)\s+(?:dias?|semanas?|mes(?:es)?|anos?)\b/,
  );
  if (duration) facts.duration = duration[0];
  else if (
    /desde (?:ontem|hoje|a adolescencia)|ha bastante tempo|faz tempo|recentemente/.test(
      value,
    )
  )
    facts.duration = value.match(
      /desde (?:ontem|hoje|a adolescencia)|ha bastante tempo|faz tempo|recentemente/,
    )[0];
  const existing = clean(text).match(
    /\b(?:j[aá] uso|uso|utilizo|passo)\s+([^.;!?]+)/i,
  );
  if (
    /nao uso (?:nada|nenhum produto)|nenhum produto|ainda nao uso|estou comecando do zero/.test(
      value,
    )
  )
    facts.existing = "Nenhum produto";
  else if (existing && !/nao\s+$/.test(norm(text.slice(0, existing.index)))) {
    const current = existing[1].split(
      /\s+(?:e quero|mas quero|e tenho|e meu or[cç]amento|com or[cç]amento)\s+/i,
    )[0];
    facts.existing = `Uso ${current}`;
  }
  if (
    /sem (?:restricoes|sensibilidade|alergias)|nenhuma restricao conhecida|nao tenho (?:restricoes|alergias|sensibilidade)/.test(
      value,
    )
  )
    facts.sensitivity = "Nenhuma restrição conhecida";
  else if (
    /em tratamento|acompanhamento (?:medico|dermatologico)|uso (?:um )?(?:medicamento|remedio|acido|isotretinoina)|tenho (?:sensibilidade|alergia|restricoes)|pele sensivel/.test(
      value,
    )
  )
    facts.sensitivity = clean(text);
  if (/poucos passos|menos passos|simples|simplificar|minim|basico/.test(value))
    facts.approach = "Poucos passos";
  else if (
    /explorar|conhecer (?:todas|mais) (?:as )?opcoes|rotina completa/.test(
      value,
    )
  )
    facts.approach = "Explorar possibilidades";
  else if (/aproveitar|ajustar o que|manter o que|ja tenho/.test(value))
    facts.approach = "Ajustar o que já uso";
  const budget = budgetFrom(text);
  if (budget) facts.budget = budget;
  return facts;
}

function question(state, key) {
  const scenario = state.context.scenario;
  const map = {
    intent: ["Como você quer ajustar o seu pedido?", []],
    goal: [
      "O que você gostaria de entender ou mudar primeiro?",
      choices(
        ["Cravos ou espinhas", "Quero entender cravos e espinhas"],
        ["Oleosidade", "Quero entender a oleosidade"],
        ["Ressecamento", "Quero entender o ressecamento"],
        ["Começar uma rotina", "Quero começar uma rotina"],
      ),
    ],
    detail:
      scenario === "acne"
        ? [
            "Quando você fala em acne, percebe mais cravos, espinhas ou irritação? Pode descrever com suas palavras.",
            choices(
              "Mais cravos",
              "Mais espinhas",
              "Espinhas e irritação",
              "Não sei distinguir",
            ),
          ]
        : scenario === "oiliness"
          ? [
              "O que você percebe mais: brilho ao longo do dia, cravos ou desconforto depois de lavar?",
              choices(
                "Brilho ao longo do dia",
                "Cravos junto da oleosidade",
                "Desconforto depois de lavar",
                "Não sei distinguir",
              ),
            ]
          : [
              "Como esse ressecamento aparece para você: repuxamento, descamação ou outra sensação?",
              choices(
                "Sensação de repuxamento",
                "Descamação",
                "Irritação",
                "Não sei distinguir",
              ),
            ],
    duration: [
      "Há quanto tempo você percebe isso? Uma ideia aproximada já ajuda a organizar o relato.",
      choices(
        "Começou há poucos dias",
        "Há algumas semanas",
        "Há alguns meses",
        "Não sei precisar",
      ),
    ],
    existing: [
      "O que você já usa hoje? Quero preservar o que você tem antes de falar em acrescentar produtos.",
      choices(
        "Não uso nenhum produto",
        "Já uso limpeza",
        "Já uso limpeza e hidratação",
      ),
    ],
    sensitivity: [
      "Há alguma sensibilidade, restrição ou tratamento em andamento que precisamos considerar?",
      choices(
        "Nenhuma restrição conhecida",
        "Tenho sensibilidade ou restrições",
        "Estou em tratamento",
        "Não sei",
      ),
    ],
    approach: [
      "Como você prefere organizar a rotina agora?",
      choices(
        "Poucos passos",
        "Ajustar o que já uso",
        "Explorar possibilidades",
      ),
    ],
    budget: [
      "Que limite de gasto você quer considerar? Os valores do catálogo são fictícios nesta demonstração.",
      choices(
        "Até R$ 120",
        "Até R$ 150",
        "Até R$ 250",
        "Prefiro decidir depois",
      ),
    ],
    checkin: [
      "Como foi conviver com a rotina? Seu relato fica nesta conversa, sem medir eficácia dos produtos.",
      choices(
        "Está fácil de manter",
        "Quero simplificar",
        "Percebi desconforto",
      ),
    ],
  };
  const [text, options] = map[key] || map.goal;
  return { text, kind: "question", questionKey: key, choices: options };
}
function ask(state, key, prefix = "") {
  state.questionKey = key;
  if (state.step !== "editing" && key !== "checkin") state.step = "context";
  const q = question(state, key);
  append(state, "assistant", prefix ? `${prefix} ${q.text}` : q.text, {
    ...q,
    text: prefix ? `${prefix} ${q.text}` : q.text,
  });
}
function missingField(state) {
  const context = state.context;
  const keys = [
    "goal",
    ...(context.scenario !== "general" ? ["detail", "duration"] : []),
    "existing",
    "sensitivity",
    "approach",
    "budget",
  ];
  return keys.find((key) => !context[key]) || "";
}
function review(
  state,
  text = "Vou usar este contexto para organizar um exemplo cosmético. Confira o que entendi; você pode corrigir qualquer parte antes de ver a proposta.",
) {
  state.step = "review";
  state.questionKey = "";
  append(state, "assistant", text, {
    kind: "review",
    snapshot: copy(state.context),
  });
}
function advance(state, prefix = "") {
  const missing = missingField(state);
  if (missing) ask(state, missing, prefix);
  else review(state);
}
function answerFor(key, text, facts) {
  const value = norm(text);
  if (UNSURE.test(value) || /^nao sei (?:distinguir|precisar)$/.test(value))
    return key === "budget"
      ? "Prefiro decidir depois"
      : key === "goal"
        ? "Quero conhecer as opções"
        : clean(text);
  if (key === "intent") return clean(text);
  if (facts[key]) return facts[key];
  if (key === "budget") return budgetFrom(text, true);
  if (
    key === "detail" &&
    /crav|espinh|irrit|brilho|testa|bochech|nariz|oleos|desconfort|descam|repux|vermelh|ard|bolinh|resseca/.test(
      value,
    )
  )
    return clean(text);
  if (
    key === "duration" &&
    /hoje|ontem|semana|meses?|dias?|anos?|tempo|recente|adolescencia/.test(
      value,
    )
  )
    return clean(text);
  if (
    key === "existing" &&
    /^(?:nada|nenhum|nenhuma|nao|nenhum produto)[.!]?$/.test(value)
  )
    return "Nenhum produto";
  if (
    key === "existing" &&
    /limpeza|cleanse|sabonete|limpador|hidratante|hidratacao|comfort|serum|balance|protetor|vitamina|gel de/.test(
      value,
    )
  )
    return clean(text);
  if (
    key === "sensitivity" &&
    /^(?:nao|nenhuma|nenhum|nao tenho)[.!]?$/.test(value)
  )
    return "Nenhuma restrição conhecida";
  if (
    key === "sensitivity" &&
    /sensibil|restric|tratamento|alerg|dermatolog|remedio|medicamento|acido|isotretinoina|nao faco|nao uso/.test(
      value,
    )
  )
    return clean(text);
  if (
    key === "approach" &&
    /poucos|menos|simples|essencial|basico|minim/.test(value)
  )
    return "Poucos passos";
  if (key === "approach" && /explor|completa|conhecer/.test(value))
    return "Explorar possibilidades";
  if (key === "approach" && /ajust|aproveit|ja uso|ja tenho/.test(value))
    return "Ajustar o que já uso";
  return "";
}

const EDUCATION = {
  acne: {
    id: "aad-acne",
    text: "A AAD orienta cuidados suaves e evitar esfregar ou espremer a pele. Tratamento de acne depende da situação de cada pessoa e deve ser discutido com um dermatologista. Essa orientação geral não valida nenhum produto SkinBoost.",
    url: "https://www.aad.org/public/diseases/acne/skin-care/tips",
  },
  oiliness: {
    id: "aad-oily",
    text: "A AAD explica que pele oleosa também pode precisar de hidratação e recomenda evitar limpeza agressiva. A escolha depende das características reais da fórmula e da pessoa. Isso não comprova que os conceitos SkinBoost sejam adequados.",
    url: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/oily-skin",
  },
};
function explain(state, text) {
  const lower = norm(text);
  const product = CATALOG.find((p) => lower.includes(norm(p.name)));
  if (product) {
    const result = state.routine?.products.find((p) => p.id === product.id);
    append(
      state,
      "assistant",
      `${result?.reason || product.description} O catálogo é conceitual e não comprova eficácia ou tolerância.`,
      { kind: "source", productId: product.id },
    );
  } else {
    const education = EDUCATION[state.context.scenario];
    if (education)
      append(state, "assistant", education.text, {
        kind: "source",
        productId: education.id,
      });
    else
      append(
        state,
        "assistant",
        "As escolhas deste exemplo usam quantidade de passos, produtos que você já tem e orçamento. A fonte de cada card separa essa organização das informações de fórmula e eficácia que ainda não existem no catálogo conceitual.",
      );
  }
}

export function sendMessage(input, text) {
  const state = cloneState(input),
    message = clean(text);
  if (!message) return state;
  state.draft = "";
  append(state, "user", message);
  event(state, "message_sent");
  if (urgent(message)) {
    askCare(state);
    return state;
  }
  if (state.step === "care") {
    append(
      state,
      "assistant",
      "O relato anterior pede avaliação profissional. Vou manter a seleção de produtos interrompida nesta conversa. Você pode levar seu histórico de produtos e sintomas ao atendimento.",
    );
    return state;
  }
  const value = norm(message);
  if (state.step === "checkin" && state.questionKey === "checkin") {
    state.checkin = { status: message, note: "" };
    state.step = "routine";
    state.questionKey = "";
    append(
      state,
      "assistant",
      /desconfort|irrit|ard/.test(value)
        ? "Registrei seu relato. Este exemplo não avalia a causa do desconforto; procure orientação profissional antes de decidir mudanças de produto."
        : "Registrei seu relato nesta conversa. Podemos rever a quantidade de passos se você quiser.",
      { kind: "checkin", snapshot: copy(state.checkin) },
    );
    return state;
  }
  if (
    state.context.intent &&
    /\b(?:por que|porque|fonte|evidencia|adequad|comprov|seguro|seguranca)\b|posso usar|qual tratamento|qual remedio|qual medicamento|quanto tempo.*resultado/.test(
      value,
    )
  ) {
    explain(state, message);
    if (state.questionKey)
      ask(state, state.questionKey, "Para continuar entendendo seu contexto:");
    return state;
  }

  const first = !state.context.intent;
  const previousKey = state.questionKey;
  const wasEditing = state.step === "editing";
  const facts = factsFrom(message);
  if (first) {
    state.context.intent = message;
    state.context.scenario = facts.scenario || "general";
    for (const [key, fact] of Object.entries(facts))
      if (!state.context[key]) state.context[key] = fact;
    const opening =
      state.context.scenario === "acne"
        ? "Podemos conversar sobre o que você percebe e organizar os cuidados do dia a dia, sem concluir um diagnóstico ou prescrever tratamento."
        : "Vamos entender o que faz sentido para o seu dia a dia, aproveitando o que você já informou.";
    advance(state, opening);
    return state;
  }

  if (state.routine && !previousKey) {
    if (/mais barato|gastar menos|reduzir (?:o )?custo/.test(value)) {
      if (state.context.approach !== "Poucos passos") {
        state.context.approach = "Poucos passos";
        review(
          state,
          "Vou priorizar poucos passos. Sua rotina atual continua abaixo; confirme este contexto para preparar uma versão revisada.",
        );
      } else {
        state.step = "editing";
        ask(state, "budget", "A proposta já prioriza poucos passos.");
      }
      return state;
    }
    const budget = budgetFrom(message, true);
    if (budget) facts.budget = budget;
    const editable = [
      "goal",
      "detail",
      "duration",
      "existing",
      "sensitivity",
      "approach",
      "budget",
    ];
    const changed = editable.filter(
      (key) => facts[key] && facts[key] !== state.context[key],
    );
    if (changed.length) {
      for (const key of changed) state.context[key] = facts[key];
      if (changed.includes("goal") && facts.scenario)
        state.context.scenario = facts.scenario;
      review(
        state,
        "Atualizei apenas o contexto que você trouxe. Confira antes de substituir a proposta por uma nova versão.",
      );
      return state;
    }
    append(
      state,
      "assistant",
      "Você quer ajustar algum detalhe da rotina ou entender uma das escolhas? Posso rever o orçamento, reduzir passos ou abrir a fonte de um produto.",
      {
        choices: choices(
          "Menos passos",
          "Mais barato",
          "Por que essas escolhas?",
        ),
      },
    );
    return state;
  }

  const answer = previousKey ? answerFor(previousKey, message, facts) : "";
  for (const [key, fact] of Object.entries(facts))
    if (!state.context[key]) state.context[key] = fact;
  if (answer) {
    state.context[previousKey] = answer;
    if (previousKey === "goal")
      state.context.scenario = facts.scenario || "general";
    if (previousKey === "intent") {
      // Editing the request alone preserves unrelated confirmed answers.
      state.context.intent = message;
    }
    state.questionKey = "";
    if (wasEditing) {
      review(
        state,
        `Atualizei ${FIELD_NAMES[previousKey] || "esse detalhe"} e preservei suas outras respostas. Confira antes de continuar.`,
      );
      return state;
    }
  }
  if (!answer && previousKey && (!state.context[previousKey] || wasEditing)) {
    ask(
      state,
      previousKey,
      previousKey === "budget"
        ? "Preciso de um valor legível em reais ou da opção de decidir depois."
        : "Não consegui relacionar essa resposta ao que perguntei. Você pode descrever de outro jeito ou escolher uma opção.",
    );
    return state;
  }
  if (!previousKey && state.step === "review") {
    review(
      state,
      "Posso corrigir um campo específico antes da confirmação. Escolha o que deseja editar no resumo.",
    );
    return state;
  }
  advance(state);
  return state;
}

export function act(input, action, payload) {
  if (action === "reset") return createThreadState();
  const state = cloneState(input);
  if (action === "photo") {
    state.photoName = clean(
      typeof payload === "object" ? payload?.name : payload,
    );
    event(state, state.photoName ? "photo_attached" : "photo_removed");
    return state;
  }
  if (action === "selection") {
    const ids = Array.isArray(payload) ? payload : payload?.ids;
    const eligible = new Set(state.routine?.products.map((p) => p.id) || []);
    state.selected =
      state.step === "care"
        ? []
        : [
            ...new Set(
              (Array.isArray(ids) ? ids : []).filter((id) => eligible.has(id)),
            ),
          ];
    event(state, "selection_changed");
    return state;
  }
  if (state.step === "care") {
    append(
      state,
      "assistant",
      "A seleção está interrompida após o relato de sintomas que precisam de avaliação profissional.",
    );
    return state;
  }
  if (action === "edit") {
    const key = typeof payload === "string" ? payload : payload?.key;
    if (!Object.hasOwn(FIELD_NAMES, key)) {
      append(
        state,
        "assistant",
        "Qual parte você quer rever: pedido, contexto, produtos atuais ou orçamento?",
      );
      return state;
    }
    state.step = "editing";
    ask(
      state,
      key,
      `Vamos ajustar ${FIELD_NAMES[key]}. As outras respostas continuam guardadas.`,
    );
    return state;
  }
  if (action === "confirm") {
    const missing = missingField(state);
    if (!state.context.intent || (missing && state.step !== "review")) {
      advance(
        state,
        "Antes de organizar o exemplo, falta entender um detalhe.",
      );
      return state;
    }
    const goal =
      state.context.scenario === "dry"
        ? "hidratação"
        : state.context.scenario === "oiliness"
          ? "oleosidade"
          : "conhecer";
    const normalized = {
      ...state.context,
      intent:
        "Organizar uma rotina cosmética com base nas preferências declaradas.",
      goal,
    };
    const routine = buildRoutine(normalized);
    if (!routine.withinBudget) {
      state.step = "editing";
      ask(state, "budget", "Não consegui interpretar o teto de gasto.");
      return state;
    }
    const hadRoutine = Boolean(state.routine);
    state.routine = copy(routine);
    state.selected = routine.products.map((p) => p.id);
    state.step = "routine";
    state.questionKey = "";
    if (hadRoutine) state.revision += 1;
    append(
      state,
      "assistant",
      "Organizei uma proposta demonstrativa a partir das suas preferências. Cada item tem uma razão e limites para conferir; isso não é tratamento nem comprovação de adequação à sua pele.",
      {
        kind: "routine",
        snapshot: copy(state.context),
        routine: copy(routine),
      },
    );
    event(state, "routine_confirmed");
    return state;
  }
  if (action === "source") {
    const id = typeof payload === "string" ? payload : payload?.productId;
    if (CATALOG.some((p) => p.id === id))
      append(
        state,
        "assistant",
        "Esta é a origem conceitual do item. Nome, categoria e valores demonstrativos não comprovam fórmula, eficácia ou tolerância.",
        { kind: "source", productId: id },
      );
    else {
      const source =
        Object.values(EDUCATION).find((s) => s.id === id) ||
        EDUCATION[state.context.scenario];
      if (source)
        append(state, "assistant", source.text, {
          kind: "source",
          productId: source.id,
        });
      else
        append(
          state,
          "assistant",
          "Não encontrei essa fonte. Posso abrir os limites de um produto do catálogo.",
        );
    }
    event(state, "source_opened");
    return state;
  }
  if (action === "checkin") {
    if (!state.routine) {
      advance(state, "Primeiro vamos organizar seu contexto.");
      return state;
    }
    state.step = "checkin";
    ask(state, "checkin");
    return state;
  }
  if (["compare", "cart", "checkout"].includes(action)) {
    if (!state.routine) {
      advance(state, "Ainda não temos uma proposta para revisar.");
      return state;
    }
    const selected = state.routine.products.filter((p) =>
      state.selected.includes(p.id),
    );
    if (action === "checkout" && !selected.length) {
      append(
        state,
        "assistant",
        "Você não selecionou produtos. Pode continuar sem compra ou rever a seleção.",
      );
      return state;
    }
    const kind = { compare: "comparison", cart: "cart", checkout: "checkout" }[
      action
    ];
    const text = {
      compare:
        "Os dois conjuntos de preços são fictícios. Esta comparação mostra a diferença entre valores do cenário, sem oferta ou desconto real.",
      cart: "Escolha quais itens quer manter na revisão. A seleção não realiza uma compra.",
      checkout:
        "Este é o resumo dos itens selecionados. O checkout é demonstrativo: não cobra nem envia um pedido.",
    }[action];
    const snapshot = {
      context: copy(state.context),
      selected: selected.map((p) => p.id),
      products: copy(selected),
      subtotal: selected.reduce((sum, p) => sum + p.price, 0),
    };
    append(state, "assistant", text, {
      kind,
      routine: copy(state.routine),
      snapshot,
    });
    event(state, `${kind}_opened`);
    return state;
  }
  append(
    state,
    "assistant",
    "Não reconheci essa ação. Podemos continuar a conversa ou rever um campo do contexto.",
  );
  return state;
}

// API mode: append the user's message once, then accept the server's result.
// These helpers never run the local conversation heuristics or analyze photos.
export function appendUserMessage(input, text) {
  const state = cloneState(input),
    message = clean(text);
  if (!message) return state;
  state.draft = "";
  if (!state.context.intent) state.context.intent = message;
  append(state, "user", message);
  event(state, "message_sent");
  return state;
}

export function acceptAssistantResponse(input, result) {
  const state = cloneState(input);
  if (
    !result ||
    typeof result !== "object" ||
    typeof result.text !== "string" ||
    !result.text.trim()
  ) {
    append(
      state,
      "assistant",
      "Não consegui receber uma resposta completa. Seu pedido e contexto continuam aqui; você pode tentar novamente.",
    );
    event(state, "assistant_response_incomplete");
    return state;
  }
  const text = clean(result.text);
  if (result.context && typeof result.context === "object") {
    for (const key of Object.keys(CONTEXT)) {
      const value = result.context[key];
      if (typeof value !== "string" || !value.trim()) continue;
      if (
        key === "scenario" &&
        !["acne", "oiliness", "dry", "general"].includes(value)
      )
        continue;
      // Preserve the actual opening request; model metadata is not a new user request.
      if (key === "intent" && state.context.intent) continue;
      state.context[key] = clean(value);
    }
  }
  if (result.care === true || state.step === "care") {
    state.step = "care";
    state.questionKey = "";
    state.selected = [];
    append(
      state,
      "assistant",
      result.care === true
        ? text
        : "O relato anterior pede avaliação profissional. A seleção de produtos permanece interrompida nesta conversa.",
    );
    event(state, "professional_care_suggested");
    return state;
  }
  if (result.ready === true) {
    review(state, text);
    event(state, "assistant_review_ready");
    return state;
  }
  const options = (Array.isArray(result.choices) ? result.choices : [])
    .filter(
      (item) =>
        item &&
        typeof item.label === "string" &&
        typeof item.value === "string" &&
        item.label.trim() &&
        item.value.trim(),
    )
    .slice(0, 8)
    .map((item) => ({ label: clean(item.label), value: clean(item.value) }));
  state.step = "context";
  state.questionKey = missingField(state);
  append(state, "assistant", text, {
    kind: "question",
    questionKey: state.questionKey,
    choices: options,
  });
  event(state, "assistant_response_received");
  return state;
}

export function createThreadFixture(
  initialStep = "routine",
  scenario = "acne",
) {
  const normalized = ["acne", "oiliness", "dry", "general"].includes(scenario)
    ? scenario
    : "general";
  let state = createThreadState();
  if (initialStep === "welcome") return state;
  const starters = {
    acne: "Quero tratar minha acne.",
    oiliness: "Quero entender a oleosidade.",
    dry: "Minha pele fica ressecada.",
    general: "Quero começar uma rotina.",
  };
  state = sendMessage(state, starters[normalized]);
  if (initialStep === "context") return state;
  const answers = {
    goal: "Quero começar uma rotina",
    detail:
      normalized === "acne"
        ? "Cravos e espinhas"
        : normalized === "oiliness"
          ? "Brilho ao longo do dia"
          : "Sensação de repuxamento",
    duration: "Há alguns meses",
    existing: "Já uso limpeza",
    sensitivity: "Nenhuma restrição conhecida",
    approach: "Poucos passos",
    budget: "Até R$ 150",
  };
  for (let i = 0; i < 12 && state.questionKey; i++)
    state = sendMessage(state, answers[state.questionKey] || "Não sei");
  if (initialStep === "review") return state;
  state = act(state, "confirm");
  if (initialStep === "source")
    return act(state, "source", state.routine?.products[0]?.id || "cleanse");
  if (initialStep === "comparison") return act(state, "compare");
  if (["cart", "checkout", "checkin"].includes(initialStep))
    return act(state, initialStep);
  if (initialStep === "care")
    return sendMessage(state, "Estou com dor forte e febre.");
  if (initialStep === "editing") return act(state, "edit", "budget");
  return state;
}
