import "./style.css";
import { preparePhoto } from "../chat/photo.js";
import { readChatResponse } from "../chat/response-stream.js";
import { mountPhotoComparisonController } from "../chat/photo-comparison.js";
import { createParodyCard } from "./parody.js";
const $ = (selector) => document.querySelector(selector);
const input = $("#animal-input");
const history = [];
const comparisons = mountPhotoComparisonController($("#thread"));
let started = false,
  pending = false,
  preparingPhoto = false,
  photo = "",
  controller,
  failed = null,
  generation = 0,
  photoGeneration = 0;
const scroll = () => {
  const area = $("#scroll-area");
  area.scrollTop = area.scrollHeight;
};
function error(message = "") {
  $("#chat-error").textContent = message;
  $("#chat-error").hidden = !message;
}
function status(message = "") {
  $("#connection-status").textContent = message;
}
function row(role, text, image = "") {
  const article = document.createElement("article");
  article.className = `message message-${role}`;
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent =
    role === "user" ? "Você" : "SKINBOOST ANIMAL / SEM PASSAR PANO";
  article.append(label);
  if (image) {
    const img = document.createElement("img");
    img.className = "message-photo";
    img.alt = "Foto enviada por você";
    img.src = image;
    article.append(img);
  }
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(paragraph);
  $("#thread").append(article);
  scroll();
  return { article, paragraph };
}
function busy(value) {
  pending = value;
  for (const node of [
    $("#send"),
    $("#animal-photo"),
    $("#remove-photo"),
    $("#retry"),
  ])
    node.disabled = value;
  $("#send").disabled = value || preparingPhoto;
  $("#stop").hidden = !value;
  $("#send").hidden = value;
  $("#suggestions")
    .querySelectorAll("button")
    .forEach((button) => {
      button.disabled = value;
    });
}
function clearPhoto() {
  photoGeneration++;
  preparingPhoto = false;
  $("#send").disabled = pending;
  photo = "";
  $("#animal-photo").value = "";
  $("#photo-preview").hidden = true;
  $("#photo-permission").hidden = true;
  $("#photo-image").removeAttribute("src");
}
function suggestions(choices) {
  const area = $("#suggestions");
  area.replaceChildren();
  for (const choice of choices) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = choice.label;
    b.dataset.value = choice.value;
    area.append(b);
  }
  area.hidden = !choices.length;
  scroll();
}
function begin() {
  started = true;
  $("#intro").hidden = true;
  $("#thread").hidden = false;
}
$("#restart").addEventListener("click", () => {
  generation++;
  controller?.abort();
  busy(false);
  history.length = 0;
  failed = null;
  clearPhoto();
  error();
  status();
  $("#retry").hidden = true;
  input.value = "";
  started = false;
  $("#intro").hidden = false;
  $("#thread").hidden = true;
  $("#thread").replaceChildren();
  suggestions([
    {
      label: "Quero cuidar da minha pele",
      value: "Quero cuidar da minha pele",
    },
    { label: "Minha pele está oleosa", value: "Minha pele está oleosa" },
    {
      label: "Quero organizar minha rotina",
      value: "Quero organizar minha rotina",
    },
  ]);
  $("#scroll-area").scrollTop = 0;
  input.focus();
});
$("#remove-photo").addEventListener("click", clearPhoto);
$("#animal-photo").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  clearPhoto();
  const token = ++photoGeneration;
  error();
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    error("Use uma foto JPG, PNG ou WebP de até 10 MB.");
    event.target.value = "";
    return;
  }
  preparingPhoto = true;
  $("#send").disabled = true;
  try {
    const prepared = await preparePhoto(file);
    if (token !== photoGeneration) return;
    photo = prepared;
    $("#photo-image").src = photo;
    $("#photo-name").textContent = file.name;
    $("#photo-preview").hidden = false;
    $("#photo-permission").hidden = false;
  } catch {
    if (token === photoGeneration)
      error("Não consegui abrir essa foto. Tente outro arquivo.");
  } finally {
    if (token === photoGeneration) {
      preparingPhoto = false;
      $("#send").disabled = pending;
    }
  }
});
async function send(retry = false) {
  if (pending || preparingPhoto) return;
  const text = retry
    ? failed?.text
    : input.value.trim() || (photo ? "O que você acha da minha pele?" : "");
  if (!text) {
    input.focus();
    return;
  }
  if (!started) begin();
  const attachment = retry ? failed.photo : photo;
  const messages = retry
    ? failed.messages
    : [...history, { role: "user", text }].slice(-9);
  failed = { text, photo: attachment, messages };
  if (!retry) {
    row("user", text, attachment);
    input.value = "";
  }
  error();
  $("#retry").hidden = true;
  busy(true);
  status("Preparando sua resposta…");
  const turn = ++generation;
  controller = new AbortController();
  let responseRow;
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      signal: controller.signal,
      body: JSON.stringify({
        mode: "animal",
        humorConsent: true,
        messages,
        context: {},
        photoDataUrl: attachment || undefined,
        photoConsent: !!attachment,
      }),
    });
    let partial = "";
    const result = await readChatResponse(response, {
      onDelta(delta) {
        if (turn !== generation) return;
        partial += delta;
        responseRow ||= row("assistant", "");
        responseRow.paragraph.textContent = partial;
        scroll();
      },
    });
    if (turn !== generation) return;
    responseRow ||= row("assistant", "");
    responseRow.paragraph.textContent = result.text;
    history.push(
      { role: "user", text },
      { role: "assistant", text: result.text },
    );
    if (history.length > 30) history.splice(0, history.length - 30);
    failed = null;
    clearPhoto();
    if (attachment && !result.care) {
      suggestions([]);
      await generateParody(attachment, responseRow.article, turn);
      if (turn !== generation) return;
    }
    suggestions(result.choices || []);
    status(
      result.care
        ? "Brincadeira pausada. Você pode continuar no chat gentil."
        : "Quer acrescentar mais alguma coisa?",
    );
  } catch (cause) {
    if (turn !== generation) return;
    responseRow?.article.remove();
    error(
      cause.name === "AbortError"
        ? "Resposta interrompida. Seu pedido foi preservado."
        : cause.message || "A conexão falhou. Tente novamente.",
    );
    $("#retry").hidden = false;
    status("Não houve resposta completa da IA.");
  } finally {
    if (turn === generation) {
      busy(false);
      scroll();
    }
  }
}

