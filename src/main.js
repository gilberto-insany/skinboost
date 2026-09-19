import "./styles.css";
import "./product-story.css";
import { $, $$ } from "./ui/dom.js";
import { closeDialog } from "./ui/dialog.js";
import { validatePhoto } from "./routine.js";
import { preparePhoto } from "./chat/photo.js";
import { initChat } from "./chat/composer.js";
import { initLanding } from "./landing/interactions.js";
import { initMotion } from "./landing/motion.js";

const prompt = $("#skin-prompt");
const fileInput = $("#photo");
let attachmentName = "";
const chat = initChat({
  onPhotoChange: (name) => {
    attachmentName = name;
    $("#attachment").hidden = !name;
    $("#attachment span").textContent = name;
    if (!name) fileInput.value = "";
  },
  onReset: () => {
    prompt.value = "";
    attachmentName = "";
    fileInput.value = "";
    $("#attachment").hidden = true;
  },
});
function openChat(goal, attachment = "") {
  closeDialog();
  chat.open(goal, attachment);
}
initLanding({ openChat });
initMotion();
$("#prompt-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!prompt.value.trim()) {
    $("#prompt-error").textContent =
      "Conte um pouco sobre sua pele ou escolha uma sugestão para começar.";
    $("#prompt-error").hidden = false;
    prompt.focus();
    return;
  }
  $("#prompt-error").hidden = true;
  openChat(prompt.value.trim(), attachmentName);
});
prompt.addEventListener("input", () => {
  $("#prompt-error").hidden = true;
});
$$("[data-prompt]").forEach((button) =>
  button.addEventListener("click", () => {
    prompt.value = button.dataset.prompt;
    $("#prompt-error").hidden = true;
    prompt.focus({ preventScroll: true });
  }),
);
$$(".start").forEach((button) =>
  button.addEventListener("click", () => {
    closeDialog();
    $("#inicio").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    prompt.focus({ preventScroll: true });
  }),
);
$$("[data-demo]").forEach((button) =>
  button.addEventListener("click", () => {
    closeDialog();
    chat.demo();
  }),
);
$$("[data-checkin]").forEach((button) =>
  button.addEventListener("click", () => {
    closeDialog();
    chat.checkin();
  }),
);
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const validationError = validatePhoto(file);
  if (validationError) {
    $("#prompt-error").textContent = validationError;
    $("#prompt-error").hidden = false;
    fileInput.value = "";
    return;
  }
  try {
    chat.state.photoDataUrl = await preparePhoto(file);
    chat.state.photoConsent = false;
  } catch {
    $("#prompt-error").textContent =
      "Não consegui abrir a imagem. Escolha outra foto.";
    $("#prompt-error").hidden = false;
    return;
  }
  attachmentName = file.name;
  chat.state.photoName = file.name;
  $("#attachment").hidden = false;
  $("#attachment span").textContent = attachmentName;
  $("#prompt-error").hidden = true;
});
$("#remove-photo").addEventListener("click", () => {
  attachmentName = "";
  chat.state.photoName = "";
  chat.state.photoDataUrl = "";
  chat.state.photoConsent = false;
  fileInput.value = "";
  $("#attachment").hidden = true;
});
