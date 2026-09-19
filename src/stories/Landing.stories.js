import { expect, fn, waitFor } from "storybook/test";
import { mountLandingCatalog, LANDING_COMPONENTS } from "../landing/catalog.js";
import "./landing-catalog.css";

const mounts = new Map();
function renderLanding(args) {
  const host = document.createElement("div");
  host.className = "sb-landing-host";
  let instance,
    attached = false,
    stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    instance?.destroy();
    mounts.delete(host);
  };
  const mount = () => {
    if (stopped || !host.isConnected || attached) return;
    attached = true;
    instance = mountLandingCatalog(host, args);
  };
  const observer = new MutationObserver(() => {
    if (!attached && host.isConnected) mount();
    else if (attached && !host.isConnected) stop();
  });
  observer.observe(document.body, { subtree: true, childList: true });
  mounts.set(host, stop);
  requestAnimationFrame(mount);
  return host;
}
const ready = async ({ canvasElement }) => {
  await waitFor(() =>
    expect(canvasElement.querySelector('[data-ready="true"]')).not.toBeNull(),
  );
};
export default {
  id: "landing-componentes",
  title: "Landing/Componentes reais",
  parameters: {
    layout: "fullscreen",
    landingCatalog: true,
    docs: {
      description: {
        component:
          "Componentes da landing atual de Gilberto. A marcação vem diretamente de index.html e os controladores são compartilhados com o site. Ações de conversa são callbacks locais; nenhuma história chama IA ou acessa conversas salvas. A futura alta fidelidade está em outro catálogo.",
      },
    },
  },
  args: {
    component: "home",
    onIntent: fn(),
    onNavigate: fn(),
    onDemo: fn(),
    onCheckin: fn(),
  },
  argTypes: {
    component: { control: "select", options: Object.keys(LANDING_COMPONENTS) },
    onIntent: { table: { disable: true } },
    onNavigate: { table: { disable: true } },
    onDemo: { table: { disable: true } },
    onCheckin: { table: { disable: true } },
  },
  beforeEach: () => {
    for (const stop of mounts.values()) stop();
  },
  render: renderLanding,
  play: ready,
};

