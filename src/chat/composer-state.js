import { DEFAULT_CONTEXT } from "../routine.js";

export const composerQuestions = [
  {
    key: "goal",
    title: "O que merece atenção primeiro?",
    description:
      "Escolha o que você percebe. Isso organiza a conversa; não define um diagnóstico.",
    choices: [
      [
        "hidratação",
        "Quero mais conforto",
        "Ressecamento que percebo no dia a dia.",
        "drop",
      ],
      [
        "oleosidade",
        "Quero entender a oleosidade",
        "Antes de acrescentar mais produtos.",
        "sun",
      ],
      [
        "conhecer",
        "Quero começar pelo básico",
        "Entender a função de cada passo.",
        "leaf",
      ],
    ],
  },
  {
    key: "approach",
    title: "Como o cuidado cabe no seu dia?",
    description: "Uma rotina útil é aquela que você consegue manter.",
    choices: [
      [
        "Poucos passos",
        "Poucos passos",
        "O essencial, sem complicar.",
        "circles-three",
      ],
      [
        "Ajustar o que já uso",
        "Ajustar o que já uso",
        "Aproveitar a rotina que já existe.",
        "sliders-horizontal",
      ],
      [
        "Explorar possibilidades",
        "Explorar possibilidades",
        "Conhecer também um passo complementar.",
        "sparkle",
      ],
    ],
  },
  {
    key: "existing",
    title: "O que já faz parte da sua rotina?",
    description: "Assim, podemos evitar sugerir uma compra repetida.",
    choices: [
      [
        "Nenhum produto",
        "Estou começando",
        "Ainda não tenho uma rotina.",
        "plant",
      ],
      [
        "Já uso limpeza",
        "Já tenho um limpador",
        "Quero conhecer os outros passos.",
        "drop",
      ],
      [
        "Já uso limpeza e hidratação",
        "Já limpo e hidrato",
        "Quero aproveitar esses produtos.",
        "check-circle",
      ],
    ],
    custom: "Ou descreva o que já usa",
    placeholder: "Ex.: uso um limpador e um hidratante à noite.",
  },
  {
    key: "sensitivity",
    title: "Tem algo que a gente precisa respeitar?",
    description:
      "Se você não sabe, tudo bem. Não vamos presumir o que sua pele tolera.",
    choices: [
      [
        "Não sei",
        "Ainda não sei",
        "Quero entender antes de escolher.",
        "question",
      ],
      [
        "Tenho sensibilidade ou restrições",
        "Tenho sensibilidade ou restrições",
        "Preciso conferir composição e orientação profissional.",
        "hand-heart",
      ],
      [
        "Nenhuma restrição conhecida",
        "Nenhuma restrição conhecida",
        "Isso não garante tolerância a um novo produto.",
        "check",
      ],
    ],
  },
  {
    key: "budget",
    title: "Qual limite faz sentido para você?",
    description:
      "Os valores desta experiência são fictícios, para demonstrar a comparação. Não são preços de venda.",
    choices: [
      ["Até R$ 120", "Até R$ 120", "Começar com um limite menor.", "wallet"],
      ["Até R$ 150", "Até R$ 150", "Priorizar uma rotina curta.", "wallet"],
      ["Até R$ 250", "Até R$ 250", "Explorar outras possibilidades.", "wallet"],
      [
        "Prefiro decidir depois",
        "Decidir depois",
        "Ver os valores antes de escolher.",
        "arrow-right",
      ],
    ],
    custom: "Ou informe outro limite em reais",
    placeholder: "Ex.: R$ 90",
    inputmode: "decimal",
  },
];

export function createExperienceState() {
  return {
    context: { ...DEFAULT_CONTEXT },
    photoName: "",
    step: "welcome",
    question: 0,
    routine: null,
    selected: [],
    checkin: null,
    events: [],
    revision: 0,
    error: "",
    draft: "",
    returnStep: "",
    orderReviewed: false,
  };
}

const validSteps = new Set([
  "welcome",
  "context",
  "review",
  "processing",
  "paused",
  "scope",
  "routine",
  "source",
  "comparison",
  "cart",
  "checkout",
  "checkin",
  "privacy",
  "catalog",
]);
export function transitionExperience(state, step, extra = {}) {
  if (!validSteps.has(step)) throw new Error("Etapa desconhecida");
  return { ...state, ...extra, step, error: "" };
}
