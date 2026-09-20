import pageSource from "../../index.html?raw";
import "../product-story.css";
import { initLanding } from "./interactions.js";
import { initPrompt } from "./prompt-controller.js";
import { initMotion } from "./motion.js";
import { createDialogController } from "../ui/dialog-controller.js";

export const LANDING_COMPONENTS = {
  home: null,
  header: ".nav",
  hero: "#inicio",
  intro: "#intro",
  tabs: "#como-funciona",
  manifesto: "#manifesto",
  bento: "#diferenciais",
  "bento-context": ".bento-context",
  "bento-reason": ".bento-reason",
  "bento-photo": ".bento-photo",
  "bento-privacy": ".bento-privacy",
  "bento-checkin": ".bento-checkin",
  product: "#produtos",
  catalog: "#catalogo",
  comparison: "#evolucao",
  stories: "#historias",
  trust: "#confianca",
  faq: "#duvidas",
  cta: ".final-cta",
  footer: "#footer",
};

/** Preview markup is extracted from the app's index.html, never reauthored. */
export function mountLandingCatalog(
  host,
  {
    component = "home",
    onIntent = () => {},
    onNavigate = () => {},
    onDemo = () => {},
    onCheckin = () => {},
  } = {},
) {
  const source = new DOMParser().parseFromString(pageSource, "text/html");
  const root = document.createElement("div");
  root.className = "sb-landing-surface";
  root.dataset.component = component;
  const clone = (selector) => {
    const node = source.querySelector(selector);
    if (!node) throw new Error(`Missing app component: ${selector}`);
    return document.importNode(node, true);
  };
  if (component === "home") {
    for (const selector of [".skip", ".nav", "main", "#footer"])
      root.append(clone(selector));
  } else if (component.startsWith("bento-")) {
    const grid = document.createElement("div");
    grid.className = "bento sb-landing-single-card";
    grid.append(clone(LANDING_COMPONENTS[component]));
    root.append(grid);
  } else root.append(clone(LANDING_COMPONENTS[component]));
  root.append(clone("#experience"));
  host.replaceChildren(root);
  const dialog = createDialogController(root.querySelector("#experience"));
  const chat = {
    state: { photoName: "", photoDataUrl: "", photoConsent: false },
    demo: onDemo,
    checkin: onCheckin,
  };
  const openChat = (goal, attachment = "") => {
    dialog.close();
    onIntent(goal, attachment);
  };
  const landing = initLanding({
    root,
    openChat,
    openDialog: dialog.open,
    closeDialog: dialog.close,
  });
  const prompt = initPrompt({
    root,
    chat,
    openChat,
    closeDialog: dialog.close,
    onStart: () => onNavigate("#inicio"),
  });
  const motion = initMotion({ root });
  const events = new AbortController();
  root.addEventListener(
    "click",
    (event) => {
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor) return;
      event.preventDefault();
      const href = anchor.getAttribute("href");
      const target = [...root.querySelectorAll("[id]")].find(
        (node) => `#${node.id}` === href,
      );
      if (target) target.scrollIntoView({ behavior: "auto" });
      onNavigate(href);
    },
    { signal: events.signal },
  );
  root.dataset.ready = "true";
  let destroyed = false;
  return {
    root,
    photoState: chat.state,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      events.abort();
      motion.destroy();
      prompt.destroy();
      landing.destroy();
      dialog.destroy();
      root.remove();
    },
  };
}
