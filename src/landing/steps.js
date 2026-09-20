import { createVisibleClock } from "./visible-clock.js";

export function initSteps({ root = document } = {}) {
  const section = root.querySelector("#como-funciona");
  if (!section) return;
  const tabs = [...section.querySelectorAll("[data-step]")];
  const list = section.querySelector(".step-list");
  const pause = section.querySelector("[data-step-pause]");
  const events = new AbortController();
  const listen = (node, type, fn) =>
    node?.addEventListener(type, fn, { signal: events.signal });
  const copy = [
    [
      "Vamos entender você.",
      "“Quero uma rotina simples que caiba nas minhas manhãs.”",
      "O que você já usa hoje?",
      "Contexto antes da escolha",
      "steps-0",
    ],
    [
      "Cada escolha, explicada.",
      "Sua preferência: começar com poucos passos.",
      "Cleanse + Comfort · exemplo de rotina essencial",
      "Você entende a função de cada item",
      "steps2-2",
    ],
    [
      "A rotina acompanha você.",
      "“Quero ajustar o cuidado ao meu novo horário.”",
      "O que mudou desde a última vez?",
      "Seu próximo passo pode ser simplificar",
      "steps3-2",
    ],
  ];
  let current = 0,
    elapsed = 0,
    paused = false,
    focused = false,
    reduced = false;
  function select(index, announce = false) {
    current = (index + tabs.length) % tabs.length;
    elapsed = 0;
    tabs[current].style.setProperty("--step-progress", 0);
    tabs.forEach((tab, i) => {
      tab.classList.toggle("active", i === current);
      tab.setAttribute("aria-selected", String(i === current));
      tab.tabIndex = i === current ? 0 : -1;
    });
    const [title, text, reply, foot, image] = copy[current];
    section
      .querySelector("#step-panel")
      .setAttribute("aria-labelledby", `step-${current}`);
    section.querySelector("#step-title").textContent = title;
    section.querySelector("#step-text").textContent = text;
    section.querySelector("#step-reply").textContent = reply;
    section.querySelector(".card-foot span").textContent = foot;
    section.querySelector("[data-step-image]").src =
      `/media/figma-final/${image}.webp`;
    if (announce)
      section.querySelector("[data-step-status]").textContent =
        `Etapa ${current + 1} de 3: ${title}`;
  }
  function updatePause() {
    pause.setAttribute("aria-pressed", String(paused || reduced));
    pause.setAttribute(
      "aria-label",
      reduced
        ? "Troca automática desativada: movimento reduzido"
        : paused
          ? "Retomar etapas"
          : "Pausar etapas",
    );
    pause.disabled = reduced;
    pause.firstElementChild.className = `ph ph-${paused || reduced ? "play" : "pause"}`;
  }
  const clock = createVisibleClock(
    section,
    (delta) => {
      elapsed += delta;
      if (elapsed >= 8000) select(current + 1);
      tabs[current].style.setProperty("--step-progress", elapsed / 8000);
    },
    {
      canRun: () => !paused && !focused,
      onMotionChange: (value) => {
        reduced = value;
        updatePause();
      },
    },
  );
  tabs.forEach((tab, index) => {
    listen(tab, "click", () => select(index, true));
    listen(tab, "keydown", (event) => {
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(event.key)
      )
        return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : index +
              (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1);
      select(next, true);
      tabs[current].focus();
    });
  });
  listen(list, "focusin", () => {
    focused = true;
    clock.sync();
  });
  listen(list, "focusout", (event) => {
    focused = list.contains(event.relatedTarget);
    clock.sync();
  });
  listen(pause, "click", () => {
    paused = !paused;
    updatePause();
    clock.sync();
  });
  listen(section.querySelector("[data-step-next]"), "click", () =>
    select(current + 1, true),
  );
  listen(section.querySelector("[data-step-prev]"), "click", () =>
    select(current - 1, true),
  );
  return {
    destroy() {
      events.abort();
      clock.destroy();
    },
  };
}
