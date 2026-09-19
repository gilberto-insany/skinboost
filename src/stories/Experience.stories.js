import { expect, fn, waitFor } from "storybook/test";
import { mountExperience } from "../experience.js";
import {
  createThreadState,
  createThreadFixture,
  sendMessage,
  act,
  appendUserMessage,
  acceptAssistantResponse,
} from "../chat/thread-state.js";
import {
  createAlternative,
  recordContextChanges,
  makeConversationNote,
} from "../chat/conversation-tools.js";

import {
  PHOTO_CHAT_RESPONSE,
  LIMITED_PHOTO_CHAT_RESPONSE,
} from "../../tests/fixtures/photo-chat.mjs";

let portraitPromise;
function fixturePortrait() {
  portraitPromise ||= fetch("/media/persona-lucas.jpg").then(
    async (response) => {
      if (!response.ok)
        throw new Error("The local fictional portrait is missing.");
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    },
  );
  return portraitPromise;
}

// Each canvas has its own instance; removal destroys event listeners and timers.
const mounts = new Map();

function stateWithOrigins(scenario = "general") {
  const source = createThreadFixture("review", scenario);
  let state = createThreadState();
  for (const message of source.messages.filter(
    (item) => item.role === "user",
  )) {
    const previous = { ...state.context };
    state = sendMessage(state, message.text);
    recordContextChanges(
      state,
      previous,
      state.messages.findLast((item) => item.role === "user"),
    );
  }
  return act(state, "confirm");
}

async function fixtureState(args) {
  if (!args.fixture) return undefined;
  if (args.fixture.startsWith("photo-")) {
    const portrait = await fixturePortrait();
    let state = appendUserMessage(
      createThreadState(),
      "Exemplo de componente com retrato fictício gerado por IA. A observação abaixo é uma fixture didática, não uma avaliação da imagem.",
    );
    state.photoDataUrl = portrait;
    state.photoName = "Lucas · persona fictícia gerada por IA";
    state.photoConsent = false;
    state.messages.at(-1).photo = portrait;
    state = acceptAssistantResponse(
      state,
      structuredClone(
        args.fixture === "photo-limited"
          ? LIMITED_PHOTO_CHAT_RESPONSE
          : PHOTO_CHAT_RESPONSE,
      ),
    );
    if (args.fixture === "photo-observed") {
      // Controlled local fixture: expose the same choices without a live API.
      state.photoConsent = true;
      state.photoSubmitted = true;
      state.photoAnalysisId = state.messages.at(-1).id;
      state.awaitingPhotoProduct = true;
      state.messages.at(-1).choices = [];
    }
    if (args.fixture === "photo-comparison")
      state.messages.push({
        id: "story-photo-comparison",
        role: "assistant",
        kind: "simulation",
        text: "Demonstração do comparador: o mesmo retrato fictício aparece dos dois lados, sem alteração estética. Nenhuma imagem nova foi gerada neste exemplo.",
        original: portrait,
        image: portrait,
        selectedProductId: "comfort",
      });
    return state;
  }
  const state = stateWithOrigins(args.scenario);
  if (args.fixture === "alternative")
    return createAlternative(state, {
      sourceId: "story-original",
      title: "Minha rotina original · exemplo local",
      choice: "budget",
    });
  if (args.fixture === "feedback")
    state.messages.at(-1).feedback = { reason: "Fonte insuficiente" };
  if (args.fixture === "note")
    state.messages.push({
      id: "story-note",
      role: "assistant",
      kind: "note",
      text: "Aqui está o resumo revisável desta conversa de demonstração.",
      note: makeConversationNote(state),
    });
  return state;
}

// Only this isolated fixture replaces the audio adapter. No microphone or API.
function demonstrationVoice({ getDraft, onDraft, onState }) {
  let previous = "";
  let active = false;
  return {
    supported: true,
    start() {
      previous = getDraft();
      active = true;
      onState({ status: "listening" });
    },
    stop() {
      if (active)
        onDraft(
          [previous, "Quero uma rotina com poucos passos."]
            .filter(Boolean)
            .join(" "),
        );
      active = false;
      onState({ status: "idle" });
    },
    cancel() {
      active = false;
      onDraft(previous);
      onState({ status: "idle" });
    },
    handleTypedInput() {},
    destroy() {
      active = false;
    },
  };
}

