import "../tokens/functional.css";
import "./token-review.css";
import source from "../../design-tokens/source-figma-export.json";

export default {
  title: "Fundamentos/Tokens Figma",
  parameters: { controls: { disable: true } },
};

const roles = {
  "ui-canvas": "Fundo da página",
  "ui-surface": "Superfície elevada",
  "ui-text": "Texto principal",
  "ui-text-secondary": "Texto secundário",
  "ui-border": "Borda sutil",
  "ui-action": "Ação principal",
  "ui-action-hover": "Ação · hover",
  "ui-on-action": "Texto sobre ação",
  "ui-focus": "Indicador de foco",
  "ui-success": "Sucesso",
  "ui-warning": "Atenção",
  "ui-error": "Erro",
  "ui-info": "Informação",
};
const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function renderReview(theme) {
  const root = document.createElement("section");
  root.className = "ds-review";
  root.dataset.theme = theme;
  root.innerHTML = `<h1>Tokens Figma · ${theme === "light" ? "Light" : "Dark"}</h1>
    <p>Os 130 aliases Light/Dark foram confirmados por nome nos prints do Figma enviados pelo usuário. Fundamentos e a landing já consomem estes papéis funcionais; o chat continua com seus estilos atuais até a próxima etapa. As cores hexadecimais vêm do JSON exportado; os IDs nativos não foram consultados.</p>
    <h2>Funções da interface</h2><div class="ds-role-grid"></div>
    <div class="ds-example"><h2>Seu próximo passo</h2><p>Entenda cada escolha e revise seu contexto.</p><div class="ds-actions"><button type="button">Continuar</button><button type="button" disabled>Aguardando resposta</button></div><p class="ds-feedback">Informação: exemplo de aplicação dos tokens.</p></div>
    <h2>Variables do export</h2><p>215 variables. As coleções abaixo usam os valores CSS gerados, com dimensões normalizadas.</p>`;
  for (const [name, label] of Object.entries(roles)) {
    const card = document.createElement("article");
    card.className = "ds-role";
    const swatch = document.createElement("div");
    swatch.className = "ds-swatch";
    swatch.style.backgroundColor = `var(--${name})`;
    const text = document.createElement("p");
    text.textContent = label;
    const code = document.createElement("code");
    code.textContent = `--${name}`;
    card.append(swatch, text, code);
    root.querySelector(".ds-role-grid").append(card);
  }
  for (const [name, collection] of Object.entries(source.collections)) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `${name} · ${collection.variables.length} variables`;
    details.append(summary);
    const list = document.createElement("dl");
    for (const variable of collection.variables) {
      const cssName = `--${variable.type === "COLOR" ? "color-" : ""}${normalize(variable.name)}`;
      const term = document.createElement("dt");
      term.textContent = variable.name;
      const value = document.createElement("dd");
      const code = document.createElement("code");
      code.textContent = cssName;
      value.append(code);
      if (variable.type === "COLOR") {
        const chip = document.createElement("span");
        chip.className = "ds-chip";
        chip.style.backgroundColor = `var(${cssName})`;
        chip.setAttribute("aria-hidden", "true");
        value.append(chip);
      } else {
        const raw = variable.values.Default;
        const displayed = variable.name.startsWith("opacity/")
          ? String(Number(raw) / 100)
          : variable.name.startsWith("font/family/")
            ? '"Manrope Variable", Arial, sans-serif'
            : `${raw}${variable.type === "FLOAT" && !variable.name.includes("weight") && Number(raw) !== 0 ? "px" : ""}`;
        value.append(` · ${displayed}`);
      }
      list.append(term, value);
    }
    details.append(list);
    root.append(details);
  }
  return root;
}

export const Light = { render: () => renderReview("light") };
export const Dark = { render: () => renderReview("dark") };
