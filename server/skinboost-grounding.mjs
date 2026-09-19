/** Allowlisted project facts, not clinical evidence. Source pages supplied by
 * the project's author: SkinBoost Apresentação V2, 11/09/2026, 28 pages.
 * Only the four relevant page excerpts are public; the full pitch is private.
 */
const page = (number, summary) =>
  Object.freeze({
    id: `skinboost-p${number}`,
    title: `SkinBoost Apresentação V2 — 11/09/2026 · página ${number}`,
    page: number,
    url: `/sources/skinboost-page-${number}.pdf`,
    kind: "project_brief",
    summary,
  });
export const SKINBOOST_SOURCES = Object.freeze([
  page(
    6,
    "A foto é opcional. Qualidade, iluminação, observações aparentes e contexto da pessoa orientam a conversa; a imagem isolada não fornece diagnóstico.",
  ),
  page(
    7,
    "Catálogo revisado, regras e alegações aprovadas são requisitos previstos para o sistema de recomendação; a descrição do fluxo não comprova eficácia de um produto.",
  ),
  page(
    13,
    "A linha conceitual nomeia Cleanse, Balance e Comfort. Fórmulas, rotulagem e alegações ainda não foram desenvolvidas.",
  ),
  page(
    26,
    "O antes e depois proposto é uma simulação sintética, sem prazo ou promessa de melhora; não demonstra eficácia dos produtos.",
  ),
]);
export const PRODUCT_LIMITATION =
  "A página 13 apresenta o conceito, mas não documenta fórmula, ingredientes, alegações ou eficácia. Não é possível confirmar adequação à sua pele nem prever resultado com este material.";
export const GROUNDED_PRODUCTS = Object.freeze(
  [
    { id: "cleanse", name: "Cleanse" },
    { id: "balance", name: "Balance" },
    { id: "comfort", name: "Comfort" },
  ].map((product) =>
    Object.freeze({
      ...product,
      status: "concept",
      sourceIds: ["skinboost-p13"],
      limitation: PRODUCT_LIMITATION,
    }),
  ),
);
export const SOURCE_IDS = SKINBOOST_SOURCES.map((source) => source.id);
export const PRODUCT_IDS = GROUNDED_PRODUCTS.map((product) => product.id);
export function resolveSources(ids = []) {
  const selected = new Set(ids);
  return SKINBOOST_SOURCES.filter((source) => selected.has(source.id)).map(
    ({ summary, ...source }) => ({ ...source }),
  );
}
export const GROUNDING_CONTEXT = JSON.stringify({
  document: "SkinBoost Apresentação V2 — 11/09/2026",
  kind: "project_brief_not_clinical_evidence",
  sources: SKINBOOST_SOURCES,
  products: GROUNDED_PRODUCTS,
  absentEvidence: [
    "INCI ou fórmula",
    "ativo ou concentração",
    "produto indicado por condição",
    "comprovação de benefício",
    "prazo de resultado",
    "preço comercial validado",
  ],
});
