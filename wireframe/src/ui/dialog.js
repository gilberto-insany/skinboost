import { createDialogController } from "./dialog-controller.js";
const controller = createDialogController(
  document.querySelector("#experience"),
);
export const dialogContent = controller.content;
export const openDialog = controller.open;
export const closeDialog = controller.close;
