const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

/** One delegated controller for all comparison artifacts in a conversation. */
export function mountPhotoComparisonController(root) {
  const events = new AbortController();
  const positions = new Map();
  let active = null;
  let destroyed = false;
  const listen = (type, callback, options = {}) =>
    root.addEventListener(type, callback, {
      ...options,
      signal: events.signal,
    });

  function update(figure, value) {
    if (!figure) return;
    const percent = Math.round(clamp(value));
    if (figure.dataset.photoComparison)
      positions.set(figure.dataset.photoComparison, percent);
    const stage = figure.querySelector("[data-photo-drag]");
    const range = figure.querySelector("[data-photo-compare]");
    const handle = figure.querySelector("[data-photo-handle]");
    const description = `${percent}% da foto original`;
    stage?.style.setProperty("--reveal", `${percent}%`);
    if (range) {
      range.value = String(percent);
      range.setAttribute("aria-valuetext", description);
    }
    if (handle) {
      handle.setAttribute("aria-valuenow", String(percent));
      handle.setAttribute("aria-valuetext", description);
    }
  }

  function matchOriginal(image) {
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const stage = image.closest("[data-photo-drag]");
    if (!stage) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const figure = stage.closest(".sx-simulation");
    figure.style.setProperty("--photo-ratio", String(ratio));
    figure.style.setProperty("--photo-max-width", `${560 * ratio}px`);
  }

  function stop() {
    if (!active) return;
    const { stage, pointerId } = active;
    active = null;
    stage.classList.remove("is-dragging");
    if (stage.hasPointerCapture(pointerId))
      stage.releasePointerCapture(pointerId);
  }

  function fromPointer(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    const bounds = active.stage.getBoundingClientRect();
    if (bounds.width > 0)
      update(
        active.figure,
        ((event.clientX - bounds.left) / bounds.width) * 100,
      );
  }

  listen("pointerdown", (event) => {
    const stage = event.target.closest("[data-photo-drag]");
    if (
      !stage ||
      !root.contains(stage) ||
      active ||
      !event.isPrimary ||
      event.button !== 0
    )
      return;
    active = {
      stage,
      figure: stage.closest(".sx-simulation"),
      pointerId: event.pointerId,
    };
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
    fromPointer(event);
    if (event.pointerType !== "touch")
      stage
        .querySelector("[data-photo-handle]")
        ?.focus({ preventScroll: true });
  });
  listen("pointermove", fromPointer);
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(event, (event) => {
      if (active?.pointerId === event.pointerId) stop();
    });
  listen("dragstart", (event) => {
    if (event.target.closest("[data-photo-drag]")) event.preventDefault();
  });
  listen("input", (event) => {
    if (event.target.matches("[data-photo-compare]"))
      update(event.target.closest(".sx-simulation"), event.target.value);
  });
  listen("keydown", (event) => {
    const handle = event.target.closest("[data-photo-handle]");
    if (!handle) return;
    const current = Number(handle.getAttribute("aria-valuenow")) || 0;
    const actions = {
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      PageDown: current - 10,
      PageUp: current + 10,
      Home: 0,
      End: 100,
    };
    if (!(event.key in actions)) return;
    event.preventDefault();
    update(handle.closest(".sx-simulation"), actions[event.key]);
  });
  listen(
    "load",
    (event) => {
      if (event.target.matches?.(".sx-compare-original"))
        matchOriginal(event.target);
    },
    { capture: true },
  );

  function refresh() {
    if (destroyed) return;
    if (active && !root.contains(active.stage)) stop();
    for (const figure of root.querySelectorAll(".sx-simulation")) {
      matchOriginal(figure.querySelector(".sx-compare-original"));
      update(
        figure,
        positions.get(figure.dataset.photoComparison) ??
          figure.querySelector("[data-photo-compare]")?.value ??
          50,
      );
    }
  }
  refresh();
  return {
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      events.abort();
      positions.clear();
    },
  };
}
