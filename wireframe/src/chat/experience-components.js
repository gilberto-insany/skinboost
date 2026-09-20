import { ALTERNATIVES } from "./conversation-tools.js";
import { CATALOG, CHECKOUT_EXAMPLE_URL, formatMoney } from "../routine.js";
import {
  renderPhotoEvidence,
  renderPhotoComparison,
  safePhoto,
} from "./photo-experience.js";
export const esc = (v = "") =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (name) =>
  `<i class="ph ph-${name}" aria-hidden="true"></i>`;
const money = formatMoney;
export const fields = {
  intent: "Seu pedido",
  detail: "O que incomoda",
  duration: "Há quanto tempo",
  existing: "O que já usa",
  sensitivity: "Cuidados e restrições",
  approach: "Seu ritmo",
  budget: "Seu orçamento",
};
export const sources = {
  "aad-acne": {
    name: "Acne · American Academy of Dermatology",
    url: "https://www.aad.org/public/diseases/acne/skin-care/tips",
    text: "Orientação educativa sobre cuidados com a pele com acne. Não é um estudo dos produtos SkinBoost.",
  },
  "aad-oily": {
    name: "Oleosidade · American Academy of Dermatology",
    url: "https://www.aad.org/public/everyday-care/skin-care-basics/dry/oily-skin",
    text: "Orientação educativa sobre cuidados com a pele oleosa. Não comprova a eficácia de um produto específico.",
  },
};
export const button = (text, action, variant = "secondary", attrs = "") =>
  `<button type="button" class="sx-button sx-${variant}" data-action="${action}" ${attrs}>${text}</button>`;

