import {
  createExperienceComponents,
  WELCOME_MESSAGE,
  renderTopbar,
  renderSidebar,
  renderComposer,
  renderSessions,
  renderThinking,
  renderAlternatives,
  renderVerification,
  renderSources,
  renderVoiceConsent,
  renderFeedbackOptions,
  esc,
  button,
} from "../chat/experience-components.js";
import { createThreadFixture } from "../chat/thread-state.js";
import {
  renderPhotoEvidence,
  renderPhotoComparison,
} from "../chat/photo-experience.js";
import { mountPhotoComparisonController } from "../chat/photo-comparison.js";
import { fixtureState, demonstrationVoice } from "./chat-fixtures.js";

const mounts = new Map();
export function disposeDisconnectedPreviews() {
  for (const [host, dispose] of mounts) if (!host.isConnected) dispose();
}

// This adapter mounts a single real component. Page navigation/API callbacks are
// reported to Storybook Actions; it never creates a hidden application or thread.
export function renderChatComponent(args) {
  const host = document.createElement("div");
  host.className = "sb-experience sb-chat-component";
  host.dataset.component = args.component;
  host.dataset.ready = "false";
  let disposed = false,
    comparison,
    voice;
  const events = new AbortController();
  const dispose = () => {
    disposed = true;
    observer.disconnect();
    comparison?.destroy();
    voice?.destroy();
    events.abort();
    mounts.delete(host);
  };
  let attached = false;
  const observer = new MutationObserver(() => {
    if (host.isConnected) attached = true;
    else if (attached) dispose();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  mounts.set(host, dispose);
  const emit = (action, value = "") => args.onAction?.({ action, value });
  const fragment = (markup, selector) => {
    const template = document.createElement("template");
    template.innerHTML = markup;
    const node = template.content.querySelector(selector);
    if (!node) throw new Error(`Missing real component: ${selector}`);
    return node.outerHTML;
  };
  const panel = (title, content) =>
    `<section class="sx-dialog sb-component-panel" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2></header>${content}</section>`;
  (async () => {
    const state =
      (await fixtureState(args)) ||
      createThreadFixture(args.initialStep || "context", args.scenario);
    if (disposed) return;
    if (!state.messages.length)
      state.messages.push(structuredClone(WELCOME_MESSAGE));
    if (args.empty) state.selected = [];
    const ui = createExperienceComponents({ state });
    let last = state.messages.findLast((m) => m.role === "assistant");
    let markup;
    switch (args.component) {
      case "welcome":
        markup = ui.message(WELCOME_MESSAGE, true);
        break;
      case "question":
        markup = ui.message(last, true);
        break;
      case "user-message":
        markup = ui.message(
          state.messages.find((m) => m.role === "user"),
          false,
        );
        break;
      case "suggestions":
        markup = `<div class="sx-chip-row">${last.choices.map((c) => ui.reply(c.label, c.value)).join("")}</div>`;
        break;
      case "context":
        markup = ui.review(state.context, true, state.contextOrigins);
        break;
      case "routine":
        markup = fragment(
          ui.routine(state.routine, state.context),
          ".sx-routine",
        );
        break;
      case "product":
        markup = fragment(
          ui.routine(state.routine, state.context),
          ".sx-product",
        );
        break;
      case "refine":
        markup = fragment(
          ui.routine(state.routine, state.context),
          ".sx-refine",
        );
        break;
      case "visual-invite":
        markup = fragment(
          ui.routine(state.routine, state.context),
          ".sx-visual-invite",
        );
        break;
      case "cart":
        markup = ui.cart(state.routine, true);
        break;
      case "checkout":
        markup = ui.checkout(last);
        break;
      case "price-comparison":
        markup = ui.comparison(state.routine);
        break;
      case "source":
        markup = ui.sourceCard({ productId: args.productId || "cleanse" });
        break;
      case "checkin":
        markup = fragment(ui.message(last, true), ".sx-chip-row");
        break;
      case "note":
        markup = fragment(ui.message(last, true), ".sx-card");
        break;
      case "alternative":
        last = state.messages.findLast((m) => m.kind === "alternative");
        markup = fragment(ui.message(last, true), ".sx-inherited");
        break;
      case "feedback":
        markup = fragment(ui.message(last, true), ".sx-response-tools");
        break;
      case "privacy":
        markup = fragment(
          ui.message(
            { id: "privacy", role: "assistant", kind: "privacy" },
            true,
          ),
          ".sx-card",
        );
        break;
      case "photo-observed":
      case "photo-limited":
        markup = fragment(renderPhotoEvidence(last), ".sx-photo-analysis");
        break;
      case "photo-products":
        markup = fragment(
          renderPhotoEvidence(last, { canSimulate: true }),
          ".sx-photo-products",
        );
        break;
      case "photo-sources":
        markup = fragment(renderPhotoEvidence(last), ".sx-photo-sources");
        break;
      case "photo-comparison":
        markup = fragment(
          renderPhotoComparison(last, { canCheckout: false }),
          ".sx-simulation",
        );
        break;
      case "photo-checkout":
        markup = fragment(
          renderPhotoComparison(last, { canCheckout: true }),
          ".sx-photo-checkout",
        );
        break;
      case "photo-attachment":
        markup = ui.photoMarkup();
        break;
      case "topbar":
        markup = renderTopbar({ onClose: true });
        break;
      case "sidebar":
        markup = renderSidebar();
        break;
      case "composer":
        markup = renderComposer();
        break;
      case "thinking":
        state.streamText = args.streaming
          ? "Vamos entender o que incomoda na sua pele, um passo de cada vez."
          : "";
        markup = renderThinking(state);
        break;
      case "partial":
        markup = ui.message(
          {
            id: "partial",
            role: "assistant",
            kind: "partial",
            text: "Vamos entender o seu pedido…",
          },
          true,
        );
        break;
      case "alternatives":
        markup = panel(
          "Vamos explorar outra opção?",
          renderAlternatives(state),
        );
        break;
      case "verification":
        markup = panel(
          "Uma resposta boa também pode ser conferida.",
          renderVerification(state),
        );
        break;
      case "sources":
        markup = panel("Fontes e limites", renderSources(state));
        break;
      case "voice-consent":
        markup = panel("Conte do seu jeito.", renderVoiceConsent());
        break;
      case "feedback-options":
        markup = panel(
          "O que precisa melhorar?",
          renderFeedbackOptions(last.id),
        );
        break;
      case "disclaimer":
        markup = `<p class="sx-disclaimer">A IA pode cometer erros. ${button("Confira as informações", "verify", "text")}</p>`;
        break;
      default:
        throw new Error(`Unknown isolated component: ${args.component}`);
    }
    host.innerHTML = markup;
    const sessions = [
      {
        id: "acne",
        title: "Minha rotina para acne",
        updatedAt: "2026-09-19T12:00:00Z",
      },
      {
        id: "oiliness",
        title: "Cuidados com a oleosidade",
        updatedAt: "2026-09-18T12:00:00Z",
      },
    ];
    if (args.component === "sidebar") {
      host.querySelector("[data-session-list]").innerHTML = renderSessions(
        args.empty ? [] : sessions,
        "acne",
      );
      host.querySelector("[data-current-session]").hidden = !args.empty;
    }
    if (args.component === "topbar")
      host.querySelector("[data-mode]").textContent = "Demonstração";
    const input = host.querySelector("textarea");
    if (input) {
      input.value = args.draft || "";
      host.querySelector("[data-save-status]").textContent =
        "Exemplo local · sem envio à IA";
      // Voice stays a deterministic adapter. Permission flow has its own story.
      voice = demonstrationVoice({
        getDraft: () => input.value,
        onDraft: (text) => {
          input.value = text;
          emit("draft", text);
        },
        onState: ({ status }) => {
          const active = status === "listening";
          const mic = host.querySelector(".sx-mic");
          mic.dataset.action = active ? "voice-stop" : "voice";
          mic.setAttribute(
            "aria-label",
            active ? "Concluir ditado" : "Ditar mensagem",
          );
          mic.setAttribute("aria-pressed", String(active));
          const banner = host.querySelector("[data-voice-status]");
          banner.hidden = !active;
          banner.textContent = active
            ? "Demonstração de ditado · Revise antes de enviar. Sem microfone nem envio de áudio."
            : "";
        },
      });
      if (args.error) {
        const error = host.querySelector("[data-error]");
        error.hidden = false;
        error.textContent =
          "Não foi possível enviar. Seu rascunho foi preservado.";
      }
      if (args.fixture)
        host.querySelector("[data-file]").innerHTML = ui.photoMarkup();
      if (args.recording) voice.start();
    }
    comparison = mountPhotoComparisonController(host);
    host.addEventListener(
      "click",
      (event) => {
        const target = event.target.closest("[data-action],[data-reply]");
        if (!target) return;
        event.preventDefault();
        const action = target.dataset.action || "reply";
        const value =
          target.dataset.reply ||
          target.dataset.choice ||
          target.dataset.productId ||
          target.dataset.reason ||
          target.dataset.sessionId ||
          target.dataset.key ||
          "";
        emit(action, value);
        if (action === "voice") voice?.start();
        if (action === "voice-stop") voice?.stop();
        if (action === "helpful")
          target.setAttribute(
            "aria-pressed",
            String(target.getAttribute("aria-pressed") !== "true"),
          );
        if (action === "remove-photo") {
          state.photoName = "";
          state.photoDataUrl = "";
          target.closest(".sx-file")?.parentElement.replaceChildren();
        }
        if (action === "copy-note")
          target.nextElementSibling.textContent =
            "Exemplo de cópia registrado nas ações do Storybook.";
        if (action === "delete-session")
          target.closest(".sx-saved-row")?.remove();
      },
      { signal: events.signal },
    );
    host.addEventListener(
      "change",
      (event) => {
        const target = event.target;
        if (target.matches("[data-cart-item]")) {
          state.selected = [
            ...host.querySelectorAll("[data-cart-item]:checked"),
          ].map((el) => el.value);
          const fresh = document.createElement("template");
          fresh.innerHTML = ui.cart(state.routine, true);
          host.querySelector("[data-cart-total]").textContent =
            fresh.content.querySelector("[data-cart-total]").textContent;
          host.querySelector('[data-action="checkout"]').disabled =
            !state.selected.length;
          emit("selection", state.selected);
        }
        if (target.matches("[data-photo-consent]")) {
          state.photoConsent = target.checked;
          emit("photo-consent", target.checked);
        }
        if (target.matches("[data-photo]"))
          emit("attachment", target.files[0]?.name || "");
      },
      { signal: events.signal },
    );
    const submit = () => {
      if (input?.value.trim()) {
        emit("send", input.value.trim());
        input.value = "";
      }
    };
    host.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        submit();
      },
      { signal: events.signal },
    );
    host.addEventListener(
      "keydown",
      (event) => {
        if (
          event.target === input &&
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.isComposing &&
          matchMedia("(min-width:761px)").matches
        ) {
          event.preventDefault();
          submit();
        }
      },
      { signal: events.signal },
    );
    host.dataset.ready = "true";
  })().catch((error) => {
    host.dataset.error = error.message;
    console.error(error);
  });
  return host;
}