function renderExperience(args) {
  const host = document.createElement("div");
  host.className = "sb-story-host";
  host.dataset.initialStep = args.initialStep;
  let instance;
  let attached = false;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    instance?.destroy();
    mounts.delete(host);
  };
  const mount = async () => {
    if (stopped || !host.isConnected) return;
    attached = true;
    const state = await fixtureState(args);
    if (stopped || !host.isConnected) return;
    instance = mountExperience(host, {
      initialStep: args.initialStep,
      scenario: args.scenario,
      liveApi: false,
      state,
      ...(args.voiceDemo
        ? {
            voiceFactory: demonstrationVoice,
            getSaveStatus: () =>
              "Voz demonstrativa · sem microfone nem envio de áudio",
          }
        : {}),
      onClose: () => {
        args.onClose();
        instance?.destroy();
        host.replaceChildren();
        host.classList.remove("sb-experience");
        const closed = document.createElement("div");
        closed.className = "sb-story-close";
        closed.innerHTML =
          "<h2>Experiência encerrada.</h2><p>Este é o mesmo callback de fechamento usado pela página.</p>";
        const reopen = document.createElement("button");
        reopen.className = "pill dark";
        reopen.textContent = "Reabrir exemplo";
        reopen.onclick = mount;
        closed.append(reopen);
        host.append(closed);
      },
    });
  };
  const observer = new MutationObserver(() => {
    if (!attached && host.isConnected) mount();
    else if (attached && !host.isConnected) stop();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  mounts.set(host, stop);
  requestAnimationFrame(() => {
    if (!attached) mount();
  });
  return host;
}

export default {
  id: "experiencia-jornada-guiada",
  title: "Experiência/Conversa contínua",
  tags: ["autodocs"],
  args: { initialStep: "welcome", scenario: "general", onClose: fn() },
  argTypes: {
    initialStep: {
      control: "select",
      options: ["welcome", "context", "routine", "cart", "checkout", "checkin"],
      description:
        "Ponto inicial da conversa real, com mensagens e artefatos no mesmo histórico. Não representa uma etapa de formulário.",
    },
    scenario: {
      control: "select",
      options: ["acne", "oiliness", "general", "dry"],
      description:
        "Contexto de exemplo declarado na conversa, sem diagnóstico ou análise de imagem.",
    },
    onClose: { table: { disable: true } },
    fixture: { table: { disable: true } },
    voiceDemo: { table: { disable: true } },
  },
  render: renderExperience,
  beforeEach: () => () => {
    for (const [host, stop] of mounts) if (!host.isConnected) stop();
  },
  parameters: {
    docs: {
      story: { inline: false },
      description: {
        component:
          "Chat real de src/experience.js: texto livre e sugestões acrescentam mensagens; contexto, rotina, fontes e seleção permanecem no mesmo histórico. Cada canvas tem sua própria sessão demonstrativa. Não há diagnóstico, análise de foto, pedido ou pagamento real.",
      },
    },
  },
};

export const BoasVindas = {
  name: "Conversa inicial",
  args: { initialStep: "welcome" },
};
export const Contexto = {
  name: "Contexto na conversa",
  args: { initialStep: "context" },
};
export const Rotina = {
  name: "Rotina no histórico",
  args: { initialStep: "routine" },
};
export const Carrinho = {
  name: "Seleção no histórico",
  args: { initialStep: "cart" },
};
export const Checkout = {
  name: "Revisão demonstrativa",
  args: { initialStep: "checkout" },
};
export const Checkin = {
  name: "Check-in na conversa",
  args: { initialStep: "checkin" },
};

export const Acne = {
  name: "Cenário · acne declarada",
  args: { initialStep: "context", scenario: "acne" },
};
export const Oleosidade = {
  name: "Cenário · oleosidade",
  args: { initialStep: "context", scenario: "oiliness" },
};
export const CuidadosGerais = {
  name: "Cenário · cuidados gerais",
  args: { initialStep: "context", scenario: "general" },
};
export const Ressecamento = {
  name: "Cenário · ressecamento",
  args: { initialStep: "context", scenario: "dry" },
};

export const MensagemLivre = {
  name: "Texto livre · histórico preservado",
  args: { initialStep: "welcome", scenario: "general" },
  play: async ({ canvas, userEvent }) => {
    const log = await canvas.findByRole("log");
    const previousIds = [...log.querySelectorAll("[data-message-id]")].map(
      (el) => el.dataset.messageId,
    );
    const message =
      "Minha pele fica oleosa ao longo do dia. Quero poucos passos.";
    const composer = canvas.getByRole("textbox", { name: /mensagem/i });
    await userEvent.type(composer, message);
    await userEvent.click(
      canvas.getByRole("button", { name: "Enviar mensagem" }),
    );
    await waitFor(() =>
      expect(canvas.getByRole("log")).toHaveTextContent(message),
    );
    for (const id of previousIds)
      await expect(
        canvas.getByRole("log").querySelector(`[data-message-id="${id}"]`),
      ).toBeInTheDocument();
    await expect(
      canvas.getByRole("textbox", { name: /mensagem/i }),
    ).toBeVisible();
  },
};

export const SugestaoComoMensagem = {
  name: "Sugestão · resposta na conversa",
  args: { initialStep: "context", scenario: "oiliness" },
  play: async ({ canvas, userEvent }) => {
    const log = await canvas.findByRole("log");
    const previousIds = [...log.querySelectorAll("[data-message-id]")].map(
      (el) => el.dataset.messageId,
    );
    const replies = canvas
      .getAllByRole("button")
      .filter((el) => el.hasAttribute("data-reply"));
    const reply = replies.at(-1);
    await expect(reply).toBeVisible();
    const text = reply.getAttribute("data-reply");
    await userEvent.click(reply);
    await waitFor(() =>
      expect(
        canvas.getByRole("log").querySelectorAll("[data-message-id]").length,
      ).toBeGreaterThan(previousIds.length),
    );
    await expect(canvas.getByRole("log")).toHaveTextContent(text);
    for (const id of previousIds)
      await expect(
        canvas.getByRole("log").querySelector(`[data-message-id="${id}"]`),
      ).toBeInTheDocument();
  },
};

export const CarrinhoVazio = {
  name: "Carrinho · seleção vazia",
  args: { initialStep: "cart" },
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole("checkbox");
    let checked = canvas
      .getAllByRole("checkbox")
      .find((el) => el.checked && !el.disabled);
    while (checked) {
      await userEvent.click(checked);
      checked = canvas
        .getAllByRole("checkbox")
        .find((el) => el.checked && !el.disabled);
    }
    await expect(
      canvas.getByRole("button", { name: /checkout/i }),
    ).toBeDisabled();
  },
};

