/** Figma's two hero variants: 10 seconds per image, 300ms crossfade. */
export function initHeroSlider({ root = document } = {}) {
  const hero = root.querySelector(".hero-final");
  if (!hero) return;
  const slides = [...hero.querySelectorAll("[data-hero-slide]")];
  if (slides.length < 2) return;
  const events = new AbortController();
  const listen = (node, name, callback) =>
    node.addEventListener(name, callback, { signal: events.signal });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const pause = hero.querySelector("[data-hero-pause]");
  let current = 0,
    elapsed = 0,
    last = 0,
    frame = 0;
  let paused = reduce.matches,
    visible = false,
    focused = false,
    hovered = false;
  function select(index, announce = false) {
    current = (index + slides.length) % slides.length;
    elapsed = 0;
    hero.dataset.heroIndex = String(current);
    slides.forEach((slide, i) =>
      slide.classList.toggle("is-active", i === current),
    );
    hero.querySelector(".hero-science").hidden = current !== 0;
    hero.querySelector(".hero-metrics").hidden = current !== 1;
    hero.querySelector("[data-hero-shot]").textContent =
      `SkinBoost Shot / 0${current + 1}`;
    hero.style.setProperty("--hero-progress", 0);
    if (announce)
      hero.querySelector("[data-hero-status]").textContent =
        `Imagem ${current + 1} de ${slides.length}`;
  }
  const canRun = () =>
    visible && !paused && !focused && !hovered && !document.hidden;
  function tick(now) {
    frame = 0;
    if (!canRun()) return;
    elapsed += Math.min(now - last, 100);
    last = now;
    if (elapsed >= 10000) select(current + 1);
    hero.style.setProperty("--hero-progress", elapsed / 10000);
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
      paused ? "Retomar slider" : "Pausar slider",
    );
    pause.firstElementChild.className = `ph ph-${paused ? "play" : "pause"}`;
    sync();
  }
  listen(hero.querySelector("[data-hero-prev]"), "click", () =>
    select(current - 1, true),
  );
  listen(hero.querySelector("[data-hero-next]"), "click", () =>
    select(current + 1, true),
  );
  listen(pause, "click", () => {
    paused = !paused;
    updatePause();
  });
  listen(hero, "focusin", () => {
    focused = true;
    sync();
  });
  listen(hero, "focusout", (event) => {
    focused = hero.contains(event.relatedTarget);
    sync();
  });
  listen(hero.querySelector(".hero-slider-controls"), "pointerenter", () => {
    hovered = true;
    sync();
  });
  listen(hero.querySelector(".hero-slider-controls"), "pointerleave", () => {
    hovered = false;
    sync();
  });
  listen(document, "visibilitychange", sync);
  listen(reduce, "change", () => {
    paused = reduce.matches;
    updatePause();
  });
  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      sync();
    },
    { threshold: 0.2 },
  );
  observer.observe(hero);
  select(0);
  updatePause();
  return {
    destroy() {
      events.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
    },
  };
}