/** Pure component templates shared by the app and isolated catalogs. */
export function createExperienceComponents({
  state,
  isPending = () => false,
  isPhotoPending = () => false,
}) {
  function photoMarkup() {
    if (isPhotoPending()) return '<p class="sx-file-note">Preparando foto…</p>';
    if (!state.photoName) return "";
    const controls = `<div class="sx-file">${safePhoto(state.photoDataUrl) ? `<img src="${state.photoDataUrl}" alt="Sua foto anexada">` : icon("image")}<span>${esc(state.photoName)}<small>${state.photoDataUrl ? "Foto guardada nesta conversa" : "Selecione a foto novamente para enviar à IA"}</small></span>${button(icon("x") + '<span class="sr-only">Remover foto</span>', "remove-photo", "icon")}</div>${state.photoDataUrl ? `<label class="sx-consent"><input type="checkbox" data-photo-consent ${state.photoConsent ? "checked" : ""}> Autorizo enviar esta foto à OpenAI para conversar sobre ela e, quando eu pedir, criar uma simulação ilustrativa.</label><div class="sx-photo-actions">${button(icon("scan") + " Analisar minha foto", "analyze-photo", "primary", isPending() ? "disabled" : "")}${button("Criar ilustração", "simulate", "text", isPending() ? "disabled" : "")}</div>` : ""}`;
    return state.photoSubmitted && state.photoConsent
      ? `<details class="sx-attached-details"><summary>${icon("image")} Foto na conversa · envio autorizado</summary>${controls}</details>`
      : controls;
  }
  function message(m, active) {
    const welcome =
      m.role === "assistant" && !state.messages.some((x) => x.role === "user");
    let content = "";
    if (m.kind === "review")
      content = review(
        m.snapshot || state.context,
        active,
        m.contextOrigins || {},
      );
    if (m.kind === "routine")
      content = routine(
        m.routine || state.routine,
        m.snapshot || state.context,
      );
    if (m.kind === "source") content = sourceCard(m);
    if (m.kind === "comparison")
      content = comparison(m.routine || state.routine);
    if (m.kind === "cart") content = cart(m.routine || state.routine, active);
    if (m.kind === "checkout") content = checkout(m);
    if (m.kind === "checkin")
      content = `<div class="sx-chip-row">${["Consegui manter", "Preciso simplificar", "Quero rever o custo", "Ainda não comecei"].map((x) => reply(x, x, active)).join("")}</div>`;
    if (m.kind === "privacy")
      content = `<div class="sx-card"><h3>Você controla o que compartilha</h3><p>As conversas e imagens são salvas neste navegador, para você retomá-las pela lateral. No modo com OpenAI, o histórico recente é enviado ao servidor para gerar cada resposta. A foto só é enviada com sua autorização. Ao ativar o microfone, o áudio é enviado à OpenAI para transcrição. O SkinBoost guarda o texto revisável, sem salvar a gravação. Feedbacks ficam locais e não treinam o modelo. Não há conta nem sincronização de conversas entre dispositivos nesta prévia.</p><p>A OpenAI processa os dados conforme suas políticas. Você pode excluir uma conversa na lateral ou apagar todo o histórico abaixo. A exclusão local não equivale à exclusão nos sistemas do provedor.</p><a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener">Política de privacidade da OpenAI ${icon("arrow-up-right")}</a>${button("Apagar todas as conversas deste navegador", "clear-sessions", "secondary")}</div>`;
    if (m.kind === "alternative")
      content = `<div class="sx-card sx-inherited"><span class="sx-card-eyebrow">UM NOVO CAMINHO, COM SEU CONTEXTO</span><p>O que você contou sobre sua pele continua disponível. A foto precisa de uma nova autorização. Revise o pedido no campo abaixo antes de enviar.</p>${button("Conferir respostas aproveitadas", "context", "secondary")}</div>`;
    if (m.kind === "note")
      content = `<div class="sx-card"><span class="sx-card-eyebrow">SEU RESUMO · REVISÁVEL</span><pre class="sx-note-text">${esc(m.note)}</pre>${button("Copiar resumo", "copy-note", "secondary", `data-message-id="${esc(m.id)}"`)}<small class="sx-copy-status" role="status"></small></div>`;
    if (m.kind === "partial")
      content +=
        '<small class="sx-evidence-note">Resposta interrompida · conteúdo incompleto, confira antes de usar.</small>';
    if (m.contextChanges?.length)
      content =
        `<div class="sx-context-diff"><span>${icon("pencil-simple")} O que mudou</span>${m.contextChanges.map((c) => `<p><strong>${fields[c.key]}</strong><s>${esc(c.before)}</s><b>${esc(c.after)}</b></p>`).join("")}<small>As outras respostas foram preservadas.</small></div>` +
        content;
    if (m.kind === "simulation")
      content = renderPhotoComparison(m, {
        canCheckout: !m.inherited && state.step !== "care",
      });
    content += renderPhotoEvidence(m, {
      canSimulate:
        active &&
        !isPending() &&
        !!state.photoDataUrl &&
        !!state.photoConsent &&
        state.step !== "care",
    });
    if (m.inherited)
      content = content.replaceAll(
        "<button ",
        '<button disabled aria-disabled="true" ',
      );
    const choices =
      m.choices?.length && active && !isPending() && !m.inherited
        ? `<div class="sx-chip-row">${m.choices.map((c) => reply(c.label, c.value, true)).join("")}</div>`
        : "";
    return `<article class="sx-message sx-${m.role}" data-message-id="${esc(m.id)}" data-role="${m.role}" aria-label="${m.role === "user" ? "Você" : "SkinBoost · assistente de IA"}">${m.role === "assistant" ? `<span class="sx-avatar">${icon("sparkle")}</span>` : ""}<div class="sx-message-body">${welcome ? `<div class="sx-welcome-kicker">SEU CUIDADO, EM CONVERSA</div><h1>Vamos entender<br>o que sua pele precisa?</h1>` : ""}${safePhoto(m.photo) ? `<figure class="sx-message-photo"><img src="${m.photo}" alt="Foto que você enviou para esta conversa"><figcaption>Sua foto · enviada com autorização</figcaption></figure>` : ""}${m.text ? `<div class="sx-message-text">${esc(m.text)}</div>` : ""}${content}${choices}${m.role === "assistant" && !welcome && m.kind !== "partial" && !m.inherited ? `<div class="sx-response-tools">${button(icon("thumbs-up") + '<span class="sr-only">Esta resposta ajudou</span>', "helpful", "icon", `data-message-id="${esc(m.id)}" aria-pressed="${m.feedback?.reason === "Ajudou"}"`)}${button(icon("chat-centered-dots") + "Sinalizar um problema", "feedback", "text", `data-message-id="${esc(m.id)}"`)}${active && state.context.intent ? button(icon("path") + "Explorar outra opção", "alternative", "text") : ""}${m.feedback ? "<small>Feedback salvo nesta conversa</small>" : ""}</div>` : ""}</div></article>`;
  }
  const reply = (label, value, active = true) =>
    `<button type="button" class="sx-reply" data-reply="${esc(value)}" ${!active || isPending() ? "disabled" : ""}>${esc(label)}${icon("arrow-up-left")}</button>`;
  function review(context, active = true, origins = {}) {
    return `<div class="sx-card sx-context-card"><div class="sx-card-eyebrow">${icon("notebook")} O QUE ENTENDI ATÉ AQUI</div><dl>${Object.entries(
      fields,
    )
      .filter(([k]) => context[k])
      .map(
        ([k, v]) =>
          `<div><dt>${v}</dt><dd>${esc(context[k])}${origins[k] ? `<details class="sx-origin"><summary>Ver de onde veio</summary><blockquote>${esc(origins[k].text)}</blockquote><small>Interpretado da sua mensagem. Você pode corrigir.</small></details>` : ""}</dd><dd>${button("Editar", "edit", "text", `data-key="${k}"`)}</dd></div>`,
      )
      .join(
        "",
      )}</dl><p class="sx-footnote">Este resumo interpreta suas respostas. Confira e corrija qualquer detalhe antes de explorar uma rotina.</p>${button("Guardar um resumo", "note", "text")}${button("Sobre seus dados", "privacy", "text")}${active ? button("É isso, pode montar minha rotina " + icon("arrow-right"), "confirm", "primary") : ""}</div>`;
  }
  function routine(r, context = {}) {
    if (!r) return "";
    return `<div class="sx-card sx-routine"><div class="sx-card-eyebrow">${icon("sparkle")} UM PONTO DE PARTIDA PARA VOCÊ</div><h2>Cuidado com um porquê.</h2><p>${esc(r.explanation || "Uma seleção explicada a partir do que você contou.")}</p><div class="sx-context-tags">${[
      context.goal,
      context.approach,
      context.budget,
    ]
      .filter(Boolean)
      .map((v) => `<span>${esc(v)}</span>`)
      .join(
        "",
      )}</div><figure class="sx-family"><img src="/media/produtos-skinboost.png" alt="Embalagens conceituais SkinBoost Cleanse, Balance e Comfort"><figcaption>Linha conceitual · ainda sem fórmula ou eficácia validadas</figcaption></figure>${r.products.map((p, i) => `<article class="sx-product"><div class="sx-product-number">${i + 1}</div><div class="sx-product-copy"><span class="sx-kicker">${esc(p.category)} · ${esc(p.volume)}</span><h3>${esc(p.name)}</h3><p>${esc(p.reason)}</p>${button("Por que este produto? " + icon("arrow-up-right"), "source", "text", `data-product-id="${p.id}"`)}</div><strong>${money(p.price)}</strong></article>`).join("")}<div class="sx-cost"><span>Total ilustrativo<strong>${money(r.subtotal)}</strong></span>${button("Comparar valores", "compare", "text")}</div><div class="sx-meter"><span style="width:${r.budgetValue > 0 ? Math.min(100, (r.subtotal / r.budgetValue) * 100) : 0}%"></span></div><p class="sx-footnote">${r.budgetValue > 0 ? `${money(r.subtotal)} de ${money(r.budgetValue)} informados. ` : ""}Valores fictícios. Não são uma oferta de compra.</p><div class="sx-actions">${r.products.length ? button("Revisar produtos " + icon("arrow-right"), "cart", "primary") : ""}${button("Fontes e limites", "source", "secondary", `data-product-id="${context.scenario === "oiliness" ? "aad-oily" : "aad-acne"}"`)}</div></div><div class="sx-refine"><span>Podemos ajustar juntos.</span><div class="sx-chip-row">${reply("Quero gastar menos", "Quero gastar menos")}${reply("Prefiro menos passos", "Prefiro menos passos")}${button("Fazer um check-in", "checkin", "text")}</div></div><div class="sx-card sx-visual-invite"><span class="sx-card-eyebrow">${icon("image")} EXPLORAR UMA POSSIBILIDADE VISUAL</span><h3>E se você pudesse visualizar uma ideia?</h3><p>Uma ilustração com sua foto para conversar sobre aparência. Não prevê o efeito do produto, nem remoção de acne ou cicatrizes.</p>${button("Criar simulação ilustrativa " + icon("sparkle"), "simulate", "secondary")}</div>`;
  }
  function sourceCard(m) {
    const educational = sources[m.productId];
    if (educational)
      return `<div class="sx-card sx-source-card"><span class="sx-card-eyebrow">FONTE EDUCATIVA</span><h3>${educational.name}</h3><p>${educational.text}</p><a href="${educational.url}" target="_blank" rel="noopener">Ler a orientação original ${icon("arrow-up-right")}</a><div class="sx-evidence-note">Não é evidência de eficácia do catálogo SkinBoost.</div></div>`;
    const p = CATALOG.find((x) => x.id === m.productId) || CATALOG[0];
    return `<div class="sx-card sx-source-card"><span class="sx-card-eyebrow">ESCOLHA EXPLICADA · ${esc(p.name)}</span><h3>O que sustenta esta sugestão?</h3><dl><div><dt>Seu contexto</dt><dd>${esc((m.routine || state.routine)?.products.find((x) => x.id === p.id)?.reason || "Exploração do catálogo conceitual.")}</dd></div><div><dt>Fonte do produto</dt><dd>${esc(p.source?.detail || "Catálogo conceitual SkinBoost.")}</dd></div><div><dt>Ainda não comprovado</dt><dd>Fórmula, tolerância, eficácia, preço comercial e adequação à sua pele.</dd></div></dl><p>Uma foto e uma conversa não provam que este é o melhor produto para você.</p><a href="/brandbook.html" target="_blank" rel="noopener">Ver a origem do conceito ${icon("arrow-up-right")}</a></div>`;
  }
  function comparison(r) {
    if (!r) return "";
    const max = Math.max(r.comparisonTotal, r.subtotal, 1);
    return `<div class="sx-card"><div class="sx-card-eyebrow">A CONTA ABERTA</div><h3>Mesmos itens, dois valores fictícios.</h3><div class="sx-bars" role="img" aria-label="Referência fictícia ${money(r.comparisonTotal)}, seleção ${money(r.subtotal)}">${[
      ["Referência fictícia", r.comparisonTotal],
      ["Sua seleção fictícia", r.subtotal],
    ]
      .map(
        ([name, value]) =>
          `<div><div class="sx-bar-label"><span>${name}</span><strong>${money(value)}</strong></div><div class="sx-bar-track"><span style="width:${(value / max) * 100}%"></span></div></div>`,
      )
      .join(
        "",
      )}</div><div class="sx-table-wrap"><table class="sx-comparison-table"><caption>Valores fictícios por embalagem · mesmos produtos</caption><thead><tr><th>Produto</th><th>Referência</th><th>Seleção</th></tr></thead><tbody>${r.products.map((p) => `<tr><th scope="row">${esc(p.name)}</th><td>${money(CATALOG.find((item) => item.id === p.id)?.referencePrice || p.price)}</td><td>${money(p.price)}</td></tr>`).join("")}</tbody></table></div><div class="sx-cost"><span>Diferença neste exemplo<strong>${money(r.savings)}</strong></span></div><p class="sx-footnote">Comparação didática por embalagem. Não representa economia real de mercado nem custo mensal.</p>${button("Revisar produtos", "cart", "primary")}</div>`;
  }
  function cart(r, active) {
    if (!r) return "";
    return `<div class="sx-card"><div class="sx-card-eyebrow">VOCÊ DECIDE</div><h3>Só o que faz sentido para você.</h3>${r.products.map((p) => `<label class="sx-cart-item"><input type="checkbox" data-cart-item value="${p.id}" ${state.selected.includes(p.id) ? "checked" : ""} ${!active ? "disabled" : ""}><span><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${esc(p.volume)}</small></span><strong>${money(p.price)}</strong></label>`).join("")}<div class="sx-cost"><span>Total ilustrativo<strong data-cart-total>${money(r.products.filter((p) => state.selected.includes(p.id)).reduce((n, p) => n + p.price, 0))}</strong></span></div>${active ? button("Ir para checkout demonstrativo " + icon("arrow-right"), "checkout", "primary", state.selected.length ? "" : "disabled") : ""}<p class="sx-footnote">Demonstração sem pagamento ou envio de pedido.</p></div>`;
  }
  function checkout(m) {
    const r = m.routine || state.routine;
    const selected = m.snapshot?.selected || m.selected || state.selected;
    const products = r?.products.filter((p) => selected.includes(p.id)) || [];
    return `<div class="sx-card sx-checkout"><span class="sx-mini-orbit">${icon("bag")}</span><h3>Seleção revisada.</h3><p>${products.map((p) => esc(p.name)).join(" + ") || "Nenhum produto selecionado"}</p><strong>${money(products.reduce((n, p) => n + p.price, 0))}</strong><p>Checkout demonstrativo. Nenhuma compra foi realizada.</p>${products.length && !m.inherited && state.step !== "care" ? `<a class="sx-button sx-primary" data-example-checkout href="${CHECKOUT_EXAMPLE_URL}" target="_blank" rel="noopener noreferrer">Continuar para compra ${icon("arrow-up-right")}<span class="sr-only"> — checkout de exemplo, abre em nova aba</span></a><small>Checkout de exemplo da Design Engineer. Não é uma oferta de produtos SkinBoost.</small>` : ""}${button("Continuar a conversa", "checkin", "secondary")}</div>`;
  }
  return {
    photoMarkup,
    message,
    reply,
    review,
    routine,
    sourceCard,
    comparison,
    cart,
    checkout,
  };
}

