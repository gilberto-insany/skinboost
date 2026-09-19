/** Synthetic contract fixture for UI/stories and backend regression tests.
 * It is not an assessment of an actual person or evidence of product efficacy.
 */
import {
  PRODUCT_LIMITATION,
  resolveSources,
} from "../../server/skinboost-grounding.mjs";
const CONTEXT_KEYS = [
  "intent",
  "goal",
  "scenario",
  "detail",
  "duration",
  "approach",
  "existing",
  "sensitivity",
  "budget",
];
export const PHOTO_ANALYSIS_FIXTURE = Object.freeze({
  status: "observed",
  summary:
    "A foto permite conversar sobre aparência, com limites de iluminação e enquadramento.",
  observations: [
    "A luz frontal destaca alguns reflexos na região da testa.",
    "Há variações visíveis de textura superficial no enquadramento.",
  ],
  limitations: [
    "Reflexo na imagem não confirma oleosidade, causa ou condição de saúde.",
    "Uma fotografia não informa sensibilidade nem adequação de produtos.",
  ],
  confirmationQuestion:
    "Esse brilho também aparece no seu dia a dia ou você o percebe mais nesta luz?",
});
export const PRODUCT_MATCHES_FIXTURE = Object.freeze([
  {
    productId: "cleanse",
    reason:
      "Podemos explorar Cleanse na etapa de limpeza do protótipo, já que você quer organizar os primeiros passos da rotina; isso não confirma uma indicação individual.",
    limitation: PRODUCT_LIMITATION,
    sourceIds: ["skinboost-p13"],
  },
  {
    productId: "comfort",
    reason:
      "Comfort aparece como um conceito da linha e participa da etapa de hidratação na demonstração; falta documentação para relacioná-lo a um benefício na sua pele.",
    limitation: PRODUCT_LIMITATION,
    sourceIds: ["skinboost-p13"],
  },
]);
export const PHOTO_CHAT_PROVIDER_RESULT = Object.freeze({
  text: "Vejo reflexos de luz na testa, mas a foto não confirma oleosidade. Posso relacionar os conceitos da linha ao que você busca, deixando claro o que o material ainda não documenta. Esse brilho também aparece no seu dia a dia ou você o percebe mais nesta luz?",
  choices: [
    {
      label: "Percebo no dia a dia",
      value: "Também percebo brilho no meu dia a dia.",
    },
    {
      label: "Mais nesta iluminação",
      value: "Percebo esse brilho mais nesta iluminação.",
    },
  ],
  context: Object.fromEntries(CONTEXT_KEYS.map((key) => [key, null])),
  ready: false,
  care: false,
  photoAnalysis: PHOTO_ANALYSIS_FIXTURE,
  productMatches: PRODUCT_MATCHES_FIXTURE,
  sourceIds: ["skinboost-p6", "skinboost-p13"],
});
export const PHOTO_CHAT_RESPONSE = Object.freeze({
  text: PHOTO_CHAT_PROVIDER_RESULT.text,
  choices: PHOTO_CHAT_PROVIDER_RESULT.choices,
  context: {},
  ready: false,
  care: false,
  photoAnalysis: PHOTO_ANALYSIS_FIXTURE,
  productMatches: PRODUCT_MATCHES_FIXTURE,
  sources: resolveSources(["skinboost-p6", "skinboost-p13"]),
});
export const LIMITED_PHOTO_CHAT_RESPONSE = Object.freeze({
  ...PHOTO_CHAT_RESPONSE,
  text: "A luz e o enquadramento não permitem observar a aparência da pele com clareza. Podemos usar seu relato ou tentar outra foto com luz uniforme. O que você percebe no dia a dia?",
  photoAnalysis: {
    status: "limited",
    summary: "A imagem não tem definição suficiente para uma observação útil.",
    observations: [],
    limitations: [
      "O enquadramento e a iluminação limitam a observação; não vou completar detalhes que não consigo ver.",
    ],
    confirmationQuestion: "O que você percebe no dia a dia?",
  },
  productMatches: [],
  sources: resolveSources(["skinboost-p6"]),
});
