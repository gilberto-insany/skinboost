import { validatePhoto } from "../routine.js";
import { preparePhoto } from "../chat/photo.js";

/** Shared prompt, attachment and CTA behavior. The caller owns the chat adapter. */
export function initPrompt({
  root = document,
  chat,
  openChat,
  closeDialog = () => {},
  onStart = () => {},
}) {
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const prompt = $("#skin-prompt");
  const fileInput = $("#photo");
  const events = new AbortController();
  let attachmentName = chat.state.photoName || "";
  let photoRevision = 0;
  let disposed = false;
  const listen = (node, event, handler) =>
    node?.addEventListener(event, handler, { signal: events.signal });
  function error(message) {
    if ($("#prompt-error")) {
      $("#prompt-error").textContent = message;
      $("#prompt-error").hidden = !message;
    }
  }
  function setAttachment(name) {
    attachmentName = name || "";
    if ($("#attachment")) {
      $("#attachment").hidden = !name;
      $("#attachment span").textContent = name || "";
    }
    if (!name && fileInput) fileInput.value = "";
  }
  listen($("#prompt-form"), "submit", (event) => {
    event.preventDefault();
    if (!prompt.value.trim()) {
      error(
        "Conte um pouco sobre sua pele ou escolha uma sugestão para começar.",
      );
      prompt.focus();
      return;
    }
    error("");
    openChat(prompt.value.trim(), attachmentName);
  });
  listen(prompt, "input", () => error(""));
  $$("[data-prompt]").forEach((button) =>
    listen(button, "click", () => {
      if (!prompt) return;
      prompt.value = button.dataset.prompt;
      error("");
      prompt.focus({ preventScroll: true });
    }),
  );
  $$(".start").forEach((button) =>
    listen(button, "click", () => {
      closeDialog();
      $("#inicio")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      prompt?.focus({ preventScroll: true });
      onStart();
    }),
  );
  $$("[data-demo]").forEach((button) =>
    listen(button, "click", () => {
      closeDialog();
      chat.demo();
    }),
  );
  $$("[data-checkin]").forEach((button) =>
    listen(button, "click", () => {
      closeDialog();
      chat.checkin();
    }),
  );
  listen(fileInput, "change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const revision = ++photoRevision;
    const validationError = validatePhoto(file);
    if (validationError) {
      error(validationError);
      fileInput.value = "";
      return;
    }
    try {
      const prepared = await preparePhoto(file);
      if (disposed || revision !== photoRevision) return;
      chat.state.photoDataUrl = prepared;
      chat.state.photoConsent = false;
      chat.state.photoSubmitted = false;
    } catch {
      if (!disposed && revision === photoRevision)
        error("Não consegui abrir a imagem. Escolha outra foto.");
      return;
    }
    chat.state.photoName = file.name;
    setAttachment(file.name);
    error("");
  });
  listen($("#remove-photo"), "click", () => {
    photoRevision++;
    chat.state.photoName = "";
    chat.state.photoDataUrl = "";
    chat.state.photoConsent = false;
    chat.state.photoSubmitted = false;
    setAttachment("");
  });
  return {
    setAttachment,
    reset() {
      photoRevision++;
      if (prompt) prompt.value = "";
      setAttachment("");
      error("");
    },
    destroy() {
      disposed = true;
      photoRevision++;
      events.abort();
    },
  };
}