export function renderSidebar(options = {}) {
  return `<aside class="sx-sidebar"><a class="sx-wordmark" href="/wireframe" data-action="home">skinboost<span>®</span></a>${button(icon("plus") + " Nova conversa", "reset", "new")}<div class="sx-sidebar-label">CONVERSAS SALVAS</div><nav class="sx-session-list" data-session-list aria-label="Conversas salvas"></nav><div class="sx-session" data-current-session>${icon("chat-circle-text")}<span data-session-title>Seu próximo cuidado</span></div><div class="sx-sidebar-bottom"><span class="sx-mini-orbit">${icon("sparkle")}</span><p>Boas escolhas<br>começam com uma<br><strong>boa conversa.</strong></p>${button(icon("shield-check") + " Sobre seus dados", "privacy", "text")}<a href="/guia.html" target="_blank" rel="noopener">Conheça a experiência ${icon("arrow-up-right")}</a></div></aside>`;
}

export function renderTopbar(options = {}) {
  return `<header class="sx-top"><div>${button(icon("sidebar-simple") + '<span class="sr-only">Conversas salvas</span>', "history", "icon sx-mobile-only")}<a href="/wireframe" data-action="home" class="sx-mobile-brand">skinboost<span>®</span></a><span class="sx-top-title">Sua conversa</span><span class="sx-mode" data-mode>Preparando…</span></div><div class="sx-top-actions">${button(icon("path") + '<span class="sx-hide-small">Outra opção</span>', "alternative", "text", 'aria-label="Explorar outra opção" data-alternative-control')}${button(icon("notebook") + '<span class="sx-hide-small">Seu contexto</span>', "context", "text", 'aria-label="Seu contexto"')}${button(icon("plus") + '<span class="sr-only">Nova conversa</span>', "reset", "icon sx-mobile-only")}${options.onClose ? button(icon("x") + '<span class="sr-only">Fechar experiência</span>', "close", "icon") : ""}</div></header>`;
}

