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

export async function fixtureState(args) {
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
export function demonstrationVoice({ getDraft, onDraft, onState }) {
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