export const OrigemDoContexto = {
  name: "Contexto · origem nas mensagens",
  args: { initialStep: "routine", fixture: "origins" },
};

export const ResumoDaConversa = {
  name: "Resumo · notas revisáveis",
  args: { initialStep: "routine", fixture: "note" },
};

export const Alternativa = {
  name: "Outra opção · contexto herdado",
  args: { initialStep: "routine", fixture: "alternative" },
};

export const FeedbackRegistrado = {
  name: "Feedback · registro nesta conversa",
  args: { initialStep: "routine", fixture: "feedback" },
};

export const VozRevisavel = {
  name: "Voz · demonstração sem áudio",
  args: { initialStep: "welcome", voiceDemo: true },
  parameters: {
    docs: {
      description: {
        story:
          "Adaptador determinístico apenas para revisar os estados da interface. Não acessa microfone, não grava e não chama API. O texto aparece no rascunho e precisa de envio explícito.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    const composer = await canvas.findByRole("textbox", { name: /mensagem/i });
    await userEvent.type(composer, "Meu rascunho inicial.");
    await userEvent.click(
      canvas.getByRole("button", { name: "Ditar mensagem" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Ativar microfone" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Revise antes de enviar",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Concluir ditado" }),
    );
    await expect(composer).toHaveValue(
      "Meu rascunho inicial. Quero uma rotina com poucos passos.",
    );
    await expect(
      canvas.getByRole("log").querySelectorAll('[data-role="user"]').length,
    ).toBe(0);
  },
};

export const FotoObservada = {
  name: "Foto · observações e fontes",
  args: { fixture: "photo-observed" },
  parameters: {
    docs: {
      description: {
        story:
          "Fixture de contrato aplicada por acceptAssistantResponse. Retrato de persona fictícia; não é análise de uma pessoa. Mostra observações, escolha de produto antes da geração e fontes do PDF, sem chamar a IA. No celular, a imagem do produto fica acima do texto.",
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("region", { name: "Observações da foto" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("region", { name: "Relação com o catálogo" }),
    ).toHaveTextContent("Qual produto você quer explorar?");
    await expect(
      canvas.getByRole("button", { name: "Explorar Cleanse ↗" }),
    ).toBeVisible();
  },
};
export const FotoLimitada = {
  name: "Foto · observação limitada",
  args: { fixture: "photo-limited" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Imagem limitada")).toBeVisible();
    await expect(
      canvas.queryByRole("region", { name: "Relação com o catálogo" }),
    ).not.toBeInTheDocument();
  },
};
export const ComparacaoIlustrativa = {
  name: "Foto · comparador ilustrativo",
  args: { fixture: "photo-comparison" },
  parameters: {
    docs: {
      description: {
        story:
          "O mesmo retrato fictício ocupa os dois lados, no contexto do conceito Comfort. Este estado testa arraste direto na foto com toque ou mouse, controle por teclado e limites visíveis; não simula melhora nem afirma um resultado gerado.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    const slider = await canvas.findByRole("slider", {
      name: "Quanto da foto original mostrar",
    });
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(slider).toHaveAttribute(
      "aria-valuetext",
      "51% da foto original",
    );
  },
};