export function renderComposer(options = {}) {
  return `<div class="sx-dock"><div class="sx-voice-status" role="status" data-voice-status hidden></div><div class="sx-error" role="alert" data-error hidden></div><form data-form="message" class="sx-composer"><div data-file></div><label class="sr-only" for="sx-message">Sua mensagem</label><textarea id="sx-message" rows="1" maxlength="2000" placeholder="Conte o que sua pele precisa…"></textarea><div class="sx-composer-tools"><label class="sx-attach" title="Adicionar foto">${icon("plus")}<span>Foto</span><input class="sr-only" type="file" data-photo accept="image/jpeg,image/png,image/webp"></label><span class="sx-composer-caption" data-save-status>No seu tempo. Do seu jeito.</span><button type="button" class="sx-mic" data-action="voice" aria-label="Ditar mensagem" title="Ditar mensagem">${icon("microphone")}</button><button type="submit" class="sx-send" aria-label="Enviar mensagem">${icon("arrow-up")}</button></div></form><p class="sx-disclaimer" data-disclaimer></p></div>`;
}

export function renderAlternatives(state) {
  return `<p>Uma nova conversa começa com suas respostas atuais. A original fica guardada para você comparar depois.</p><div class="sx-alternative-options">${ALTERNATIVES.map((option) => `<button type="button" data-action="new-alternative" data-choice="${option.id}"><span>${icon(option.id === "budget" ? "wallet" : option.id === "simple" ? "leaf" : option.id === "focus" ? "target" : "path")}</span><span><strong>${option.label}</strong><small>${option.description}</small></span>${icon("arrow-right")}</button>`).join("")}</div><p class="sx-footnote">Se houver uma foto, você autoriza novamente antes de enviá-la à IA.</p>`;
}

