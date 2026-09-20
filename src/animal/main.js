import "./style.css";
import { preparePhoto } from "../chat/photo.js";
import { readChatResponse } from "../chat/response-stream.js";
const $ = (selector) => document.querySelector(selector);
const input = $("#animal-input");
const history = [];
let accepted = false,
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
    img.alt = "Foto que você enviou para a brincadeira";
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
    $("#photo-consent"),
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
  $("#photo-consent").checked = false;
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
  accepted = true;
  $("#intro").hidden = true;
  $("#thread").hidden = false;
  $("#suggestions").hidden = false;
  $("#composer-controls").disabled = false;
  input.placeholder = "Vai. Confessa sua rotina…";
  row(
    "assistant",
    "Entrou porque quis, hein. Conta sua rotina. Se for só água e esperança, já adianto: a esperança tá fazendo hora extra.",
  );
  input.focus();
}
$("#start").addEventListener("click", begin);
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
  $("#thread").replaceChildren();
  if (accepted) {
    row(
      "assistant",
      "Zeramos a conversa. Agora entrega a próxima confissão. Eu já tô de braços cruzados.",
    );
    suggestions([
      {
        label: "Julga minha rotina",
        value: "Quero que você julgue minha rotina",
      },
    ]);
    input.focus();
  }
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
    $("#photo-consent").checked = false;
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
  if (!accepted || pending || preparingPhoto) return;
  if (photo && !$("#photo-consent").checked && !retry) {
    error(
      "Autorize o envio da sua foto ou remova o anexo para continuar só com texto.",
    );
    return;
  }
  const text = retry
    ? failed?.text
    : input.value.trim() ||
      (photo ? "Pode zoar minha foto, é uma brincadeira comigo." : "");
  if (!text) {
    input.focus();
    return;
  }
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
  status("Preparando uma resposta sem passar pano…");
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
    suggestions(result.choices || []);
    status(
      result.care
        ? "Brincadeira pausada. Você pode continuar no chat gentil."
        : "Sua vez. Tem mais alguma confissão?",
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
});
