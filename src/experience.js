import "./experience.css";
import { CATALOG, validatePhoto, formatMoney } from "./routine.js";
import {
  createThreadState,
  createThreadFixture,
  sendMessage,
  act,
  appendUserMessage,
  acceptAssistantResponse,
} from "./chat/thread-state.js";
import { preparePhoto } from "./chat/photo.js";
import { createVoiceInput } from "./chat/voice-input.js";
import { readChatResponse } from "./chat/response-stream.js";
import {
  ALTERNATIVES,
  createAlternative,
  recordContextChanges,
  makeConversationNote,
} from "./chat/conversation-tools.js";
export const createExperienceState = createThreadState;
const esc = (v = "") =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
const money = formatMoney;
const fields = {
  intent: "Seu pedido",
  detail: "O que incomoda",
  duration: "Há quanto tempo",
  existing: "O que já usa",
  sensitivity: "Cuidados e restrições",
  approach: "Seu ritmo",
  budget: "Seu orçamento",
};
const sources = {
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
const button = (text, action, variant = "secondary", attrs = "") =>
  `<button type="button" class="sx-button sx-${variant}" data-action="${action}" ${attrs}>${text}</button>`;

/** One conversation renderer shared by /chat and both component catalogs. */
export function mountExperience(element, options = {}) {
  const state =
    options.state ||
    (options.initialStep && options.initialStep !== "welcome"
      ? createThreadFixture(options.initialStep, options.scenario || "general")
      : createThreadState());
  let disposed = false,
    pending = false,
    controller = null,
    statusError = "",
    photoPending = false,
    epoch = 0;
  let mode = options.liveApi ? "checking" : "demo";
  let voiceStatus = "idle",
    voiceConsent = false,
    voice,
    panelReturnFocus;
  let followLatest = true,
    unseenMessages = false;
  const voiceBusy = () =>
    ["requesting", "connecting", "listening", "stopping"].includes(voiceStatus);
  const local = (q) => element.querySelector(q);
  const update = (next) => {
    for (const key of Object.keys(state))
      if (!Object.hasOwn(next, key)) delete state[key];
    Object.assign(state, next);
    options.onChange?.(state);
  };
  const id = () => `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const append = (role, text, kind = "text", extra = {}) =>
    state.messages.push({ id: id(), role, text, kind, ...extra });
  if (!state.messages.length)
    state.messages.push({
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
    });
  element.classList.add("sb-experience");
  element.innerHTML = `<aside class="sx-sidebar"><a class="sx-wordmark" href="/" data-action="home">skinboost<span>®</span></a>${button(icon("plus") + " Nova conversa", "reset", "new")}<div class="sx-sidebar-label">CONVERSAS SALVAS</div><nav class="sx-session-list" data-session-list aria-label="Conversas salvas"></nav><div class="sx-session" data-current-session>${icon("chat-circle-text")}<span data-session-title>Seu próximo cuidado</span></div><div class="sx-sidebar-bottom"><span class="sx-mini-orbit">${icon("sparkle")}</span><p>Boas escolhas<br>começam com uma<br><strong>boa conversa.</strong></p>${button(icon("shield-check") + " Sobre seus dados", "privacy", "text")}<a href="/guia.html" target="_blank" rel="noopener">Conheça a experiência ${icon("arrow-up-right")}</a></div></aside><button class="sx-history-scrim" data-action="close-history" aria-label="Fechar histórico"></button><div class="sx-chat"><header class="sx-top"><div>${button(icon("sidebar-simple") + '<span class="sr-only">Conversas salvas</span>', "history", "icon sx-mobile-only")}<a href="/" data-action="home" class="sx-mobile-brand">skinboost<span>®</span></a><span class="sx-top-title">Sua conversa</span><span class="sx-mode" data-mode>Preparando…</span></div><div class="sx-top-actions">${button(icon("path") + '<span class="sx-hide-small">Outra opção</span>', "alternative", "text", 'aria-label="Explorar outra opção" data-alternative-control')}${button(icon("notebook") + '<span class="sx-hide-small">Seu contexto</span>', "context", "text", 'aria-label="Seu contexto"')}${button(icon("plus") + '<span class="sr-only">Nova conversa</span>', "reset", "icon sx-mobile-only")}${options.onClose ? button(icon("x") + '<span class="sr-only">Fechar experiência</span>', "close", "icon") : ""}</div></header><div data-branch-banner></div><div class="sx-scroll"><section class="sx-thread" role="log" aria-label="Conversa com SkinBoost" aria-live="polite" aria-relevant="additions text"></section></div><button type="button" class="sx-new-messages" data-action="latest" hidden>Ver mensagem mais recente ↓</button><div class="sx-dock"><div class="sx-voice-status" role="status" data-voice-status hidden></div><div class="sx-error" role="alert" data-error hidden></div><form data-form="message" class="sx-composer"><div data-file></div><label class="sr-only" for="sx-message">Sua mensagem</label><textarea id="sx-message" rows="1" maxlength="2000" placeholder="Conte o que sua pele precisa…"></textarea><div class="sx-composer-tools"><label class="sx-attach" title="Adicionar foto">${icon("plus")}<span>Foto</span><input class="sr-only" type="file" data-photo accept="image/jpeg,image/png,image/webp"></label><span class="sx-composer-caption" data-save-status>No seu tempo. Do seu jeito.</span><button type="button" class="sx-mic" data-action="voice" aria-label="Ditar mensagem" title="Ditar mensagem">${icon("microphone")}</button><button type="submit" class="sx-send" aria-label="Enviar mensagem">${icon("arrow-up")}</button></div></form><p class="sx-disclaimer" data-disclaimer></p></div></div><dialog class="sx-dialog" aria-labelledby="sx-dialog-title"><div data-dialog-body></div></dialog>`;
  const thread = local(".sx-thread"),
    scroll = local(".sx-scroll"),
    input = local("#sx-message");
  input.value = state.draft || "";
  const dialog = local(".sx-dialog");
  function openPanel(title, body) {
    panelReturnFocus = document.activeElement;
    local("[data-dialog-body]").innerHTML =
      `<header><h2 id="sx-dialog-title">${title}</h2>${button(icon("x"), "close-panel", "icon", 'aria-label="Fechar painel"')}</header>${body}`;
    if (!dialog.open) dialog.showModal();
  }
  function closePanel() {
    dialog.close();
    panelReturnFocus?.focus?.({ preventScroll: true });
  }
  function saveStatus() {
    const caption = local("[data-save-status]");
    if (caption)
      caption.textContent =
        options.getSaveStatus?.() || "No seu tempo. Do seu jeito.";
  }
  function renderVoice() {
    if (disposed) return;
    const labels = {
      requesting: "Aguardando acesso ao microfone…",
      connecting: "Conectando a transcrição…",
      listening: "Ouvindo e transcrevendo…",
      stopping: "Concluindo a transcrição…",
    };
    const status = local("[data-voice-status]");
    status.hidden = !voiceBusy();
    status.innerHTML = voiceBusy()
      ? `<span class="sx-recording-dot"></span><span>${labels[voiceStatus]}<small>O texto fica no rascunho. Revise antes de enviar.</small></span>${button(voiceStatus === "listening" ? "Concluir" : "Cancelar", voiceStatus === "listening" ? "voice-stop" : "voice-cancel", "text")}`
      : "";
    const mic = local(".sx-mic");
    mic.classList.toggle("is-recording", voiceBusy());
    mic.innerHTML = icon(voiceBusy() ? "stop" : "microphone");
    mic.setAttribute(
      "aria-label",
      voiceBusy() ? "Concluir ditado" : "Ditar mensagem",
    );
    mic.setAttribute("aria-pressed", String(voiceBusy()));
    mic.disabled = pending || photoPending || mode === "checking";
    local(".sx-send").disabled =
      !pending && (photoPending || mode === "checking" || voiceBusy());
    saveStatus();
  }
  voice = (options.voiceFactory || createVoiceInput)({
    getDraft: () => state.draft || "",
    onDraft: (text) => {
      if (disposed) return;
      state.draft = text;
      input.value = text;
      resizeInput();
      options.onChange?.(state);
      saveStatus();
    },
    onState: ({ status }) => {
      voiceStatus = status;
      renderVoice();
    },
    onError: (message) => {
      if (disposed) return;
      state.error = message;
      render({ scrollToEnd: false });
    },
    maxChars: 2000,
  });
  function onScroll() {
    followLatest =
      scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100;
    if (followLatest) {
      unseenMessages = false;
      local(".sx-new-messages").hidden = true;
    }
  }
  scroll.addEventListener("scroll", onScroll, { passive: true });

  function renderSessions() {
    const sessions = options.getSessions?.() || [];
    const nav = local("[data-session-list]");
    nav.innerHTML = sessions
      .map(
        (session) =>
          `<div class="sx-saved-row ${session.id === options.getSessionId?.() ? "is-active" : ""}"><button type="button" data-action="session" data-session-id="${esc(session.id)}" ${session.id === options.getSessionId?.() ? 'aria-current="true"' : ""}>${icon("chat-circle-text")}<span><strong>${esc(session.title)}</strong><small>${new Date(session.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small></span></button><button type="button" data-action="delete-session" data-session-id="${esc(session.id)}" aria-label="Excluir conversa ${esc(session.title)}">${icon("trash")}</button></div>`,
      )
      .join("");
    local("[data-current-session]").hidden = sessions.some(
      (session) => session.id === options.getSessionId?.(),
    );
  }
  function render({ scrollToEnd = true } = {}) {
    if (disposed) return;
    renderSessions();
    options.onChange?.(state);
    const nearEnd = followLatest;
    const last = state.messages.at(-1);
    const streaming = state.streamText
      ? `<div class="sx-message-text" aria-live="off">${esc(state.streamText)}</div><small class="sx-thinking-label">Resposta em andamento · ainda não terminou</small>`
      : "";
    const markup =
      state.messages.map((m) => message(m, m === last)).join("") +
      (pending
        ? `<article class="sx-message sx-assistant sx-thinking" data-message-id="pending-response" aria-label="SkinBoost · resposta em andamento"><span class="sx-avatar">${icon("sparkle")}</span><div>${streaming || `<span class="sx-typing"><b></b><b></b><b></b></span><span class="sx-thinking-label">${state.generatingImage ? "Criando uma ilustração. Pode levar alguns minutos…" : mode === "live" ? "SkinBoost está preparando a resposta…" : "Preparando o próximo passo…"}</span>`}</div></article>`
        : "");
    // Keep existing message nodes stable; animate only genuinely new messages.
    const template = document.createElement("template");
    template.innerHTML = markup;
    const kept = new Set();
    for (const fresh of [...template.content.children]) {
      const existing = fresh.dataset.messageId
        ? [...thread.children].find(
            (node) => node.dataset.messageId === fresh.dataset.messageId,
          )
        : null;
      if (existing) {
        if (existing.innerHTML !== fresh.innerHTML)
          existing.innerHTML = fresh.innerHTML;
        kept.add(existing);
      } else {
        thread.append(fresh);
        kept.add(fresh);
      }
    }
    for (const node of [...thread.children]) if (!kept.has(node)) node.remove();
    thread.classList.toggle(
      "sx-empty",
      !state.messages.some((m) => m.role === "user"),
    );
    local("[data-session-title]").textContent = state.context.intent
      ? state.context.intent.slice(0, 58)
      : "Seu próximo cuidado";
    local("[data-mode]").textContent =
      mode === "live"
        ? "Com OpenAI"
        : mode === "checking"
          ? "Conectando…"
          : "Demonstração";
    local("[data-disclaimer]").innerHTML =
      `A IA pode cometer erros. ${button("Confira as informações", "verify", "text")}`;
    local("[data-alternative-control]").hidden = !state.context.intent;
    local("[data-branch-banner]").innerHTML = state.branch
      ? `<div class="sx-branch-banner">${icon("path")}<span><strong>${esc(state.branch.choice)}</strong> · partiu de ${esc(state.branch.sourceTitle)}</span>${state.branch.sourceId ? button("Ver original", "parent-session", "text") : ""}</div>`
      : "";
    local("[data-file]").innerHTML = photoMarkup();
    local(".sx-send").disabled =
      !pending && (photoPending || mode === "checking" || voiceBusy());
    local(".sx-send").innerHTML = icon(pending ? "stop" : "arrow-up");
    local(".sx-send").setAttribute(
      "aria-label",
      pending ? "Parar resposta" : "Enviar mensagem",
    );
    renderVoice();
    local(".sx-send").setAttribute("aria-busy", String(pending));
    const error = state.error || statusError;
    local("[data-error]").hidden = !error;
    local("[data-error]").innerHTML = error
      ? esc(error) +
        (state.failedRequest ? button("Tentar novamente", "retry", "text") : "")
      : "";
    if (scrollToEnd && !nearEnd) {
      unseenMessages = true;
      local(".sx-new-messages").hidden = false;
    }
    if (scrollToEnd && nearEnd)
      requestAnimationFrame(() => {
        if (!disposed) scroll.scrollTop = scroll.scrollHeight;
      });
  }
  function photoMarkup() {
    if (photoPending) return '<p class="sx-file-note">Preparando foto…</p>';
    if (!state.photoName) return "";
    return `<div class="sx-file">${state.photoDataUrl ? `<img src="${state.photoDataUrl}" alt="Sua foto anexada">` : icon("image")}<span>${esc(state.photoName)}<small>${state.photoDataUrl ? "Foto disponível nesta sessão" : "Selecione a foto novamente para enviar à IA"}</small></span>${button(icon("x") + '<span class="sr-only">Remover foto</span>', "remove-photo", "icon")}</div>${state.photoDataUrl ? `<label class="sx-consent"><input type="checkbox" data-photo-consent ${state.photoConsent ? "checked" : ""}> Autorizo enviar esta foto à OpenAI para conversar sobre ela e, quando eu pedir, criar uma simulação ilustrativa.</label>${button("Criar ilustração com esta foto", "simulate", "text")}` : ""}`;
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
      content = `<figure class="sx-simulation"><div class="sx-image-pair"><div><img src="${m.original}" alt="Foto original enviada por você"><span>Foto original</span></div><div><img src="${m.image}" alt="Simulação visual ilustrativa gerada por inteligência artificial"><span>ILUSTRAÇÃO COM IA · NÃO É PREVISÃO</span></div></div><figcaption>Exercício visual sobre aparência, sem prazo ou resultado garantido. Não demonstra o efeito de nenhum produto nem mede melhora clínica.</figcaption></figure>`;
    if (m.inherited)
      content = content.replaceAll(
        "<button ",
        '<button disabled aria-disabled="true" ',
      );
    const choices =
      m.choices?.length && active && !pending && !m.inherited
        ? `<div class="sx-chip-row">${m.choices.map((c) => reply(c.label, c.value, true)).join("")}</div>`
        : "";
    return `<article class="sx-message sx-${m.role}" data-message-id="${esc(m.id)}" data-role="${m.role}" aria-label="${m.role === "user" ? "Você" : "SkinBoost · assistente de IA"}">${m.role === "assistant" ? `<span class="sx-avatar">${icon("sparkle")}</span>` : ""}<div class="sx-message-body">${welcome ? `<div class="sx-welcome-kicker">SEU CUIDADO, EM CONVERSA</div><h1>Vamos entender<br>o que sua pele precisa?</h1>` : ""}${m.text ? `<div class="sx-message-text">${esc(m.text)}</div>` : ""}${content}${choices}${m.role === "assistant" && !welcome && m.kind !== "partial" && !m.inherited ? `<div class="sx-response-tools">${button(icon("thumbs-up") + '<span class="sr-only">Esta resposta ajudou</span>', "helpful", "icon", `data-message-id="${esc(m.id)}" aria-pressed="${m.feedback?.reason === "Ajudou"}"`)}${button(icon("chat-centered-dots") + "Sinalizar um problema", "feedback", "text", `data-message-id="${esc(m.id)}"`)}${active && state.context.intent ? button(icon("path") + "Explorar outra opção", "alternative", "text") : ""}${m.feedback ? "<small>Feedback salvo nesta conversa</small>" : ""}</div>` : ""}</div></article>`;
  }
  const reply = (label, value, active = true) =>
    `<button type="button" class="sx-reply" data-reply="${esc(value)}" ${!active || pending ? "disabled" : ""}>${esc(label)}${icon("arrow-up-left")}</button>`;
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
    return `<div class="sx-card sx-checkout"><span class="sx-mini-orbit">${icon("bag")}</span><h3>Seleção revisada.</h3><p>${products.map((p) => esc(p.name)).join(" + ") || "Nenhum produto selecionado"}</p><strong>${money(products.reduce((n, p) => n + p.price, 0))}</strong><p>Checkout demonstrativo. Nenhuma compra foi realizada.</p>${button("Continuar a conversa", "checkin", "secondary")}</div>`;
  }
  function apiHistory() {
    const rows = state.messages
      .filter((m) => m.text)
      .slice(-36)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 3200) }));
    while (
      rows.length > 1 &&
      rows.reduce((sum, m) => sum + m.text.length, 0) > 26000
    )
      rows.shift();
    return rows;
  }
  async function submit(text, { preserveDraft = false, retry = false } = {}) {
    if (pending || mode === "checking" || voiceBusy()) return;
    text = String(text || "").trim();
    if (!text) {
      state.error = "Escreva uma mensagem para começarmos.";
      render({ scrollToEnd: false });
      input.focus();
      return;
    }
    followLatest = true;
    state.error = "";
    if (
      /simula[cç][aã]o|simular|ger(?:ar|e) (?:uma )?imagem|ver como.*ficar/i.test(
        text,
      ) &&
      !retry
    ) {
      if (!preserveDraft) {
        state.draft = "";
        input.value = "";
        resizeInput();
      }
      return simulate();
    }
    if (!preserveDraft) {
      state.draft = "";
      input.value = "";
      resizeInput();
    }
    const contextBefore = structuredClone(state.context);
    if (mode !== "live") {
      update(sendMessage(state, text));
      recordContextChanges(
        state,
        contextBefore,
        state.messages.findLast((m) => m.role === "user"),
      );
      render();
      return;
    }
    const draft = state.draft;
    if (!retry) update(appendUserMessage(state, text));
    state.failedText = text;
    const requestEpoch = ++epoch;
    if (preserveDraft) state.draft = draft;
    pending = true;
    state.requestKind = "chat";
    state.requestInterrupted = true;
    state.streamText = "";
    render();
    controller = new AbortController();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: apiHistory(),
          context: state.context,
          photoDataUrl: state.photoConsent ? state.photoDataUrl : undefined,
          photoConsent: !!state.photoConsent,
        }),
      });
      const result = await readChatResponse(response, {
        onDelta: (text) => {
          if (disposed || requestEpoch !== epoch) return;
          state.streamText = (state.streamText || "") + text;
          render();
        },
      });
      if (disposed || requestEpoch !== epoch) return;
      state.streamText = "";
      update(acceptAssistantResponse(state, result));
      recordContextChanges(
        state,
        contextBefore,
        state.messages.findLast((m) => m.role === "user"),
      );
      state.failedRequest = false;
      state.requestInterrupted = false;
    } catch (error) {
      if (requestEpoch === epoch && error.name !== "AbortError") {
        state.error =
          error instanceof TypeError
            ? "A conexão falhou. Sua mensagem continua aqui; tente novamente."
            : error.message;
        state.failedRequest = true;
        if (state.streamText) append("assistant", state.streamText, "partial");
        state.streamText = "";
      }
    } finally {
      if (requestEpoch === epoch) {
        pending = false;
        if (!disposed) render();
      }
    }
  }
  async function simulate() {
    if (pending) return;
    if (mode !== "live") {
      state.error =
        "A geração de imagens precisa da conexão com a OpenAI. O chat demonstrativo continua disponível.";
      render({ scrollToEnd: false });
      return;
    }
    if (!state.photoDataUrl) {
      state.error =
        "Adicione uma foto sua no campo da mensagem para criar a ilustração.";
      render({ scrollToEnd: false });
      local("[data-photo]").click();
      return;
    }
    if (!state.photoConsent) {
      state.error = "Autorize o envio da foto antes de criar a ilustração.";
      render({ scrollToEnd: false });
      local("[data-photo-consent]")?.focus();
      return;
    }
    const original = state.photoDataUrl;
    const requestEpoch = ++epoch;
    append(
      "user",
      "Quero criar uma simulação visual ilustrativa com minha foto.",
    );
    pending = true;
    state.generatingImage = true;
    state.requestKind = "image";
    state.requestInterrupted = true;
    state.error = "";
    render();
    controller = new AbortController();
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          photoDataUrl: original,
          consent: true,
          concern:
            state.context.detail || state.context.intent || "aparência da pele",
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || "Não foi possível criar a ilustração.",
        );
      if (!disposed && requestEpoch === epoch) {
        state.requestInterrupted = false;
        state.failedRequest = false;
        append(
          "assistant",
          "Aqui está uma possibilidade visual criada por IA. Ela não prevê como sua pele vai responder a um produto.",
          "simulation",
          { original, image: result.imageDataUrl },
        );
      }
    } catch (error) {
      if (requestEpoch === epoch && error.name !== "AbortError")
        state.error = error.message;
    } finally {
      if (requestEpoch === epoch) {
        pending = false;
        state.generatingImage = false;
        if (!disposed) render();
      }
    }
  }
  function stopResponse() {
    if (!pending) return;
    const imageRequest = state.generatingImage;
    epoch++;
    controller?.abort();
    pending = false;
    state.generatingImage = false;
    state.failedRequest = true;
    state.error = imageRequest
      ? "Parei de aguardar a imagem. O processamento já enviado ao provedor pode continuar. Você pode pedir uma nova tentativa."
      : "Resposta interrompida. Seu pedido e seu rascunho foram preservados.";
    if (state.streamText) append("assistant", state.streamText, "partial");
    state.streamText = "";
    render({ scrollToEnd: false });
  }
  function openAlternatives() {
    openPanel(
      "Vamos explorar outra opção?",
      `<p>Uma nova conversa começa com suas respostas atuais. A original fica guardada para você comparar depois.</p><div class="sx-alternative-options">${ALTERNATIVES.map((option) => `<button type="button" data-action="new-alternative" data-choice="${option.id}"><span>${icon(option.id === "budget" ? "wallet" : option.id === "simple" ? "leaf" : option.id === "focus" ? "target" : "path")}</span><span><strong>${option.label}</strong><small>${option.description}</small></span>${icon("arrow-right")}</button>`).join("")}</div><p class="sx-footnote">Se houver uma foto, você autoriza novamente antes de enviá-la à IA.</p>`,
    );
  }
  function openVerification() {
    openPanel(
      "Uma resposta boa também pode ser conferida.",
      `<p>A IA pode entender algo errado ou apresentar uma informação imprecisa. Você tem como revisar cada parte.</p><div class="sx-verify-list"><article><span>01</span><div><h3>Confira o que foi entendido</h3><p>Objetivo, cuidados atuais e orçamento vieram da sua conversa. Veja a mensagem de origem e ajuste o resumo.</p>${button("Revisar meu contexto", "context", "secondary")}</div></article><article><span>02</span><div><h3>Abra as fontes e os critérios</h3><p>Orientações gerais não são estudos do catálogo SkinBoost. Confira o que cada referência sustenta.</p>${button("Ler fontes e limites", "sources-panel", "secondary")}</div></article><article><span>03</span><div><h3>Corrija ou siga por outro caminho</h3><p>Sinalize um problema na resposta ou explore outra opção preservando a conversa original.</p>${button("Explorar outra opção", "alternative", "secondary", state.context.intent ? "" : "disabled")}</div></article></div><div class="sx-evidence-note">Esta experiência organiza cuidados educativos. Não diagnostica, não prescreve e não prevê resultados de produtos. Se uma questão de pele precisa de avaliação, procure um profissional qualificado.</div>`,
    );
  }
  function openSources() {
    openPanel(
      "Fontes, critérios e limites",
      `<p>São três coisas diferentes: o que você contou, uma orientação educativa e um produto do catálogo demonstrativo.</p><div class="sx-source-links">${Object.values(
        sources,
      )
        .map(
          (source) =>
            `<article><h3>${source.name}</h3><p>${source.text}</p><a href="${source.url}" target="_blank" rel="noopener">Conferir na fonte ${icon("arrow-up-right")}</a></article>`,
        )
        .join(
          "",
        )}</div><div class="sx-evidence-note">Os produtos SkinBoost ainda não têm fórmula ou estudos validados nesta prévia. Não existe nota de eficácia, previsão de rejuvenescimento ou prova clínica gerada a partir da sua foto.</div>`,
    );
  }
  async function onClick(event) {
    const target = event.target.closest("[data-action],[data-reply]");
    if (!target || !element.contains(target)) return;
    event.preventDefault();
    if (target.hasAttribute("data-reply"))
      return submit(target.dataset.reply, { preserveDraft: true });
    const action = target.dataset.action;
    if (action === "close-panel") {
      closePanel();
      return;
    }
    if (action === "latest") {
      followLatest = true;
      unseenMessages = false;
      local(".sx-new-messages").hidden = true;
      scroll.scrollTo({
        top: scroll.scrollHeight,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      return;
    }
    if (action === "voice-stop") {
      voice.stop();
      return;
    }
    if (action === "voice-cancel") {
      voice.cancel();
      return;
    }
    if (action === "voice") {
      if (voiceBusy()) {
        voice.stop();
        return;
      }
      if (!options.liveApi && !options.voiceFactory) {
        state.error =
          "O microfone funciona no chat publicado. Este catálogo mostra os componentes sem enviar áudio.";
        render({ scrollToEnd: false });
        return;
      }
      if (!voice.supported) {
        state.error =
          "Este navegador não oferece acesso compatível ao microfone. Você pode continuar digitando ou abrir em um navegador atualizado.";
        render({ scrollToEnd: false });
        return;
      }
      if (voiceConsent) {
        state.error = "";
        await voice.start({ consent: true });
        return;
      }
      openPanel(
        "Conte do seu jeito.",
        `<span class="sx-voice-orbit">${icon("microphone")}</span><p>Sua fala aparece como texto no campo da mensagem. Você pode revisar e editar antes de enviar.</p><p class="sx-footnote">Ao ativar, seu áudio é enviado à OpenAI para transcrição. O SkinBoost salva o texto neste navegador, sem guardar a gravação. O ditado para ao sair desta conversa ou colocar a página em segundo plano.</p>${button("Ativar microfone", "voice-start", "primary")}${button("Continuar digitando", "close-panel", "text")}`,
      );
      return;
    }
    if (action === "voice-start") {
      voiceConsent = true;
      closePanel();
      state.error = "";
      await voice.start({ consent: true });
      return;
    }
    if (action === "verify") {
      openVerification();
      return;
    }
    if (action === "sources-panel") {
      openSources();
      return;
    }
    if (action === "alternative") {
      if (!pending && !voiceBusy()) openAlternatives();
      return;
    }
    if (action === "new-alternative") {
      closePanel();
      voice?.cancel();
      if (options.onAlternative)
        await options.onAlternative(target.dataset.choice);
      else {
        update(
          createAlternative(state, {
            title: state.context.intent,
            choice: target.dataset.choice,
          }),
        );
        input.value = state.draft;
        followLatest = true;
        render();
        resizeInput();
        input.focus();
      }
      return;
    }
    if (action === "parent-session") {
      const original = options
        .getSessions?.()
        .find((session) => session.id === state.branch?.sourceId);
      if (original) await options.onSessionSelect?.(original.id);
      else {
        state.error =
          "A conversa original já não está neste navegador. Suas respostas aproveitadas continuam nesta opção.";
        render({ scrollToEnd: false });
      }
      return;
    }
    if (action === "note") {
      if (pending) return;
      append(
        "assistant",
        "Guarde uma síntese para retomar depois. Ela organiza suas respostas e não substitui a conversa original.",
        "note",
        { note: makeConversationNote(state) },
      );
      followLatest = true;
      render();
      return;
    }
    if (action === "copy-note") {
      const note = state.messages.find(
        (message) => message.id === target.dataset.messageId,
      )?.note;
      try {
        await navigator.clipboard.writeText(note);
        target.nextElementSibling.textContent =
          "Resumo copiado. Nenhuma foto foi incluída.";
      } catch {
        target.nextElementSibling.textContent =
          "Não foi possível copiar automaticamente. Você pode selecionar o texto acima.";
      }
      return;
    }
    if (action === "feedback") {
      openPanel(
        "O que precisa melhorar?",
        `<p>Sua avaliação fica nesta conversa, neste navegador. Ela não é enviada à equipe nem usada para treinar o modelo.</p><div class="sx-feedback-options">${["Não entendeu meu pedido", "Informação parece incorreta", "Explicação confusa", "Fonte insuficiente"].map((reason) => button(reason, "feedback-save", "secondary", `data-reason="${esc(reason)}" data-message-id="${esc(target.dataset.messageId)}"`)).join("")}</div>`,
      );
      return;
    }
    if (action === "feedback-save" || action === "helpful") {
      const message = state.messages.find(
        (item) => item.id === target.dataset.messageId,
      );
      if (!message) return;
      message.feedback = {
        reason: action === "helpful" ? "Ajudou" : target.dataset.reason,
      };
      render({ scrollToEnd: false });
      if (action === "feedback-save")
        openPanel(
          "Anotado nesta conversa.",
          `<p>${esc(message.feedback.reason)}. Você pode conferir as informações agora, sem perder suas respostas.</p>${button("Rever meu contexto", "context", "primary")}${button("Conferir fontes", "sources-panel", "secondary")}${button("Pedir uma explicação mais clara", "explain", "secondary")}${button("Continuar a conversa", "close-panel", "text")}`,
        );
      return;
    }
    if (action === "explain") {
      closePanel();
      state.draft =
        "Pode explicar sua última resposta de um jeito mais simples e mostrar os critérios que usou?";
      input.value = state.draft;
      resizeInput();
      options.onChange?.(state);
      input.focus();
      return;
    }
    if (dialog.open && action === "context") closePanel();

    if (action === "close" || action === "home") {
      options.onClose?.();
      return;
    }
    if (action === "retry") {
      if (state.requestKind === "image") return simulate();
      return submit(state.failedText, { preserveDraft: true, retry: true });
    }
    if (action === "history" || action === "close-history") {
      const open = action === "history";
      local(".sx-sidebar").classList.toggle("is-open", open);
      local(".sx-history-scrim").classList.toggle("is-open", open);
      if (open) local('.sx-sidebar [data-action="reset"]').focus();
      return;
    }
    if (action === "session") {
      await options.onSessionSelect?.(target.dataset.sessionId);
      return;
    }
    if (action === "delete-session") {
      openPanel(
        "Excluir esta conversa?",
        `<p>As mensagens e imagens desta conversa serão removidas deste navegador.</p>${button("Excluir conversa", "delete-confirm", "primary", `data-session-id="${esc(target.dataset.sessionId)}"`)}${button("Manter conversa", "close-panel", "secondary")}`,
      );
      return;
    }
    if (action === "delete-confirm") {
      const sessionId = target.dataset.sessionId;
      closePanel();
      await options.onDeleteSession?.(sessionId);
      return;
    }
    if (action === "clear-sessions") {
      openPanel(
        "Apagar o histórico deste navegador?",
        `<p>Isso remove todas as conversas, rascunhos e imagens salvos aqui. Não altera a retenção de dados pelo provedor.</p>${button("Apagar todo o histórico", "clear-confirm", "primary")}${button("Manter meu histórico", "close-panel", "secondary")}`,
      );
      return;
    }
    if (action === "clear-confirm") {
      closePanel();
      await options.onClearSessions?.();
      return;
    }
    if (action === "reset") {
      voice?.cancel();
      if (options.onNewConversation) {
        await options.onNewConversation();
        return;
      }
      epoch++;
      controller?.abort();
      pending = false;
      photoPending = false;
      update(createThreadState());
      state.messages.push({
        id: "welcome",
        role: "assistant",
        kind: "question",
        text: "Vamos começar uma nova conversa. O que você gostaria de cuidar?",
        choices: [
          { label: "Acne", value: "Quero cuidar da acne" },
          { label: "Oleosidade", value: "Minha pele está oleosa" },
          { label: "Cuidados gerais", value: "Quero uma rotina de cuidado" },
        ],
      });
      state.photoDataUrl = "";
      state.photoConsent = false;
      state.failedRequest = false;
      state.error = "";
      state.draft = "";
      input.value = "";
      options.onPhotoChange?.("");
      options.onReset?.();
      render();
      return;
    }
    if (action === "remove-photo") {
      if (photoPending) {
        epoch++;
        photoPending = false;
      }
      state.photoName = "";
      state.photoDataUrl = "";
      state.photoConsent = false;
      options.onPhotoChange?.("");
      render({ scrollToEnd: false });
      return;
    }
    if (pending) return;
    if (action === "privacy") {
      append(
        "assistant",
        "Vamos deixar claro como seus dados são usados.",
        "privacy",
      );
      render();
      return;
    }
    if (action === "context") {
      append(
        "assistant",
        "Este é o contexto que você compartilhou. Podemos ajustar qualquer detalhe.",
        "review",
        {
          snapshot: { ...state.context },
          contextOrigins: structuredClone(state.contextOrigins || {}),
        },
      );
      render();
      return;
    }
    if (action === "simulate") return simulate();
    if (action === "edit" && mode === "live") {
      state.editingKey = target.dataset.key;
      append(
        "assistant",
        `Vamos ajustar ${fields[target.dataset.key]?.toLowerCase() || "seu contexto"}. O que você gostaria de mudar?`,
      );
      render();
      input.focus();
      return;
    }
    update(
      act(
        state,
        action,
        action === "edit"
          ? target.dataset.key
          : action === "source"
            ? target.dataset.productId
            : undefined,
      ),
    );
    render();
    if (action === "edit") input.focus();
  }
  async function onChange(event) {
    if (event.target.matches("[data-photo]")) {
      if (pending) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const validation = validatePhoto(file);
      if (validation) {
        state.error = validation;
        render({ scrollToEnd: false });
        return;
      }
      const photoEpoch = ++epoch;
      photoPending = true;
      state.error = "";
      render({ scrollToEnd: false });
      try {
        const data = await preparePhoto(file);
        if (disposed || photoEpoch !== epoch) return;
        state.photoName = file.name;
        state.photoDataUrl = data;
        state.photoConsent = false;
        options.onPhotoChange?.(file.name);
      } catch {
        if (photoEpoch !== epoch) return;
        state.error =
          "Não consegui abrir essa imagem. Tente outra foto em JPG, PNG ou WebP.";
      } finally {
        if (photoEpoch === epoch) {
          photoPending = false;
          render({ scrollToEnd: false });
        }
      }
    }
    if (event.target.matches("[data-photo-consent]")) {
      state.photoConsent = event.target.checked;
      options.onChange?.(state);
    }
    if (event.target.matches("[data-cart-item]")) {
      state.selected = [...element.querySelectorAll("[data-cart-item]:checked")]
        .filter((x) => !x.disabled)
        .map((x) => x.value);
      render({ scrollToEnd: false });
    }
  }
  function onSubmit(event) {
    if (event.target.matches('[data-form="message"]')) {
      event.preventDefault();
      if (pending) stopResponse();
      else submit(input.value);
    }
  }
  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }
  function onInput(event) {
    if (event.target === input) {
      voice?.handleTypedInput();
      state.draft = input.value;
      options.onChange?.(state);
      state.error = "";
      resizeInput();
      local("[data-error]").hidden = true;
    }
  }
  function onKey(event) {
    if (
      event.target === input &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing &&
      matchMedia("(min-width: 761px)").matches
    ) {
      event.preventDefault();
      submit(input.value);
    }
  }
  element.addEventListener("click", onClick);
  element.addEventListener("change", onChange);
  element.addEventListener("submit", onSubmit);
  element.addEventListener("input", onInput);
  element.addEventListener("keydown", onKey);
  render();
  resizeInput();
  if (options.liveApi) {
    fetch("/api/status", { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (disposed) return;
        mode = result?.chatAvailable ? "live" : "demo";
        render({ scrollToEnd: false });
        if (options.initialMessage) submit(options.initialMessage);
      })
      .catch(() => {
        if (disposed) return;
        mode = "demo";
        render({ scrollToEnd: false });
        if (options.initialMessage) submit(options.initialMessage);
      });
  } else if (options.initialMessage) submit(options.initialMessage);
  return {
    state,
    show() {
      render();
    },
    send: submit,
    refreshSessions: renderSessions,
    refreshSaveStatus: saveStatus,
    destroy() {
      voice?.destroy();
      if (dialog.open) dialog.close();
      disposed = true;
      epoch++;
      if (pending && !state.generatingImage) {
        state.failedRequest = true;
        state.error =
          "A resposta foi interrompida ao sair. Você pode tentar novamente.";
      }
      controller?.abort();
      element.removeEventListener("click", onClick);
      element.removeEventListener("change", onChange);
      element.removeEventListener("submit", onSubmit);
      element.removeEventListener("input", onInput);
      element.removeEventListener("keydown", onKey);
      scroll.removeEventListener("scroll", onScroll);
    },
  };
}