async function generateParody(original, article, initialTurn) {
  const style = Math.random() < 0.5 ? "witch" : "clown";
  const card = createParodyCard(article, original, {
    onRetry: async () => {
      if (pending || preparingPhoto || !article.isConnected) return;
      busy(true);
      controller = new AbortController();
      const turn = ++generation;
      await run(turn);
      if (turn === generation) {
        busy(false);
        status("Quer acrescentar mais alguma coisa?");
      }
    },
    onOffer: () => {
      if (pending) return;
      input.value =
        "Me oferece o produto de brincadeira NASCER DE NOVO. Quero esse milagre fictício.";
      send();
    },
  });
  async function run(turn) {
    card.loading();
    status("Preparando seu antes e depois…");
    scroll();
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "animal",
          humorConsent: true,
          parodyConsent: true,
          consent: true,
          photoDataUrl: original,
          parodyStyle: style,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message || "Não consegui gerar a fantasia.",
        );
      if (turn !== generation) return;
      await card.complete(result, { signal: controller.signal });
      if (turn !== generation) return;
      comparisons.refresh();
      scroll();
    } catch (cause) {
      if (turn !== generation) return;
      card.fail(
        cause.name === "AbortError"
          ? "Transformação interrompida. Sua conversa foi preservada."
          : cause.message,
      );
    }
  }
  await run(initialTurn);
}

$("#animal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  send();
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
});
$("#suggestions").addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b || pending) return;
  input.value = b.dataset.value || b.textContent;
  send();
});
$("#retry").addEventListener("click", () => send(true));
$("#stop").addEventListener("click", () => controller?.abort());
window.addEventListener("pagehide", () => {
  generation++;
  controller?.abort();
  photoGeneration++;
  comparisons.destroy();
});
