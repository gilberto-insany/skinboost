import { CATALOG } from "../routine.js";
const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const pages = new Set([6, 7, 13, 26]);
export const safePhoto = (value) =>
  typeof value === "string" &&
  /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value);
const strings = (value) =>
  Array.isArray(value)
    ? value
        .filter((v) => typeof v === "string")
        .slice(0, 8)
        .map((v) => v.slice(0, 1600))
    : [];
export function photoResponseFields(result) {
  const analysis = result?.photoAnalysis;
  const sources = (Array.isArray(result?.sources) ? result.sources : [])
    .filter((s) => pages.has(s.page) && s.id === `skinboost-p${s.page}`)
    .map((s) => ({
      id: s.id,
      page: s.page,
      title: String(s.title || "Apresentação SkinBoost"),
      url: `/sources/skinboost-page-${s.page}.pdf`,
    }));
  const sourceIds = new Set(sources.map((s) => s.id));
  const productMatches = result?.care
    ? []
    : (Array.isArray(result?.productMatches) ? result.productMatches : [])
        .filter(
          (p) =>
            CATALOG.some((c) => c.id === p.productId) &&
            typeof p.reason === "string",
        )
        .slice(0, 3)
        .map((p) => ({
          productId: p.productId,
          reason: p.reason.slice(0, 1600),
          limitation:
            "O PDF apresenta conceitos de produtos. Fórmulas e alegações de eficácia ainda não foram desenvolvidas.",
          sourceIds: strings(p.sourceIds).filter((id) => sourceIds.has(id)),
        }))
        .filter((p) => p.sourceIds.includes("skinboost-p13"));
  if (!analysis || !["observed", "limited"].includes(analysis.status))
    return sources.length || productMatches.length
      ? { sources, productMatches }
      : {};
  return {
    photoAnalysis: {
      status: analysis.status,
      summary: String(analysis.summary || "").slice(0, 1600),
      observations: strings(analysis.observations),
      limitations: strings(analysis.limitations),
      confirmationQuestion: String(analysis.confirmationQuestion || "").slice(
        0,
        600,
      ),
    },
    productMatches,
    sources,
  };
}
export function photoRequestIntent(text) {
  const value = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return {
    analysis:
      /analis|avalie|avaliar|observe|o que.*(?:foto|imagem)|minha (?:foto|imagem)/.test(
        value,
      ),
    simulation:
      /simulacao|simular|(?:gerar|gere|criar|crie) (?:uma )?imagem|antes\s*(?:e|\/)\s*depois|ver como.*ficar/.test(
        value,
      ),
  };
}
export function renderPhotoEvidence(message, { canSimulate = false } = {}) {
  const {
    photoAnalysis: a,
    productMatches: matches = [],
    sources = [],
  } = photoResponseFields(message);
  if (!a && !matches.length) return "";
  const links = sources
    .map(
      (s) =>
        `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)} <span>p. ${s.page} ↗</span></a>`,
    )
    .join("");
  return `${a ? `<section class="sx-photo-analysis" aria-label="Observações da foto"><div class="sx-photo-heading"><span class="sx-photo-symbol" aria-hidden="true">✧</span><div><span class="sx-card-eyebrow">SUA FOTO, COM CONTEXTO</span><h3>${a.status === "limited" ? "Vamos melhorar essa observação?" : "O que consigo observar"}</h3></div><span class="sx-observation-tag">${a.status === "limited" ? "Imagem limitada" : "Para confirmar com você"}</span></div><p>${esc(a.summary)}</p>${a.observations.length ? `<ul class="sx-observations">${a.observations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}<details class="sx-photo-limits"><summary>O que esta foto não confirma</summary>${a.limitations.map((l) => `<p>${esc(l)}</p>`).join("")}<p>Observações de aparência não são diagnóstico nem indicação de tratamento.</p></details></section>` : ""}${
    matches.length
      ? `<section class="sx-photo-products" aria-label="Relação com o catálogo"><span class="sx-card-eyebrow">DO SEU PEDIDO AO CATÁLOGO</span><h3>Conceitos para explorar juntos</h3><p class="sx-footnote">A relação abaixo explica o protótipo. Ainda não comprova adequação à sua pele.</p>${matches
          .map((m) => {
            const p = CATALOG.find((p) => p.id === m.productId);
            return `<article class="sx-photo-product"><img src="/media/produtos-skinboost.png" alt="Linha conceitual SkinBoost" loading="lazy"><div><span class="sx-kicker">${esc(p.category)} · etapa ilustrativa</span><h4>${esc(p.name)}</h4><p>${esc(m.reason)}</p><a href="/sources/skinboost-page-13.pdf" target="_blank" rel="noopener">Ver conceito no PDF · p. 13 ↗</a></div></article>`;
          })
          .join(
            "",
          )}<p class="sx-evidence-note">${esc(matches[0].limitation)}</p></section>`
      : ""
  }${links ? `<details class="sx-photo-sources"><summary>Fontes desta resposta · ${sources.length}</summary>${links}</details>` : ""}${a?.confirmationQuestion && !message.text?.includes(a.confirmationQuestion) ? `<p class="sx-photo-question">${esc(a.confirmationQuestion)}</p>` : ""}${canSimulate && a?.status === "observed" ? `<button type="button" class="sx-button sx-secondary sx-photo-visual-action" data-action="simulate">Explorar uma ilustração com minha foto ↗</button>` : ""}`;
}
export function renderPhotoComparison(message) {
  if (!safePhoto(message.original) || !safePhoto(message.image)) return "";
  return `<figure class="sx-simulation"><div class="sx-comparison-heading"><span class="sx-card-eyebrow">EXPLORAÇÃO VISUAL</span><h3>Original e possibilidade ilustrada</h3><p>Arraste para comparar. A imagem criada não prevê resultados de produtos.</p></div><div class="sx-photo-compare" style="--reveal:50%"><img class="sx-compare-base" src="${message.image}" alt="Possibilidade ilustrativa criada por IA, não é previsão de tratamento"><img class="sx-compare-original" src="${message.original}" alt="Foto original enviada por você"><div class="sx-compare-labels"><span>Original</span><span>Ilustração com IA</span></div><span class="sx-compare-handle" aria-hidden="true"><b>↔</b></span></div><label class="sx-comparison-control"><span>Comparar original e ilustração</span><input type="range" min="0" max="100" value="50" data-photo-compare aria-label="Quanto da foto original mostrar" aria-valuetext="50% da foto original"><span aria-hidden="true">↔</span></label><figcaption>ILUSTRAÇÃO COM IA · NÃO É PREVISÃO<br>Sem prazo ou resultado garantido. Não demonstra o efeito de nenhum produto nem mede melhora clínica. <a href="/sources/skinboost-page-26.pdf" target="_blank" rel="noopener">Critérios da comparação · p. 26 ↗</a></figcaption></figure>`;
}
