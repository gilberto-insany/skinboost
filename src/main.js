import "./styles.css";
import "./product-story.css";
import { $, $$ } from "./ui/dom.js";
import { closeDialog } from "./ui/dialog.js";
import { showCheckin } from "./ui/checkin.js";
import { initChat } from "./chat/chat.js";
import { initLanding } from "./landing/interactions.js";
import { initMotion } from "./landing/motion.js";

const prompt = $("#skin-prompt");
const fileInput = $("#photo");
let attachmentName = "";
const chat = initChat({ onCheckin: showCheckin });
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
  button.addEventListener("click", () =>
    openChat(
      "Quero começar com poucos passos e entender o que faz parte da minha rotina.",
    ),
  ),
);
$$("[data-checkin]").forEach((button) =>
  button.addEventListener("click", showCheckin),
);
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    $("#prompt-error").textContent =
      "Escolha uma imagem JPG, PNG ou WebP de até 10 MB.";
    $("#prompt-error").hidden = false;
    fileInput.value = "";
    return;
  }
  attachmentName = file.name;
  $("#attachment").hidden = false;
  $("#attachment span").textContent = attachmentName;
  $("#prompt-error").hidden = true;
});
$("#remove-photo").addEventListener("click", () => {
  attachmentName = "";
  fileInput.value = "";
  $("#attachment").hidden = true;
});
