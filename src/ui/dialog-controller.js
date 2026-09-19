/** Native dialog controller scoped to one real dialog instance. */
export function createDialogController(dialog) {
  const content = dialog.querySelector("#dialog-content");
  const closeButton = dialog.querySelector("#close-dialog");
  const events = new AbortController();
  let returnFocus;
  function open(html) {
    content.innerHTML = html;
    if (!dialog.open) {
      returnFocus = document.activeElement;
      dialog.showModal();
    }
    dialog.scrollTop = 0;
    const title = content.querySelector("#dialog-title");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }
  function close() {
    if (dialog.open) dialog.close();
    if (returnFocus?.isConnected) returnFocus.focus();
  }
  closeButton?.addEventListener("click", close, { signal: events.signal });
  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        close();
    },
    { signal: events.signal },
  );
  return {
    open,
    close,
    content,
    destroy() {
      events.abort();
      close();
    },
  };
}
