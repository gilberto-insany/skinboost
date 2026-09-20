/** The two Figma header states share one navigation and its existing actions. */
export function initHeader(root) {
  const nav = root.querySelector(".nav.home-final");
  const hero = root.querySelector(".hero-final");
  if (root !== document || !nav || !hero) return;
  const logo = nav.querySelector(".wordmark img");
  // Let the original navigation scroll away before fixing it after the hero.
  let previous;
  const update = (solid) => {
    if (solid === previous) return;
    previous = solid;
    nav.classList.toggle("is-solid", solid);
    const source = `/media/figma-final/header-logo-${solid ? "dark" : "light"}.svg`;
    if (logo.getAttribute("src") !== source) logo.setAttribute("src", source);
  };
  nav.classList.add("is-page-nav");
  const observer = new IntersectionObserver(([entry]) => {
    update(entry.boundingClientRect.bottom <= 0);
  });
  observer.observe(hero);
  update(hero.getBoundingClientRect().bottom <= 0);
  return {
    destroy() {
      observer.disconnect();
      nav.classList.remove("is-page-nav", "is-solid");
      logo.setAttribute("src", "/media/figma-final/header-logo-light.svg");
    },
  };
}
