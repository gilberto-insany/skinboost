export function makePreview(mode) {
  return {
    parameters: {
      layout: "fullscreen",
      options: {
        storySort: { order: ["Fundamentos", "Landing", "Experiência"] },
      },
      a11y: { test: "error" },
      controls: { expanded: true },
      skinboostMode: mode,
      docs: {
        description: {
          component:
            mode === "hifi"
              ? "Proposta baseada no brandbook. Ainda não é a identidade final aprovada. Usa os mesmos componentes e estados do wireframe."
              : "Componentes reais da experiência atual, com a identidade implementada no wireframe.",
        },
      },
    },
    decorators: [
      (Story, context) => {
        const shell = document.createElement("div");
        shell.className = `sb-catalog sb-catalog--${mode}`;
        shell.dataset.catalog = mode;
        const status = document.createElement(
          context.parameters.landingCatalog ? "aside" : "header",
        );
        if (context.parameters.landingCatalog)
          status.setAttribute("aria-label", "Informações do catálogo");
        status.className = "sb-catalog-status";
        const label = document.createElement("strong");
        label.textContent =
          mode === "hifi"
            ? "Alta fidelidade · proposta em revisão"
            : "Wireframe · identidade implementada";
        const note = document.createElement("span");
        note.textContent =
          mode === "hifi"
            ? "Tokens do brandbook. Aprovação visual pendente; pessoas e pele continuam placeholders."
            : "Mesmos componentes usados na página. Produtos e 3D preservados; pessoas e pele são placeholders.";
        status.append(label, note);
        const body = document.createElement(
          context.parameters.landingCatalog && context.args.component === "home"
            ? "div"
            : "main",
        );
        body.className = context.parameters.landingCatalog
          ? "sb-catalog-canvas sb-catalog-canvas--landing"
          : "sb-catalog-canvas";
        const story = Story();
        if (story instanceof Node) body.append(story);
        else body.innerHTML = story;
        shell.append(status, body);
        return shell;
      },
    ],
  };
}
