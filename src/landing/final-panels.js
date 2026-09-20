export function initFinalPanels({ root = document } = {}) {
  const events = new AbortController();
  const listen = (node, name, fn) =>
    node.addEventListener(name, fn, { signal: events.signal });
  const tabs = [...root.querySelectorAll("[data-catalog-tab]")];
  const panels = [...root.querySelectorAll("[data-catalog-panel]")];
  function select(index) {
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
  }
  tabs.forEach((tab, index) => {
    listen(tab, "click", () => select(index));
    listen(tab, "keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
              tabs.length;
      select(next);
      tabs[next].focus();
    });
  });
  const people = [...root.querySelectorAll("[data-compare-person]")];
  people.forEach((button, index) =>
    listen(button, "click", () => {
      people.forEach((item, i) =>
        item.setAttribute("aria-pressed", String(i === index)),
      );
      for (const kind of ["before", "after"])
        root.querySelector(`.${kind}-image img`).src =
          `/media/figma-final/compare-${index + 1}-${kind}.webp`;
    }),
  );
  return {
    destroy() {
      events.abort();
    },
  };
}
