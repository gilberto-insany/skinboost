/** The two Figma header states share one navigation and its existing actions. */
export function initHeader(root) {
  const nav = root.querySelector(".nav.home-final");
  const hero = root.querySelector(".hero-final");
  if (root !== document || !nav || !hero) return;
  const logo = nav.querySelector(".wordmark img");
  const desktop = window.matchMedia("(min-width: 1001px)");
  // Let the original navigation scroll away before fixing it after the hero.
  const boundary = 0;
  const update = () => {
    const solid =
      desktop.matches && hero.getBoundingClientRect().bottom <= boundary;
    nav.classList.toggle("is-solid", solid);
    const source = `/media/figma-final/header-logo-${solid ? "dark" : "light"}.svg`;
    if (logo.getAttribute("src") !== source) logo.setAttribute("src", source);
  };
  nav.classList.add("is-page-nav");
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  desktop.addEventListener("change", update);
  update();
  return {
    destroy() {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      desktop.removeEventListener("change", update);
      nav.classList.remove("is-page-nav", "is-solid");
      logo.setAttribute("src", "/media/figma-final/header-logo-light.svg");
    },
  };
}
