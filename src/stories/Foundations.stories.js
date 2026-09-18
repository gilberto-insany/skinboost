import { expect, fn } from 'storybook/test';

const meta = {
  title: 'Fundamentos/Identidade',
  tags: ['autodocs'],
  args: {},
  parameters: { controls: { disable: true } },
};
export default meta;

function foundation(title, description) {
  const root = document.createElement('section');
  root.className = 'sb-foundation';
  const heading = document.createElement('h1');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = description;
  root.append(heading, text);
  return root;
}

export const Paleta = {
  name: 'Paleta e tokens',
  render: (_, { parameters }) => {
    const proposed = parameters.skinboostMode === 'hifi';
    const root = foundation('Cor com função.', proposed
      ? 'Proposta: cores extraídas do brandbook, aplicadas apenas neste catálogo. A página continua usando a identidade atual.'
      : 'Valores ativos de src/styles.css. As amostras consultam as mesmas variáveis que a experiência implementada.');
    const grid = document.createElement('div');
    grid.className = 'sb-token-grid';
    const tokens = [
      ['--ink', 'Texto e ação principal'], ['--paper', 'Superfície marfim'],
      ['--sage', 'Superfície sálvia'], ['--lime', 'Acento Boost'],
      ['--muted', 'Texto de apoio'], ['--line', 'Divisórias'],
      ...(proposed ? [['--forest', 'Forest · apoio'], ['--mist', 'Mist · apoio']] : []),
    ];
    tokens.forEach(([token, label]) => {
      const card = document.createElement('article');
      card.className = 'sb-token';
      const swatch = document.createElement('div');
      swatch.className = 'sb-token-color';
      swatch.style.background = `var(${token})`;
      const info = document.createElement('div');
      info.className = 'sb-token-meta';
      const name = document.createElement('strong');
      name.textContent = label;
      const value = document.createElement('code');
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
    const proposed = parameters.skinboostMode === 'hifi';
    const root = foundation('Clareza antes do excesso.', proposed
      ? 'Avenir Next / Avenir, com fallback Helvetica e Arial. A fonte depende da disponibilidade local; nenhum arquivo proprietário foi distribuído.'
      : 'Arial / Helvetica / sans-serif. Escala, peso regular e respiro editorial da interface atual.');
    const samples = [
      ['Display', 'h1', 'Sua pele. Seu próximo passo.'],
      ['Título', 'h2', 'Uma rotina que começa por você.'],
      ['Subtítulo', 'h3', 'O porquê vem junto.'],
      ['Corpo', 'p', 'Seus hábitos, suas preferências e o que você quer cuidar vêm antes de um produto.'],
    ];
    samples.forEach(([label, tag, copy]) => {
      const row = document.createElement('div');
      row.className = 'sb-type-sample';
      const name = document.createElement('small');
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
  name: 'Botões e foco',
  args: { onPrimary: fn() },
  argTypes: { onPrimary: { table: { disable: true } } },
  render: ({ onPrimary }) => {
    const root = foundation('Ações reconhecíveis.', 'Classes reais .pill, .dark, .outline e .icon-btn. Use Tab para conferir o foco; o estado desabilitado não executa uma ação.');
    const row = document.createElement('div');
    row.className = 'sb-button-row';
    const primary = document.createElement('button');
    primary.className = 'pill dark';
    primary.textContent = 'Continuar';
    primary.onclick = onPrimary;
    const secondary = document.createElement('button');
    secondary.className = 'pill outline';
    secondary.textContent = 'Editar contexto';
    const disabled = document.createElement('button');
    disabled.className = 'pill dark';
    disabled.textContent = 'Aguardando resposta';
    disabled.disabled = true;
    const close = document.createElement('button');
    close.className = 'icon-btn';
    close.setAttribute('aria-label', 'Fechar exemplo');
    close.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';
    row.append(primary, secondary, disabled, close);
    root.append(row);
    return root;
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Continuar' }));
    await expect(args.onPrimary).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: 'Aguardando resposta' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Fechar exemplo' })).toHaveAccessibleName();
  },
};

export const Cobertura = {
  name: 'Componentes e estados',
  render: () => {
    const root = foundation('Uma experiência, dois catálogos.', 'Os estados abaixo usam mountExperience, a mesma implementação da página. Este inventário acompanha os componentes; não duplica a lógica da jornada.');
    const table = document.createElement('table');
    table.className = 'sb-state-table';
    table.innerHTML = `<thead><tr><th scope="col">Estado</th><th scope="col">Componentes reais</th><th scope="col">O que verificar</th></tr></thead><tbody>
      <tr><th scope="row">Boas-vindas</th><td>Entrada por intenção e sugestões</td><td>Nome acessível, teclado, texto longo</td></tr>
      <tr><th scope="row">Contexto</th><td>Conversa, respostas e progresso</td><td>Voltar, corrigir, alternativas e validação</td></tr>
      <tr><th scope="row">Rotina</th><td>Resumo e cards de produtos</td><td>Explicações, editar, sequência e responsividade</td></tr>
      <tr><th scope="row">Carrinho</th><td>Itens e ações de revisão</td><td>Quantidades, remoção e estado vazio</td></tr>
      <tr><th scope="row">Checkout</th><td>Resumo da simulação</td><td>Sem cobrança ou pedido real</td></tr>
      <tr><th scope="row">Check-in</th><td>Opções de acompanhamento</td><td>Seleção, retorno e anúncio de resultado</td></tr>
    </tbody>`;
    root.append(table);
    return root;
  },
};
