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
  const local = (q) => element.querySelector(q);
  const update = (next) => {
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
  element.innerHTML = `<aside class="sx-sidebar"><a class="sx-wordmark" href="/" data-action="home">skinboost<span>®</span></a>${button(icon("plus") + " Nova conversa", "reset", "new")}<div class="sx-sidebar-label">CONVERSAS SALVAS</div><nav class="sx-session-list" data-session-list aria-label="Conversas salvas"></nav><div class="sx-session" data-current-session>${icon("chat-circle-text")}<span data-session-title>Seu próximo cuidado</span></div><div class="sx-sidebar-bottom"><span class="sx-mini-orbit">${icon("sparkle")}</span><p>Boas escolhas<br>começam com uma<br><strong>boa conversa.</strong></p>${button(icon("shield-check") + " Sobre seus dados", "privacy", "text")}<a href="/guia.html" target="_blank" rel="noopener">Conheça a experiência ${icon("arrow-up-right")}</a></div></aside><button class="sx-history-scrim" data-action="close-history" aria-label="Fechar histórico"></button><div class="sx-chat"><header class="sx-top"><div>${button(icon("sidebar-simple") + '<span class="sr-only">Conversas salvas</span>', "history", "icon sx-mobile-only")}<a href="/" data-action="home" class="sx-mobile-brand">skinboost<span>®</span></a><span class="sx-top-title">Sua conversa</span><span class="sx-mode" data-mode>Preparando…</span></div><div class="sx-top-actions">${button(icon("notebook") + '<span class="sx-hide-small">Seu contexto</span>', "context", "text", 'aria-label="Seu contexto"')}${button(icon("plus") + '<span class="sr-only">Nova conversa</span>', "reset", "icon sx-mobile-only")}${options.onClose ? button(icon("x") + '<span class="sr-only">Fechar experiência</span>', "close", "icon") : ""}</div></header><div class="sx-scroll"><section class="sx-thread" role="log" aria-label="Conversa com SkinBoost" aria-live="polite" aria-relevant="additions text"></section></div><div class="sx-dock"><div class="sx-error" role="alert" data-error hidden></div><form data-form="message" class="sx-composer"><div data-file></div><label class="sr-only" for="sx-message">Sua mensagem</label><textarea id="sx-message" rows="1" maxlength="2000" placeholder="Conte o que sua pele precisa…"></textarea><div class="sx-composer-tools"><label class="sx-attach" title="Adicionar foto">${icon("plus")}<span>Foto</span><input class="sr-only" type="file" data-photo accept="image/jpeg,image/png,image/webp"></label><span class="sx-composer-caption">No seu tempo. Do seu jeito.</span><button type="submit" class="sx-send" aria-label="Enviar mensagem">${icon("arrow-up")}</button></div></form><p class="sx-disclaimer" data-disclaimer></p></div></div>`;
  const thread = local(".sx-thread"),
    scroll = local(".sx-scroll"),
    input = local("#sx-message");
  input.value = state.draft || "";

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
    const nearEnd =
      scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 160;
    const last = state.messages.at(-1);
    const markup =
      state.messages.map((m) => message(m, m === last)).join("") +
      (pending
        ? `<article class="sx-message sx-assistant sx-thinking"><span class="sx-avatar">${icon("sparkle")}</span><div><span class="sx-typing"><b></b><b></b><b></b></span><span class="sx-thinking-label">${state.generatingImage ? "Criando uma ilustração. Pode levar alguns minutos…" : mode === "live" ? "SkinBoost está preparando a resposta…" : "Preparando o próximo passo…"}</span></div></article>`
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
      mode === "live"
        ? "IA pode errar. Cuidados educativos; não substituem avaliação profissional."
        : "Demonstração conversacional · produtos e preços ilustrativos.";
    local("[data-file]").innerHTML = photoMarkup();
    local(".sx-send").disabled = pending || photoPending || mode === "checking";
    local(".sx-send").setAttribute("aria-busy", String(pending));
    const error = state.error || statusError;
    local("[data-error]").hidden = !error;
    local("[data-error]").innerHTML = error
      ? esc(error) +
        (state.failedRequest ? button("Tentar novamente", "retry", "text") : "")
      : "";
    if (scrollToEnd && (nearEnd || !pending))
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
      content = review(m.snapshot || state.context, active);
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
      content = `<div class="sx-card"><h3>Você controla o que compartilha</h3><p>As conversas e imagens são salvas neste navegador, para você retomá-las pela lateral. No modo com OpenAI, o histórico recente é enviado ao servidor para gerar cada resposta. A foto só é enviada com sua autorização. Não há conta nem sincronização de conversas entre dispositivos nesta prévia.</p><p>A OpenAI processa os dados conforme suas políticas. Você pode excluir uma conversa na lateral ou apagar todo o histórico abaixo. A exclusão local não equivale à exclusão nos sistemas do provedor.</p><a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener">Política de privacidade da OpenAI ${icon("arrow-up-right")}</a>${button("Apagar todas as conversas deste navegador", "clear-sessions", "secondary")}</div>`;
    if (m.kind === "simulation")
      content = `<figure class="sx-simulation"><div class="sx-image-pair"><div><img src="${m.original}" alt="Foto original enviada por você"><span>Foto original</span></div><div><img src="${m.image}" alt="Simulação visual ilustrativa gerada por inteligência artificial"><span>ILUSTRAÇÃO COM IA · NÃO É PREVISÃO</span></div></div><figcaption>Exercício visual sobre aparência, sem prazo ou resultado garantido. Não demonstra o efeito de nenhum produto nem mede melhora clínica.</figcaption></figure>`;
    const choices =
      m.choices?.length && active && !pending
        ? `<div class="sx-chip-row">${m.choices.map((c) => reply(c.label, c.value, true)).join("")}</div>`
        : "";
    return `<article class="sx-message sx-${m.role}" data-message-id="${esc(m.id)}" data-role="${m.role}">${m.role === "assistant" ? `<span class="sx-avatar">${icon("sparkle")}</span>` : ""}<div class="sx-message-body">${welcome ? `<div class="sx-welcome-kicker">SEU CUIDADO, EM CONVERSA</div><h1>Vamos entender<br>o que sua pele precisa?</h1>` : ""}${m.text ? `<div class="sx-message-text">${esc(m.text)}</div>` : ""}${content}${choices}</div></article>`;
  }
  const reply = (label, value, active = true) =>
    `<button type="button" class="sx-reply" data-reply="${esc(value)}" ${!active || pending ? "disabled" : ""}>${esc(label)}${icon("arrow-up-left")}</button>`;
  function review(context, active = true) {
    return `<div class="sx-card sx-context-card"><div class="sx-card-eyebrow">${icon("notebook")} O QUE ENTENDI ATÉ AQUI</div><dl>${Object.entries(
      fields,
    )
      .filter(([k]) => context[k])
      .map(
        ([k, v]) =>
          `<div><dt>${v}</dt><dd>${esc(context[k])}</dd><dd>${button("Editar", "edit", "text", `data-key="${k}"`)}</dd></div>`,
      )
      .join(
        "",
      )}</dl><p class="sx-footnote">Você pode corrigir qualquer detalhe antes de explorar uma rotina.</p>${button("Sobre seus dados", "privacy", "text")}${active ? button("É isso, pode montar minha rotina " + icon("arrow-right"), "confirm", "primary") : ""}</div>`;
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
      )}</div><div class="sx-cost"><span>Diferença neste exemplo<strong>${money(r.savings)}</strong></span></div><p class="sx-footnote">Comparação didática por embalagem. Não representa economia real de mercado nem custo mensal.</p>${button("Revisar produtos", "cart", "primary")}</div>`;
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
    if (pending || mode === "checking") return;
    text = String(text || "").trim();
    if (!text) {
      state.error = "Escreva uma mensagem para começarmos.";
      render({ scrollToEnd: false });
      input.focus();
      return;
    }
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
    if (mode !== "live") {
      update(sendMessage(state, text));
      render();
      return;
    }
    const draft = state.draft;
    if (!retry) update(appendUserMessage(state, text));
    state.failedText = text;
    const requestEpoch = ++epoch;
    if (preserveDraft) state.draft = draft;
    pending = true;
    render();
    controller = new AbortController();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: apiHistory(),
          context: state.context,
          photoDataUrl: state.photoConsent ? state.photoDataUrl : undefined,
          photoConsent: !!state.photoConsent,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ||
            "Não foi possível receber a resposta. Tente novamente.",
        );
      if (disposed || requestEpoch !== epoch) return;
      update(acceptAssistantResponse(state, result));
      state.failedRequest = false;
    } catch (error) {
      if (requestEpoch === epoch && error.name !== "AbortError") {
        state.error =
          error instanceof TypeError
            ? "A conexão falhou. Sua mensagem continua aqui; tente novamente."
            : error.message;
        state.failedRequest = true;
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
      if (!disposed && requestEpoch === epoch)
        append(
          "assistant",
          "Aqui está uma possibilidade visual criada por IA. Ela não prevê como sua pele vai responder a um produto.",
          "simulation",
          { original, image: result.imageDataUrl },
        );
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
  async function onClick(event) {
    const target = event.target.closest("[data-action],[data-reply]");
    if (!target || !element.contains(target)) return;
    event.preventDefault();
    if (target.hasAttribute("data-reply"))
      return submit(target.dataset.reply, { preserveDraft: true });
    const action = target.dataset.action;
    if (action === "close" || action === "home") {
      options.onClose?.();
      return;
    }
    if (action === "retry")
      return submit(state.failedText, { preserveDraft: true, retry: true });
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
      await options.onDeleteSession?.(target.dataset.sessionId);
      return;
    }
    if (action === "clear-sessions") {
      await options.onClearSessions?.();
      return;
    }
    if (action === "reset") {
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
        { snapshot: { ...state.context } },
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
      submit(input.value);
    }
  }
  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }
  function onInput(event) {
    if (event.target === input) {
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
    destroy() {
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
    },
  };
}