export function renderVerification(state) {
  return `<p>A IA pode entender algo errado ou apresentar uma informação imprecisa. Você tem como revisar cada parte.</p><div class="sx-verify-list"><article><span>01</span><div><h3>Confira o que foi entendido</h3><p>Objetivo, cuidados atuais e orçamento vieram da sua conversa. Veja a mensagem de origem e ajuste o resumo.</p>${button("Revisar meu contexto", "context", "secondary")}</div></article><article><span>02</span><div><h3>Abra as fontes e os critérios</h3><p>Orientações gerais não são estudos do catálogo SkinBoost. Confira o que cada referência sustenta.</p>${button("Ler fontes e limites", "sources-panel", "secondary")}</div></article><article><span>03</span><div><h3>Corrija ou siga por outro caminho</h3><p>Sinalize um problema na resposta ou explore outra opção preservando a conversa original.</p>${button("Explorar outra opção", "alternative", "secondary", state.context.intent ? "" : "disabled")}</div></article></div><div class="sx-evidence-note">Esta experiência organiza cuidados educativos. Não diagnostica, não prescreve e não prevê resultados de produtos. Se uma questão de pele precisa de avaliação, procure um profissional qualificado.</div>`;
}

export function renderSources(state) {
  return `<p>São três coisas diferentes: o que você contou, uma orientação educativa e um produto do catálogo demonstrativo.</p><div class="sx-source-links">${Object.values(
    sources,
  )
    .map(
      (source) =>
        `<article><h3>${source.name}</h3><p>${source.text}</p><a href="${source.url}" target="_blank" rel="noopener">Conferir na fonte ${icon("arrow-up-right")}</a></article>`,
    )
    .join(
      "",
    )}</div><div class="sx-evidence-note">Os produtos SkinBoost ainda não têm fórmula ou estudos validados nesta prévia. Não existe nota de eficácia, previsão de rejuvenescimento ou prova clínica gerada a partir da sua foto.</div>`;
}

