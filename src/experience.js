import {
  WELCOME_MESSAGE,
  renderThinking,
  renderSessions as sessionMarkup,
  renderAlternatives,
  renderVerification,
  renderSources,
  renderVoiceConsent,
  renderFeedbackOptions,
  createExperienceComponents,
  renderSidebar,
  renderTopbar,
  renderComposer,
  esc,
  icon,
  fields,
  button,
} from "./chat/experience-components.js";
import "./experience.css";
import { CATALOG, validatePhoto } from "./routine.js";
import {
  createThreadState,
  createThreadFixture,
  sendMessage,
  act,
  appendUserMessage,
  acceptAssistantResponse,
} from "./chat/thread-state.js";
import { photoRequestIntent } from "./chat/photo-experience.js";
import { preparePhoto } from "./chat/photo.js";
import {
  currentPhotoAnalysis,
  productChoiceFromText,
} from "./chat/photo-product-choice.js";
import { mountPhotoComparisonController } from "./chat/photo-comparison.js";
import { createVoiceInput } from "./chat/voice-input.js";
import { readChatResponse } from "./chat/response-stream.js";
import {
  createAlternative,
  recordContextChanges,
  makeConversationNote,
} from "./chat/conversation-tools.js";
export const createExperienceState = createThreadState;
/** Full conversation application, composed from the catalogued shared templates. */
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
  const { photoMarkup, message, review } = createExperienceComponents({
    state,
    isPending: () => pending,
    isPhotoPending: () => photoPending,
  });
  if (!state.messages.length)
    state.messages.push(structuredClone(WELCOME_MESSAGE));
  if (options.initialMessage) state.draft = options.initialMessage;
  element.classList.add("sb-experience");
  element.innerHTML = `${renderSidebar(options)}<button class="sx-history-scrim" data-action="close-history" aria-label="Fechar histórico"></button><div class="sx-chat">${renderTopbar(options)}<div data-branch-banner></div><div class="sx-scroll"><section class="sx-thread" role="log" aria-label="Conversa com SkinBoost" aria-live="polite" aria-relevant="additions text"></section></div><button type="button" class="sx-new-messages" data-action="latest" hidden>Ver mensagem mais recente ↓</button>${renderComposer(options)}</div><dialog class="sx-dialog" aria-labelledby="sx-dialog-title"><div data-dialog-body></div></dialog>`;
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
    nav.innerHTML = sessionMarkup(sessions, options.getSessionId?.());
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
    const markup =
      state.messages.map((m) => message(m, m === last)).join("") +
      (pending ? renderThinking(state, mode) : "");
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
    photoComparison.refresh();
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
  async function submit(
    text,
    { preserveDraft = false, retry = false, analyzePhoto = false } = {},
  ) {
    if (pending || photoPending || mode === "checking" || voiceBusy()) return;
    text = String(text || "").trim();
    const intent = photoRequestIntent(text);
    analyzePhoto =
      analyzePhoto ||
      (retry && !!state.failedAnalyzePhoto) ||
      (!!state.photoDataUrl && (intent.analysis || !state.photoSubmitted));
    if (!text && state.photoDataUrl) {
      text = "Analise minha foto e me ajude a entender o próximo cuidado.";
      analyzePhoto = true;
    }
    if (!text) {
      state.error = "Escreva uma mensagem para começarmos.";
      render({ scrollToEnd: false });
      input.focus();
      return;
    }
    if (analyzePhoto && !state.photoDataUrl) {
      state.error = "Adicione a foto que você quer analisar.";
      render({ scrollToEnd: false });
      return;
    }
    if (state.photoDataUrl && !state.photoConsent) {
      state.error =
        "Autorize o envio da foto abaixo para a IA conseguir observá-la. Você também pode remover o anexo e conversar só por texto.";
      render({ scrollToEnd: false });
      local("[data-photo-consent]")?.focus();
      return;
    }
    if (analyzePhoto && mode !== "live") {
      state.error =
        "A análise da foto precisa da conexão com a OpenAI. Sua foto e sua mensagem foram preservadas; tente novamente quando a conexão estiver disponível.";
      render({ scrollToEnd: false });
      return;
    }
    followLatest = true;
    state.error = "";
    const choice =
      !analyzePhoto && !retry
        ? productChoiceFromText(text, currentPhotoAnalysis(state))
        : "";
    if (choice && state.awaitingPhotoProduct)
      return simulate({
        selectedProductId: choice,
        clearDraft: !preserveDraft,
      });
    if (intent.simulation && !analyzePhoto && !retry)
      return simulate({ clearDraft: !preserveDraft });
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
    if (!retry && state.photoConsent && state.photoDataUrl) {
      const previousPhoto = state.messages
        .slice(0, -1)
        .findLast((m) => m.photo)?.photo;
      if (analyzePhoto || previousPhoto !== state.photoDataUrl)
        state.messages.at(-1).photo = state.photoDataUrl;
      state.photoSubmitted = true;
    }
    state.failedText = text;
    state.failedAnalyzePhoto = analyzePhoto;
    if (analyzePhoto) {
      state.photoAnalysisId = null;
      state.selectedPhotoProductId = "";
      state.awaitingPhotoProduct = false;
    }
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
          analyzePhoto,
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
      if (analyzePhoto) {
        state.photoAnalysisId = state.messages.at(-1).id;
        state.awaitingPhotoProduct =
          result.photoAnalysis?.status === "observed" &&
          !!state.messages.at(-1).productMatches?.length &&
          state.step !== "care";
        if (state.awaitingPhotoProduct) state.messages.at(-1).choices = [];
      }
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
  async function simulate({
    clearDraft = false,
    retry = false,
    selectedProductId = "",
  } = {}) {
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
    if (state.step === "care") {
      state.error =
        "Vamos priorizar a avaliação profissional indicada nesta conversa.";
      render({ scrollToEnd: false });
      return;
    }
    if (clearDraft) {
      state.draft = "";
      input.value = "";
      resizeInput();
    }
    const analysis = currentPhotoAnalysis(state);
    if (!analysis) {
      return submit(
        "Analise minha foto e sugira conceitos de produtos para eu escolher uma comparação ilustrativa.",
        { analyzePhoto: true, preserveDraft: true },
      );
    }
    if (
      analysis.photoAnalysis?.status !== "observed" ||
      !analysis.productMatches?.length
    ) {
      state.error =
        "Precisamos de uma foto mais clara ou de mais contexto antes de escolher um produto para explorar.";
      render({ scrollToEnd: false });
      return;
    }
    const productId = retry ? state.selectedPhotoProductId : selectedProductId;
    const match = analysis.productMatches.find(
      (product) => product.productId === productId,
    );
    const product = CATALOG.find((product) => product.id === match?.productId);
    if (!product) {
      state.awaitingPhotoProduct = true;
      if (state.messages.at(-1)?.kind !== "photo-product-choice")
        append(
          "assistant",
          "Qual produto você quer explorar na comparação? Toque em uma opção ou escreva o nome.",
          "photo-product-choice",
          {
            productMatches: analysis.productMatches,
            sources: analysis.sources,
          },
        );
      render();
      return;
    }
    state.selectedPhotoProductId = product.id;
    state.awaitingPhotoProduct = false;
    const original = state.photoDataUrl;
    const requestEpoch = ++epoch;
    if (!retry)
      append(
        "user",
        `Quero explorar ${product.name} em uma ilustração com minha foto.`,
        "text",
        { photo: original },
      );
    if (!retry)
      append(
        "assistant",
        `Você escolheu ${product.name}. ${match.reason} Vou manter o enquadramento da sua foto e criar uma possibilidade ilustrativa. Como o catálogo ainda não tem fórmula ou estudos de eficácia, a imagem não representa um resultado comprovado desse produto.`,
        "photo-selection",
      );
    state.photoSubmitted = true;
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
          selectedProductId: product.id,
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
          {
            original: result.originalDataUrl || original,
            image: result.imageDataUrl,
            selectedProductId: product.id,
            imageGeometry: result.imageGeometry,
          },
        );
      }
    } catch (error) {
      if (requestEpoch === epoch && error.name !== "AbortError") {
        state.error = error.message;
        state.failedRequest = true;
      }
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
    openPanel("Vamos explorar outra opção?", renderAlternatives(state));
  }
  function openVerification() {
    openPanel(
      "Uma resposta boa também pode ser conferida.",
      renderVerification(state),
    );
  }
  function openSources() {
    openPanel("Fontes, critérios e limites", renderSources(state));
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
      openPanel("Conte do seu jeito.", renderVoiceConsent());
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
        renderFeedbackOptions(target.dataset.messageId),
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
      if (state.requestKind === "image") return simulate({ retry: true });
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
      state.photoSubmitted = false;
      state.photoConsent = false;
      state.photoAnalysisId = null;
      state.selectedPhotoProductId = "";
      state.awaitingPhotoProduct = false;
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
    if (action === "analyze-photo")
      return submit(
        input.value ||
          "Analise minha foto e me ajude a entender o próximo cuidado.",
        { analyzePhoto: true },
      );
    if (action === "simulate") return simulate();
    if (action === "select-photo-product")
      return simulate({ selectedProductId: target.dataset.productId });
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
        state.photoSubmitted = false;
        state.photoName = file.name;
        state.photoDataUrl = data;
        state.photoConsent = false;
        state.photoAnalysisId = null;
        state.selectedPhotoProductId = "";
        state.awaitingPhotoProduct = false;
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
  const photoComparison = mountPhotoComparisonController(element);
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
      photoComparison.destroy();
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
