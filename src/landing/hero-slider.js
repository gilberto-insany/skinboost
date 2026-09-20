import { createVisibleClock } from "./visible-clock.js";

/** The hero changes its imagery without interrupting the shared composer. */
export function initHeroSlider({ root = document } = {}) {
  const hero = root.querySelector(".hero-final");
  if (!hero) return;
  const slides = [...hero.querySelectorAll("[data-hero-slide]")];
  if (slides.length < 2) return;
  const events = new AbortController();
  let current = 0,
    elapsed = 0,
    focused = false;
  function select(index) {
    current = index;
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
  }
  select(0);
  const clock = createVisibleClock(
    hero,
    (delta) => {
      elapsed += delta;
      if (elapsed >= 10000) select((current + 1) % slides.length);
      hero.style.setProperty("--hero-progress", elapsed / 10000);
    },
    { canRun: () => !focused },
  );
  hero.addEventListener(
    "focusin",
    () => {
      focused = true;
      clock.sync();
    },
    { signal: events.signal },
  );
  hero.addEventListener(
    "focusout",
    (event) => {
      focused = hero.contains(event.relatedTarget);
      clock.sync();
    },
    { signal: events.signal },
  );
  return {
    destroy() {
      events.abort();
      clock.destroy();
    },
  };
}
