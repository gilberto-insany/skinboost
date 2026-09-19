import "./stories.css";

export function initStories({ root = document } = {}) {
  const events = new AbortController();
  const listen = (el, name, fn) =>
    el.addEventListener(name, fn, { signal: events.signal });
  const gallery = root.querySelector(".story-gallery");
  if (!gallery) return;
  const cards = [...gallery.querySelectorAll(".story-card")];
  const buttons = cards.map((card) => card.querySelector(".story-photo"));
  const pause = root.querySelector("#pause-stories");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 8000;
  let current = 0,
    elapsed = 0,
    last = 0,
    frame = 0;
  let visible = false,
    hovered = false,
    focused = false,
    paused = reduced.matches;

  function select(index, announce = false) {
    current = (index + cards.length) % cards.length;
    elapsed = 0;
    cards.forEach((card, i) => {
      const active = i === current;
      card.classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-expanded", String(active));
      card.querySelector(".story-panel").inert = !active;
      card.querySelector(".story-photo-symbol").textContent = active
        ? "−"
        : "+";
      card.style.setProperty("--story-progress", 0);
    });
    if (announce)
      root.querySelector("#story-announcement").textContent =
        `Relato ${current + 1} de ${cards.length}. ${cards[current].querySelector("blockquote").textContent}`;
  }
  function canRun() {
    return visible && !hovered && !focused && !paused && !document.hidden;
  }
  function tick(now) {
    frame = 0;
    if (!canRun()) return;
    elapsed += Math.min(now - last, 100);
    last = now;
    if (elapsed >= duration) select(current + 1);
    cards[current].style.setProperty("--story-progress", elapsed / duration);
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (canRun()) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function updatePause() {
    pause.setAttribute("aria-pressed", String(paused));
    pause.setAttribute(
      "aria-label",
      paused ? "Retomar troca automática" : "Pausar troca automática",
    );
    pause.firstElementChild.className = `ph ph-${paused ? "play" : "pause"}`;
    sync();
  }
  buttons.forEach((button, index) => {
    listen(button, "click", () => select(index, true));
    listen(button, "keydown", (event) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? cards.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : cards.length - 1)) %
              cards.length;
      select(next, true);
      buttons[next].focus();
    });
  });
  root.querySelector("#prev-story").onclick = () => select(current - 1, true);
  root.querySelector("#next-story").onclick = () => select(current + 1, true);
  pause.onclick = () => {
    paused = !paused;
    updatePause();
  };
  listen(gallery, "pointerenter", (event) => {
    if (event.pointerType === "mouse") {
      hovered = true;
      sync();
    }
  });
  listen(gallery, "pointerleave", () => {
    hovered = false;
    sync();
  });
  listen(gallery, "focusin", () => {
    focused = true;
    sync();
  });
  listen(gallery, "focusout", (event) => {
    focused = gallery.contains(event.relatedTarget);
    sync();
  });
  listen(document, "visibilitychange", sync);
  listen(window, "pagehide", () => cancelAnimationFrame(frame));
  listen(window, "pageshow", sync);
  listen(reduced, "change", () => {
    paused = reduced.matches;
    updatePause();
  });
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      sync();
    },
    { threshold: 0.3 },
  );
  observer.observe(gallery);
  updatePause();
  return {
    destroy() {
      events.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
      pause.onclick = null;
      root.querySelector("#prev-story").onclick = null;
      root.querySelector("#next-story").onclick = null;
    },
  };
}
