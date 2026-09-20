import { createVisibleClock } from "./visible-clock.js";

export function initContextTyping({ root = document } = {}) {
  const prompt = root.querySelector("[data-context-typing]");
  if (!prompt) return;
  const phrases = [
    "Como incluir Comfort na rotina?",
    "Quero conhecer o Cleanse.",
    "Qual é o papel do Balance?",
  ];
  let index = 0,
    elapsed = 0,
    displayed = "";
  const render = (text) => {
    if (displayed !== text) {
      prompt.textContent = text;
      displayed = text;
    }
  };
  return createVisibleClock(
    prompt.closest(".bento-context"),
    (delta) => {
      elapsed += delta;
      const phrase = phrases[index];
      const typingEnd = 500 + phrase.length * 65;
      const holdEnd = typingEnd + 2200;
      const eraseEnd = holdEnd + phrase.length * 30;
      if (elapsed > eraseEnd + 400) {
        elapsed = 0;
        index = (index + 1) % phrases.length;
      }
      const count =
        elapsed < typingEnd
          ? Math.floor(Math.max(0, elapsed - 500) / 65)
          : elapsed < holdEnd
            ? phrase.length
            : Math.max(0, phrase.length - Math.floor((elapsed - holdEnd) / 30));
      render(phrase.slice(0, count));
    },
    {
      interval: 32,
      onMotionChange: () => {
        index = 0;
        elapsed = 0;
        render(phrases[0]);
      },
    },
  );
}