export function renderVoiceConsent() {
  return `<span class="sx-voice-orbit">${icon("microphone")}</span><p>Sua fala aparece como texto no campo da mensagem. Você pode revisar e editar antes de enviar.</p><p class="sx-footnote">Ao ativar, seu áudio é enviado à OpenAI para transcrição. O SkinBoost salva o texto neste navegador, sem guardar a gravação. O ditado para ao sair desta conversa ou colocar a página em segundo plano.</p>${button("Ativar microfone", "voice-start", "primary")}${button("Continuar digitando", "close-panel", "text")}`;
}

export function renderFeedbackOptions(messageId) {
  return `<p>Sua avaliação fica nesta conversa, neste navegador. Ela não é enviada à equipe nem usada para treinar o modelo.</p><div class="sx-feedback-options">${["Não entendeu meu pedido", "Informação parece incorreta", "Explicação confusa", "Fonte insuficiente"].map((reason) => button(reason, "feedback-save", "secondary", `data-reason="${esc(reason)}" data-message-id="${esc(messageId)}"`)).join("")}</div>`;
}

export function renderSessions(sessions, currentId) {
  return sessions
    .map(
      (session) =>
        `<div class="sx-saved-row ${session.id === currentId ? "is-active" : ""}"><button type="button" data-action="session" data-session-id="${esc(session.id)}" ${session.id === currentId ? 'aria-current="true"' : ""}>${icon("chat-circle-text")}<span><strong>${esc(session.title)}</strong><small>${new Date(session.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small></span></button><button type="button" data-action="delete-session" data-session-id="${esc(session.id)}" aria-label="Excluir conversa ${esc(session.title)}">${icon("trash")}</button></div>`,
    )
    .join("");
}

