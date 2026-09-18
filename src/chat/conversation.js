/** Local demonstration only. Replace this service with a reviewed server contract for real care. */
export const questions = [
  {
    id: "routine",
    label: "Rotina atual",
    text: "Vamos começar pelo seu dia a dia. O que você já usa na pele hoje?",
    options: [
      "Ainda não tenho uma rotina",
      "Limpeza e hidratação",
      "Já uso vários produtos",
    ],
  },
  {
    id: "sensitivity",
    label: "Cuidados importantes",
    text: "Existe alguma sensibilidade, alergia ou experiência com produtos que você gostaria de registrar?",
    options: [
      "Nada que eu saiba",
      "Já tive sensibilidade",
      "Prefiro conversar com um profissional",
    ],
  },
  {
    id: "pace",
    label: "Seu ritmo",
    text: "Como você gostaria que esse cuidado se encaixasse na sua vida?",
    options: [
      "Quero poucos passos",
      "Quero ajustar o que já uso",
      "Quero conhecer a linha completa",
    ],
  },
  {
    id: "budget",
    label: "Orçamento",
    text: "Qual faixa de orçamento você quer considerar? Os produtos deste exemplo ainda não têm preços definidos.",
    options: ["Até R$ 150", "Até R$ 250", "Prefiro decidir depois"],
  },
];

export function createConversation(goal = "", attachment = "") {
  const text = goal.trim();
  return {
    goal: text,
    attachment,
    answers: {},
    step: 0,
    phase: text ? "questions" : "start",
    messages: text
      ? [
          { role: "user", text, attachment },
          {
            role: "assistant",
            text: "Vamos organizar seu contexto, uma pergunta por vez. Você pode usar as sugestões ou escrever do seu jeito.",
          },
          { role: "assistant", text: questions[0].text, question: 0 },
        ]
      : [],
  };
}

export function answerQuestion(state, input) {
  const text = input.trim();
  if (!text || text.length > 800)
    throw new Error("Escreva uma resposta de até 800 caracteres.");
  if (state.phase === "start")
    return createConversation(text, state.attachment);
  if (state.phase !== "questions")
    throw new Error("Revise seu contexto antes de continuar.");
  const question = questions[state.step];
  const step = state.step + 1;
  const messages = [
    ...state.messages,
    { role: "user", text, answer: state.step },
  ];
  if (step < questions.length)
    messages.push({
      role: "assistant",
      text: questions[step].text,
      question: step,
    });
  else
    messages.push({
      role: "assistant",
      text: "Aqui está o contexto que você compartilhou. Confira antes de explorar a proposta.",
    });
  return {
    ...state,
    answers: { ...state.answers, [question.id]: text },
    step,
    messages,
    phase: step === questions.length ? "review" : "questions",
  };
}

export function editAnswer(state, index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= questions.length ||
    !state.answers[questions[index].id]
  )
    return state;
  const lastQuestion = state.messages.findIndex(
    (message) => message.question === index,
  );
  const answers = Object.fromEntries(
    questions
      .slice(0, index)
      .map((question) => [question.id, state.answers[question.id]]),
  );
  return {
    ...state,
    answers,
    step: index,
    phase: "questions",
    messages: state.messages.slice(0, lastQuestion + 1),
  };
}

export function confirmContext(state) {
  if (
    state.phase !== "review" ||
    questions.some((question) => !state.answers[question.id])
  )
    throw new Error("Complete e revise seu contexto primeiro.");
  return {
    ...state,
    phase: "plan",
    messages: [
      ...state.messages,
      {
        role: "assistant",
        text: "Seu contexto está organizado. Esta é uma proposta demonstrativa para explorar e discutir.",
      },
    ],
  };
}

export function buildDemoPlan(state) {
  if (state.phase !== "plan") return null;
  const explore = state.answers.pace === "Quero conhecer a linha completa";
  return {
    title: explore
      ? "Uma linha para conhecer."
      : "Um começo com poucos passos.",
    rationale: explore
      ? "Você escolheu explorar a linha completa. Veja a função conceitual de cada item."
      : "Este exemplo prioriza uma apresentação simples: entender a limpeza e a hidratação antes de ampliar a rotina.",
    products: [
      {
        name: "Cleanse",
        category: "Limpeza",
        description: "Conheça a função da limpeza no cuidado diário.",
      },
      ...(explore
        ? [
            {
              name: "Balance",
              category: "Sérum",
              description:
                "Item complementar do catálogo; a adequação de ativos depende de avaliação.",
            },
          ]
        : []),
      {
        name: "Comfort",
        category: "Hidratação",
        description: "Conheça o papel da hidratação e do conforto na rotina.",
      },
    ],
    note: "A demonstração organiza respostas; não interpreta sintomas, analisa fotos ou determina o melhor tratamento. Fórmulas, preços e adequação dos produtos ainda precisam ser validados.",
  };
}