export const Home = {
  name: "Home completa · atual",
  args: { component: "home" },
};
export const Cabecalho = {
  name: "Cabeçalho e navegação",
  args: { component: "header" },
};
export const HeroPrompt = {
  name: "Hero e prompt",
  args: { component: "hero" },
};
export const PromptErro = {
  name: "Prompt · pedido vazio",
  args: { component: "hero" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("button", {
        name: "Conhecer minha rotina a partir do prompt",
      }),
    );
    await expect(context.canvas.getByRole("alert")).toHaveTextContent(
      "Conte um pouco sobre sua pele",
    );
    await expect(context.args.onIntent).not.toHaveBeenCalled();
  },
};
export const PromptSugestao = {
  name: "Prompt · sugestão revisável",
  args: { component: "hero" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Quero começar" }),
    );
    await expect(context.canvas.getByRole("textbox")).toHaveValue(
      "Quero começar a cuidar da minha pele com poucos passos.",
    );
    await expect(context.args.onIntent).not.toHaveBeenCalled();
  },
};
export const PromptFoto = {
  name: "Prompt · arquivo opcional",
  args: { component: "hero" },
  parameters: {
    docs: {
      description: {
        story:
          "Um PNG sintético de um pixel percorre validatePhoto/preparePhoto reais. Não há pessoa, análise ou envio de imagem. Remover foto usa o mesmo controlador do aplicativo.",
      },
    },
  },
  play: async (context) => {
    await ready(context);
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6l1sAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    await context.userEvent.upload(
      context.canvas.getByLabelText(/Adicionar foto/),
      new File([bytes], "arquivo-ilustrativo.png", { type: "image/png" }),
    );
    await waitFor(() =>
      expect(
        context.canvas.getByRole("button", { name: "Remover foto" }),
      ).toBeVisible(),
    );
  },
};
export const Introducao = {
  name: "Introdução editorial",
  args: { component: "intro" },
};
export const ComoFunciona = {
  name: "Tabs · conversa",
  args: { component: "tabs" },
};
export const EscolhaExplicada = {
  name: "Tabs · escolha explicada",
  args: { component: "tabs" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("tab", { name: /Entenda cada escolha/ }),
    );
    await expect(context.canvas.getByRole("tabpanel")).toHaveTextContent(
      "Cada escolha, explicada.",
    );
  },
};
export const Continuidade = {
  name: "Tabs · continuidade",
  args: { component: "tabs" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("tab", { name: /Encontre seu ritmo/ }),
    );
    await expect(context.canvas.getByRole("tabpanel")).toHaveTextContent(
      "A rotina acompanha você.",
    );
  },
};
export const Manifesto = {
  name: "Manifesto e movimento",
  args: { component: "manifesto" },
  parameters: {
    docs: {
      description: {
        story:
          "Animação GSAP/ScrollTrigger original, com pausa e redução de movimento. Role o canvas para acompanhar a progressão.",
      },
    },
  },
};
export const BentoCompleto = {
  name: "Bento · composição completa",
  args: { component: "bento" },
};
export const BentoContexto = {
  name: "Bento · contexto e tags",
  args: { component: "bento-context" },
};
export const BentoMotivo = {
  name: "Bento · escolhas explicadas",
  args: { component: "bento-reason" },
};
export const BentoProdutos = {
  name: "Bento · fotografia de produto",
  args: { component: "bento-photo" },
};
export const BentoPrivacidade = {
  name: "Bento · privacidade",
  args: { component: "bento-privacy" },
};
export const BentoCheckin = {
  name: "Bento · check-in",
  args: { component: "bento-checkin" },
};
export const Produto3D = {
  name: "Produto 3D · Comfort",
  args: { component: "product" },
  parameters: {
    docs: {
      description: {
        story:
          "Mesmo GLB, Three.js, materiais e movimento de tampa do site. Role o canvas; com movimento reduzido, o frasco fica estável. Sem WebGL, a imagem original funciona como alternativa. Recursos são liberados ao trocar de story.",
      },
    },
  },
};
export const Catalogo = {
  name: "Catálogo · linha conceitual",
  args: { component: "catalog" },
};
async function openProduct(context, name) {
  await ready(context);
  await context.userEvent.click(
    context.canvas.getByRole("button", { name: new RegExp(name) }),
  );
  await expect(context.canvas.getByRole("dialog")).toHaveTextContent(
    "Produto indisponível para compra.",
  );
}
export const Cleanse = {
  name: "Produto · Cleanse aberto",
  args: { component: "catalog" },
  play: (context) => openProduct(context, "Cleanse"),
};
export const Balance = {
  name: "Produto · Balance aberto",
  args: { component: "catalog" },
  play: (context) => openProduct(context, "Balance"),
};
export const Comfort = {
  name: "Produto · Comfort aberto",
  args: { component: "catalog" },
  play: (context) => openProduct(context, "Comfort"),
};
export const Comparador = {
  name: "Comparador · estrutura ilustrativa",
  args: { component: "comparison" },
};
export const RelatoLucas = {
  name: "Relato fictício · Lucas",
  args: { component: "stories" },
};
export const RelatoMarina = {
  name: "Relato fictício · Marina",
  args: { component: "stories" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Próximo relato" }),
    );
    await expect(context.canvas.getByText("Marina, 29")).toBeVisible();
  },
};
export const RelatoDenise = {
  name: "Relato fictício · Denise",
  args: { component: "stories" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Relato anterior" }),
    );
    await expect(context.canvas.getByText("Denise, 48")).toBeVisible();
  },
};
export const Confianca = {
  name: "Confiança e critérios",
  args: { component: "trust" },
};
export const PerguntasFrequentes = {
  name: "FAQ · fechado",
  args: { component: "faq" },
};
export const PerguntaAberta = {
  name: "FAQ · resposta aberta",
  args: { component: "faq" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvasElement.querySelector("summary"),
    );
    await expect(
      context.canvasElement.querySelector("details"),
    ).toHaveAttribute("open");
  },
};
export const ChamadaFinal = {
  name: "Chamada final",
  args: { component: "cta" },
};
export const Rodape = {
  name: "Rodapé · sem área reservada",
  args: { component: "footer" },
};
export const Privacidade = {
  name: "Diálogo · privacidade",
  args: { component: "footer" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Privacidade" }),
    );
    await expect(context.canvas.getByRole("dialog")).toHaveTextContent(
      "Sua foto. Sua escolha.",
    );
  },
};
export const Sobre = {
  name: "Diálogo · sobre a demonstração",
  args: { component: "footer" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Sobre a demonstração" }),
    );
    await expect(context.canvas.getByRole("dialog")).toHaveTextContent(
      "Uma experiência para explorar.",
    );
  },
};
export const Redes = {
  name: "Diálogo · redes demonstrativas",
  args: { component: "footer" },
  play: async (context) => {
    await ready(context);
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Instagram — demonstrativo" }),
    );
    await expect(context.canvas.getByRole("dialog")).toHaveTextContent(
      "Os perfis oficiais ainda não foram definidos.",
    );
  },
};
