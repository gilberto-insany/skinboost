import "./chat.css";
import { $, escapeHtml as escape, icon } from "../ui/dom.js";
import {
  createConversation,
  answerQuestion,
  editAnswer,
  confirmContext,
  buildDemoPlan,
  questions,
} from "./conversation.js";

export function initChat({ onCheckin }) {
  let state = createConversation();
  let returnFocus = null;
  let landingUrl = "/";
  let ownsHistoryEntry = false;
  const shell = document.createElement("section");
  shell.className = "chat-shell";
  shell.hidden = true;
  shell.setAttribute("aria-label", "Conversa SkinBoost");
  shell.innerHTML = `
    <aside class="chat-sidebar" aria-label="Sua conversa">
      <a class="wordmark" href="/" data-chat-home aria-label="SkinBoost início"><img src="/media/figma/logo-green.svg" alt="SkinBoost" width="158" height="33" /></a>
      <button class="chat-new" data-new-chat>${icon("plus")} Nova conversa</button>
      <div><p class="chat-sidebar-label">NESTA SESSÃO</p><div class="chat-session" id="chat-session">Seu próximo passo</div></div>
      <div class="chat-sidebar-footer"><button data-chat-home>${icon("arrow-left")} Voltar ao site</button>Seu contexto fica neste navegador.<br>Ao recarregar, a conversa é apagada.</div>
    </aside>
    <div class="chat-body">
      <header class="chat-header"><button class="chat-home-mobile" data-chat-home aria-label="Voltar ao site">${icon("arrow-left")}</button><strong>SkinBoost <span aria-hidden="true">/</span> Sua conversa</strong><span class="chat-badge">Demonstração</span><button class="chat-home-mobile" data-new-chat aria-label="Nova conversa">${icon("plus")}</button></header>
      <div class="chat-scroll" id="chat-scroll"><div class="chat-thread"><div class="chat-progress" id="chat-progress"></div><div id="chat-messages" role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions"></div><div id="chat-next"></div></div></div>
      <div class="chat-composer-wrap"><p class="chat-error" id="chat-error" role="alert" hidden></p><form class="chat-composer" id="chat-form"><label class="sr-only" for="chat-input">Sua mensagem</label><textarea id="chat-input" rows="2" maxlength="800" placeholder="Escreva do seu jeito…"></textarea><div class="chat-composer-actions"><span class="chat-composer-hint" id="chat-hint">Enter para enviar · Shift + Enter para nova linha</span><button type="submit" class="send" aria-label="Enviar mensagem">${icon("arrow-up")}</button></div></form><p class="chat-disclaimer">Conversa demonstrativa, sem análise de IA ou prescrição. Não substitui uma avaliação profissional.</p></div>
    </div>`;
  document.body.appendChild(shell);
  const input = $("#chat-input", shell);
  const messages = $("#chat-messages", shell);
  const next = $("#chat-next", shell);
  const scroll = $("#chat-scroll", shell);
  const error = $("#chat-error", shell);

  function summaryRows() {
    return (
      `<div class="chat-review-row"><div><small>Seu objetivo</small><p>${escape(state.goal)}</p></div></div>` +
      questions
        .map(
          (question, index) =>
            `<div class="chat-review-row"><div><small>${question.label}</small><p>${escape(state.answers[question.id])}</p></div><button class="chat-edit" data-edit-answer="${index}" aria-label="Editar ${question.label.toLowerCase()}">Editar</button></div>`,
        )
        .join("")
    );
  }
  function render({ showMessages = false } = {}) {
    $("#chat-session", shell).textContent = state.goal || "Seu próximo passo";
    const completed = Math.min(state.step, questions.length);
    $("#chat-progress", shell).innerHTML =
      `<span>${state.phase === "plan" ? "Sua proposta" : state.phase === "review" ? "Revisão do contexto" : "Conhecendo você"}</span><div class="chat-progress-line"><span style="width:${(completed / questions.length) * 100}%"></span></div><span>${completed} / ${questions.length}</span>`;
    // Keep existing messages in place so the live region announces only new content.
    const messageMarkup = (message) =>
      `<article class="chat-message ${message.role}">${message.role === "assistant" ? `<span class="chat-avatar" aria-label="SkinBoost">${icon("sparkle")}</span>` : ""}<div><span class="sr-only">${message.role === "assistant" ? "SkinBoost" : "Você"}: </span><p>${escape(message.text)}</p>${message.attachment ? `<span class="chat-attachment">${icon("file-image")}${escape(message.attachment)} · não analisada</span>` : ""}</div></article>`;
    const existing = [...messages.children];
    let prefix = 0;
    while (
      prefix < Math.min(existing.length, state.messages.length) &&
      existing[prefix].dataset.message ===
        JSON.stringify(state.messages[prefix])
    )
      prefix++;
    existing.slice(prefix).forEach((element) => element.remove());
    state.messages.slice(prefix).forEach((message) => {
      const template = document.createElement("template");
      template.innerHTML = messageMarkup(message);
      const element = template.content.firstElementChild;
      element.dataset.message = JSON.stringify(message);
      messages.appendChild(element);
    });
    if (state.phase === "start") {
      next.innerHTML = `<div class="chat-welcome"><p class="eyebrow">CIÊNCIA SENSÍVEL. CUIDADO PESSOAL.</p><h1>Vamos começar<br>por você.</h1><p>Conte o que você quer cuidar na sua pele.</p></div><div class="chat-options"><button data-answer="Quero começar com poucos passos.">Quero começar</button><button data-answer="Quero simplificar minha rotina.">Simplificar minha rotina</button></div>`;
    } else if (state.phase === "questions") {
      next.innerHTML = `<div class="chat-options">${questions[state.step].options.map((option) => `<button data-answer="${escape(option)}">${escape(option)}</button>`).join("")}</div>`;
    } else if (state.phase === "review") {
      next.innerHTML = `<section class="chat-review" aria-labelledby="review-title"><p class="eyebrow">ANTES DE CONTINUAR</p><h2 id="review-title">Faz sentido para você?</h2>${summaryRows()}<p>Você pode corrigir qualquer resposta. As etapas seguintes serão refeitas para manter o contexto consistente.</p><button class="pill dark" data-confirm-context>Sim, explorar minha proposta ${icon("arrow-up-right")}</button></section>`;
    } else {
      const plan = buildDemoPlan(state);
      next.innerHTML = `<section class="chat-plan" aria-labelledby="plan-title"><p class="eyebrow">SUA PROPOSTA / EXEMPLO</p><h2 id="plan-title">${plan.title}</h2><p>${plan.rationale}</p><div class="chat-plan-products">${plan.products.map((product, index) => `<div class="chat-plan-product"><span>0${index + 1}</span><div><h3>${product.name} <span class="subtle">/ ${product.category}</span></h3><p>${product.description}</p></div></div>`).join("")}</div><p class="chat-plan-note">${plan.note}</p><div class="actions"><button class="pill outline" data-review-context>Rever meu contexto</button><button class="pill dark" data-chat-checkin>Conhecer o acompanhamento ${icon("arrow-up-right")}</button></div></section><div class="chat-options"><button data-followup="simplify">Quero simplificar</button><button data-followup="reason">Por que essas escolhas?</button></div>`;
    }
    input.disabled = state.phase === "review";
    $(".chat-composer .send", shell).disabled = input.disabled;
    input.placeholder =
      state.phase === "review"
        ? "Confira seu contexto acima para continuar."
        : state.phase === "plan"
          ? "O que você gostaria de ajustar?"
          : "Escreva do seu jeito…";
    $("#chat-hint", shell).textContent =
      state.phase === "review"
        ? "Revise as respostas e confirme acima."
        : "Enter para enviar · Shift + Enter para nova linha";
    requestAnimationFrame(() => {
      const card =
        !showMessages && next.querySelector(".chat-review, .chat-plan");
      if (card) {
        scroll.scrollTop +=
          card.getBoundingClientRect().top -
          scroll.getBoundingClientRect().top -
          24;
        const heading = card.querySelector("h2");
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      } else {
        scroll.scrollTop = showMessages
          ? messages.offsetTop +
            messages.offsetHeight -
            scroll.clientHeight +
            32
          : scroll.scrollHeight;
      }
    });
  }
  function submit(value) {
    const text = value.trim();
    if (!text || text.length > 800) {
      error.textContent = "Escreva uma mensagem de até 800 caracteres.";
      error.hidden = false;
      input.focus();
      return;
    }
    error.hidden = true;
    if (state.phase === "plan") {
      state = {
        ...state,
        messages: [
          ...state.messages,
          { role: "user", text },
          {
            role: "assistant",
            text: "Registrei sua mensagem nesta conversa. Nesta demonstração, posso ajudar você a rever o contexto ou explorar o motivo das escolhas. Para mudar a proposta, use “Rever meu contexto”.",
          },
        ],
      };
    } else {
      state = answerQuestion(state, text);
    }
    input.value = "";
    render({ showMessages: state.phase === "plan" });
    if (!input.disabled) input.focus({ preventScroll: true });
  }
  function show() {
    shell.hidden = false;
    document.body.classList.add("chat-open");
    document.title = "Sua conversa — SkinBoost";
    render();
    input.focus({ preventScroll: true });
  }
  function hide() {
    shell.hidden = true;
    document.body.classList.remove("chat-open");
    document.title = "SkinBoost — Sua pele. Seu próximo passo.";
    returnFocus?.focus({ preventScroll: true });
    window.dispatchEvent(new Event("resize"));
  }
  function open(goal = "", attachment = "") {
    returnFocus = document.activeElement;
    if (window.location.pathname !== "/chat") {
      landingUrl =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      history.pushState({ skinboostChat: true }, "", "/chat");
      ownsHistoryEntry = true;
    }
    state = createConversation(goal, attachment);
    show();
  }
  function goHome() {
    if (ownsHistoryEntry) history.back();
    else {
      history.replaceState(null, "", landingUrl);
      hide();
    }
  }
  shell.addEventListener("click", (event) => {
    const button = event.target.closest("button,a");
    if (!button) return;
    if (button.hasAttribute("data-chat-home")) {
      event.preventDefault();
      goHome();
    }
    if (button.hasAttribute("data-new-chat")) {
      state = createConversation();
      input.value = "";
      error.hidden = true;
      render();
      input.focus();
    }
    if (button.dataset.answer) submit(button.dataset.answer);
    if (button.dataset.editAnswer !== undefined) {
      state = editAnswer(state, Number(button.dataset.editAnswer));
      input.value = "";
      render();
      input.focus();
    }
    if (button.hasAttribute("data-confirm-context")) {
      state = confirmContext(state);
      render();
      $("#plan-title", shell).tabIndex = -1;
      $("#plan-title", shell).focus({ preventScroll: true });
    }
    if (button.hasAttribute("data-review-context")) {
      state = { ...state, phase: "review" };
      render();
    }
    if (button.hasAttribute("data-chat-checkin")) onCheckin();
    if (button.dataset.followup === "simplify") {
      state = editAnswer(state, 2);
      render();
      input.focus();
    }
    if (button.dataset.followup === "reason") {
      state = {
        ...state,
        messages: [
          ...state.messages,
          { role: "user", text: "Por que essas escolhas?" },
          {
            role: "assistant",
            text: "A preferência de quantidade de passos define o catálogo apresentado neste exemplo. Suas outras respostas ficam no resumo para uma futura avaliação. Elas ainda não determinam indicação clínica, composição ou preço.",
          },
        ],
      };
      render({ showMessages: true });
    }
  });
  $("#chat-form", shell).addEventListener("submit", (event) => {
    event.preventDefault();
    submit(input.value);
  });
  input.addEventListener("input", () => {
    error.hidden = true;
  });
  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.isComposing &&
      !matchMedia("(pointer: coarse)").matches
    ) {
      event.preventDefault();
      submit(input.value);
    }
  });
  window.addEventListener("popstate", () => {
    if (location.pathname === "/chat") show();
    else hide();
  });
  if (location.pathname === "/chat") show();
  return { open };
}
