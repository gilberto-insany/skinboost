import { expect, fn } from "storybook/test";

const meta = {
  title: "Fundamentos/Identidade",
  tags: ["autodocs"],
  args: {},
  parameters: { controls: { disable: true } },
};
export default meta;

function foundation(title, description) {
  const root = document.createElement("section");
  root.className = "sb-foundation";
  const heading = document.createElement("h1");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = description;
  root.append(heading, text);
  return root;
}

export const Paleta = {
  name: "Paleta e tokens",
  render: (_, { parameters }) => {
    const proposed = parameters.skinboostMode === "hifi";
    const root = foundation(
      "Cor com função.",
      proposed
        ? "Proposta: cores extraídas do brandbook, aplicadas apenas neste catálogo. A página continua usando a identidade atual."
        : "Identidade atualizada a partir do Figma: valores ativos de src/styles.css. As amostras consultam as mesmas variáveis que a experiência implementada.",
    );
    const grid = document.createElement("div");
    grid.className = "sb-token-grid";
    const tokens = [
      ["--ink", "Texto e ação principal"],
      ["--paper", "Superfície marfim"],
      ["--sage", "Superfície sálvia"],
      ["--lime", "Acento Boost"],
      ["--muted", "Texto de apoio"],
      ["--line", "Divisórias"],
      ...(proposed
        ? [
            ["--forest", "Forest · apoio"],
            ["--mist", "Mist · apoio"],
          ]
        : [
            ["--brand", "Marca · sálvia"],
            ["--brand-strong", "Marca · ênfase"],
          ]),
    ];
    tokens.forEach(([token, label]) => {
      const card = document.createElement("article");
      card.className = "sb-token";
      const swatch = document.createElement("div");
      swatch.className = "sb-token-color";
      swatch.style.background = `var(${token})`;
      const info = document.createElement("div");
      info.className = "sb-token-meta";
      const name = document.createElement("strong");
      name.textContent = label;
      const value = document.createElement("code");
      value.textContent = `${token} · ${getComputedStyle(document.documentElement).getPropertyValue(token).trim()}`;
      info.append(name, value);
      card.append(swatch, info);
      grid.append(card);
    });
    root.append(grid);
    return root;
  },
};

export const Tipografia = {
  render: (_, { parameters }) => {
    const proposed = parameters.skinboostMode === "hifi";
    const root = foundation(
      "Clareza antes do excesso.",
      proposed
        ? "Avenir Next / Avenir, com fallback Helvetica e Arial. A fonte depende da disponibilidade local; nenhum arquivo proprietário foi distribuído."
        : "Manrope Variable / Arial / sans-serif. Fonte local distribuída com o projeto, com pesos variáveis e a escala da identidade atualizada no Figma.",
    );
    const samples = [
      ["Display", "h1", "Sua pele. Seu próximo passo."],
      ["Título", "h2", "Uma rotina que começa por você."],
      ["Subtítulo", "h3", "O porquê vem junto."],
      [
        "Corpo",
        "p",
        "Seus hábitos, suas preferências e o que você quer cuidar vêm antes de um produto.",
      ],
    ];
    samples.forEach(([label, tag, copy]) => {
      const row = document.createElement("div");
      row.className = "sb-type-sample";
      const name = document.createElement("small");
      name.textContent = label;
      const sample = document.createElement(tag);
      sample.textContent = copy;
      row.append(name, sample);
      root.append(row);
    });
    return root;
  },
};

export const Botoes = {
  name: "Botões e foco",
  args: { onPrimary: fn() },
  argTypes: { onPrimary: { table: { disable: true } } },
  render: ({ onPrimary }) => {
    const root = foundation(
      "Ações reconhecíveis.",
      "Classes reais .pill, .dark, .outline e .icon-btn. Use Tab para conferir o foco; o estado desabilitado não executa uma ação.",
    );
    const row = document.createElement("div");
    row.className = "sb-button-row";
    const primary = document.createElement("button");
    primary.className = "pill dark";
    primary.textContent = "Continuar";
    primary.onclick = onPrimary;
    const secondary = document.createElement("button");
    secondary.className = "pill outline";
    secondary.textContent = "Editar contexto";
    const disabled = document.createElement("button");
    disabled.className = "pill dark";
    disabled.textContent = "Aguardando resposta";
    disabled.disabled = true;
    const close = document.createElement("button");
    close.className = "icon-btn";
    close.setAttribute("aria-label", "Fechar exemplo");
    close.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';
    row.append(primary, secondary, disabled, close);
    root.append(row);
    return root;
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Continuar" }));
    await expect(args.onPrimary).toHaveBeenCalledTimes(1);
    await expect(
      canvas.getByRole("button", { name: "Aguardando resposta" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Fechar exemplo" }),
    ).toHaveAccessibleName();
  },
};

export const Cobertura = {
  name: "Componentes e estados",
  render: () => {
    const root = foundation(
      "Uma experiência, dois catálogos.",
      "48 histórias do chat usam os mesmos templates da página, com um componente por canvas. Navegação, compositor e mensagens têm exemplos próprios. Ações entre componentes aparecem na aba Actions.",
    );
    const table = document.createElement("table");
    table.className = "sb-state-table";
    table.innerHTML = `<thead><tr><th scope="col">Estado</th><th scope="col">Componentes reais</th><th scope="col">O que verificar</th></tr></thead><tbody>
      <tr><th scope="row">Conversa</th><td>Cabeçalho, histórico e compositor isolados</td><td>Texto livre, teclado e callbacks de cada componente</td></tr>
      <tr><th scope="row">Contexto</th><td>Mensagens, esclarecimentos e sugestões</td><td>Acne declarada, oleosidade, cuidado geral e ressecamento</td></tr>
      <tr><th scope="row">Proposta</th><td>Resumo e cartões em histórias separadas</td><td>Seleção, correção e comparação no componente correspondente</td></tr>
      <tr><th scope="row">Fontes</th><td>Referências e limites isolados</td><td>Fonte educacional não equivale a endosso de produto</td></tr>
      <tr><th scope="row">Seleção</th><td>Checkboxes, total e revisão</td><td>Remoção, seleção vazia e ausência de cobrança real</td></tr>
      <tr><th scope="row">Check-in</th><td>Relato e próxima resposta</td><td>Callbacks das sugestões, sem previsão clínica</td></tr>
    </tbody>`;
    root.append(table);
    return root;
  },
};