export function renderThinking(state, mode = "demo") {
  const streaming = state.streamText
    ? `<div class="sx-message-text" aria-live="off">${esc(state.streamText)}</div><small class="sx-thinking-label">Resposta em andamento · ainda não terminou</small>`
    : "";
  return `<article class="sx-message sx-assistant sx-thinking" data-message-id="pending-response" aria-label="SkinBoost · resposta em andamento"><span class="sx-avatar">${icon("sparkle")}</span><div>${streaming || `<span class="sx-typing"><b></b><b></b><b></b></span><span class="sx-thinking-label">${state.generatingImage ? "Criando uma ilustração. Pode levar alguns minutos…" : mode === "live" ? (state.failedAnalyzePhoto ? "Observando sua foto e conferindo as fontes…" : "SkinBoost está preparando a resposta…") : "Preparando o próximo passo…"}</span>`}</div></article>`;
}

export const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  kind: "question",
  text: "Conte o que incomoda ou o que você gostaria de cuidar. A gente vai entendendo junto, uma conversa de cada vez.",
  choices: [
    { label: "Quero cuidar da acne", value: "Quero cuidar da acne" },
    { label: "Minha pele está oleosa", value: "Minha pele está oleosa" },
    {
      label: "Quero uma rotina de cuidado",
      value: "Quero uma rotina de cuidado",
    },
  ],
};
