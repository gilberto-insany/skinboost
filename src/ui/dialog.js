import { $ } from "./dom.js";
const dialog = $("#experience");
export const dialogContent = $("#dialog-content");
let returnFocus;
export function openDialog(html) {
  dialogContent.innerHTML = html;
  if (!dialog.open) {
    returnFocus = document.activeElement;
    dialog.showModal();
  }
  dialog.scrollTop = 0;
  const title = $("#dialog-title", dialogContent);
  if (title) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}
export function closeDialog() {
  dialog.close();
  returnFocus?.focus({ preventScroll: true });
}
$("#close-dialog").addEventListener("click", closeDialog);
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    closeDialog();
});
