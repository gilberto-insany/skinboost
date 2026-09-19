import { expect, fn, waitFor } from "storybook/test";
import { mountExperience } from "../experience.js";
import {
  createThreadState,
  createThreadFixture,
  sendMessage,
  act,
} from "../chat/thread-state.js";
import {
  createAlternative,
  recordContextChanges,
  makeConversationNote,
} from "../chat/conversation-tools.js";

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

function fixtureState(args) {
  if (!args.fixture) return undefined;
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
  const mount = () => {
    if (stopped || !host.isConnected) return;
    attached = true;
    instance = mountExperience(host, {
      initialStep: args.initialStep,
      scenario: args.scenario,
      liveApi: false,
      state: fixtureState(args),
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
