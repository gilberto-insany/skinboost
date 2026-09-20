import "./tokens/functional.css";
import "./styles.css";
import "./product-story.css";
import { openDialog, closeDialog } from "./ui/dialog.js";
import { initChat } from "./chat/composer.js";
import { initLanding } from "./landing/interactions.js";
import { initPrompt } from "./landing/prompt-controller.js";
import { initMotion } from "./landing/motion.js";
let promptController;
const chat = initChat({
  onPhotoChange: (name) => promptController?.setAttachment(name),
  onReset: () => promptController?.reset(),
});
function openChat(goal, attachment = "") {
  closeDialog();
  chat.open(goal, attachment);
}
const landing = initLanding({ openChat, openDialog, closeDialog });
promptController = initPrompt({ chat, openChat, closeDialog });
initMotion();
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    landing.destroy();
    promptController.destroy();
  }
});
