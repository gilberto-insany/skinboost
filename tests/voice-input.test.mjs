import test from "node:test";
import assert from "node:assert/strict";
import {
  createVoiceInput,
  createTranscriptBuffer,
} from "../src/chat/voice-input.js";

const event = (type, item_id, extra = {}) => ({ type, item_id, ...extra });
const delta = (item_id, text, extra = {}) =>
  event("conversation.item.input_audio_transcription.delta", item_id, {
    delta: text,
    ...extra,
  });
const completed = (item_id, text, extra = {}) =>
  event("conversation.item.input_audio_transcription.completed", item_id, {
    transcript: text,
    ...extra,
  });
function harness({
  draft = "Já escrevi:",
  gum,
  fetchImpl,
  secure = true,
  peerEnabled = true,
  autoFinal = null,
  timers,
} = {}) {
  const calls = [],
    writes = [],
    states = [],
    errors = [],
    tracks = [],
    peers = [];
  const doc = new EventTarget();
  doc.visibilityState = "visible";
  const win = new EventTarget();
  const makeStream = () => {
    const track = {
      enabled: true,
      stopped: 0,
      onended: null,
      stop() {
        this.stopped++;
      },
    };
    tracks.push(track);
    return { getAudioTracks: () => [track], getTracks: () => [track] };
  };
  class Peer {
    constructor() {
      this.connectionState = "new";
      this.closed = false;
      peers.push(this);
    }
    addTrack() {}
    createDataChannel() {
      const channel = {
        readyState: "connecting",
        sent: [],
        close() {
          this.readyState = "closed";
        },
        send(message) {
          this.sent.push(JSON.parse(message));
          if (autoFinal !== null)
            this.onmessage?.({
              data: JSON.stringify(completed("a", autoFinal)),
            });
        },
      };
      this.channel = channel;
      return channel;
    }
    async createOffer() {
      return {
        type: "offer",
        sdp: "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
      };
    }
    async setLocalDescription() {}
    async setRemoteDescription() {
      this.channel.readyState = "open";
      queueMicrotask(() => this.channel.onopen?.());
    }
    close() {
      this.closed = true;
      this.connectionState = "closed";
    }
  }
  const voice = createVoiceInput({
    getDraft: () => draft,
    onDraft: (text, meta) => {
      draft = text;
      writes.push({ text, ...meta });
    },
    onState: (value) => states.push(value.status),
    onError: (message) => errors.push(message),
    dependencies: {
      isSecureContext: secure,
      mediaDevices: {
        getUserMedia: gum || (() => Promise.resolve(makeStream())),
      },
      RTCPeerConnection: peerEnabled ? Peer : null,
      document: doc,
      window: win,
      setTimeout:
        timers || ((fn, delay) => setTimeout(fn, delay === 250 ? 1 : delay)),
      fetch: async (url, init) => {
        calls.push({ url, init });
        if (fetchImpl) return fetchImpl(url, init);
        return url === "/api/voice-session"
          ? new Response(
              JSON.stringify({
                clientSecret: "ek_test_ephemeral_only",
                expiresAt: Date.now() / 1000 + 60,
                maxDurationMs: 120000,
              }),
              { status: 200 },
            )
          : new Response("v=0\r\nanswer\r\n", { status: 200 });
      },
    },
  });
  return {
    voice,
    calls,
    writes,
    states,
    errors,
    tracks,
    peers,
    doc,
    win,
    makeStream,
    get draft() {
      return draft;
    },
    set draft(value) {
      draft = value;
    },
    emit: (e) => peers.at(-1).channel.onmessage?.({ data: JSON.stringify(e) }),
  };
}

test("partial text is replaced by its final transcript and duplicate event IDs are ignored", () => {
  const buffer = createTranscriptBuffer();
  buffer.accept(delta("a", "Minha ", { event_id: "one" }));
  buffer.accept(delta("a", "Minha ", { event_id: "one" }));
  buffer.accept(delta("a", "pele"));
  assert.equal(buffer.text, "Minha pele");
  buffer.accept(completed("a", "Minha pele."));
  buffer.accept(delta("a", " duplicate"));
  assert.equal(buffer.text, "Minha pele.");
  assert.equal(buffer.final, true);
});
test("committed item ordering wins over out-of-order completion events", () => {
  const buffer = createTranscriptBuffer();
  buffer.accept(
    event("input_audio_buffer.committed", "a", { previous_item_id: null }),
  );
  buffer.accept(
    event("input_audio_buffer.committed", "b", { previous_item_id: "a" }),
  );
  buffer.accept(completed("b", "Segundo."));
  buffer.accept(completed("a", "Primeiro."));
  assert.equal(buffer.text, "Primeiro. Segundo.");
});
test("microphone starts only with explicit consent and supported secure browser APIs", async () => {
  const denied = harness();
  assert.equal(await denied.voice.start(), false);
  assert.equal(denied.calls.length, 0);
  assert.equal(denied.tracks.length, 0);
  assert.match(denied.errors[0], /Autorize/);
  denied.voice.destroy();
  const insecure = harness({ secure: false });
  assert.equal(insecure.voice.supported, false);
  assert.equal(await insecure.voice.start({ consent: true }), false);
  assert.match(insecure.errors[0], /HTTPS/);
  insecure.voice.destroy();
});
test("real transcription setup uses a same-origin consent request and ephemeral WebRTC auth", async () => {
  const h = harness();
  assert.equal(await h.voice.start({ consent: true }), true);
  assert.equal(h.voice.status, "listening");
  assert.equal(h.tracks[0].enabled, true);
  assert.equal(h.calls[0].url, "/api/voice-session");
  assert.deepEqual(JSON.parse(h.calls[0].init.body), { consent: true });
  assert.equal(h.calls[1].url, "https://api.openai.com/v1/realtime/calls");
  assert.equal(
    h.calls[1].init.headers.Authorization,
    "Bearer ek_test_ephemeral_only",
  );
  assert.equal(
    h.calls.some((call) => call.url.includes("/api/chat")),
    false,
  );
  h.voice.destroy();
  assert.equal(h.tracks[0].stopped, 1);
});
test("each partial update preserves the typed draft and final text never duplicates the partial", async () => {
  const h = harness();
  await h.voice.start({ consent: true });
  h.emit(delta("a", "Minha pele"));
  assert.equal(h.draft, "Já escrevi: Minha pele");
  h.emit(delta("a", " está oleosa"));
  assert.equal(h.draft, "Já escrevi: Minha pele está oleosa");
  h.emit(completed("a", "Minha pele está oleosa."));
  assert.equal(h.draft, "Já escrevi: Minha pele está oleosa.");
  assert.equal(h.writes.length, 3);
  assert.equal(h.writes.at(-1).final, true);
  h.voice.destroy();
});
test("stop closes capture immediately, waits for final commit and never sends a chat response", async () => {
  const h = harness({ autoFinal: "Minha pele." });
  await h.voice.start({ consent: true });
  h.emit(delta("a", "Minha pe"));
  const stopped = h.voice.stop();
  assert.equal(h.voice.status, "stopping");
  assert.equal(h.tracks[0].stopped, 1);
  await stopped;
  assert.equal(h.voice.status, "idle");
  assert.equal(h.draft, "Já escrevi: Minha pele.");
  assert.deepEqual(h.peers[0].channel.sent, [
    { type: "input_audio_buffer.commit" },
  ]);
  assert.equal(h.peers[0].closed, true);
  h.voice.destroy();
});
test("cancel preserves existing transcription, stops tracks and ignores delayed events", async () => {
  const h = harness();
  await h.voice.start({ consent: true });
  h.emit(delta("a", "Um trecho"));
  const stale = h.peers[0].channel.onmessage;
  h.voice.cancel();
  stale({ data: JSON.stringify(completed("a", "Texto tardio")) });
  assert.equal(h.draft, "Já escrevi: Um trecho");
  assert.equal(h.voice.status, "idle");
  assert.equal(h.tracks[0].stopped, 1);
  h.voice.destroy();
});
test("restarting appends a new transcription exactly once after the saved previous dictation", async () => {
  const h = harness();
  await h.voice.start({ consent: true });
  h.emit(completed("a", "Primeiro."));
  h.voice.cancel();
  await h.voice.start({ consent: true });
  h.emit(delta("a", "Segundo"));
  h.emit(completed("a", "Segundo."));
  assert.equal(h.draft, "Já escrevi: Primeiro. Segundo.");
  h.voice.destroy();
});
test("manual typing wins over delayed provider updates without overwriting the draft", async () => {
  const h = harness();
  await h.voice.start({ consent: true });
  h.emit(delta("a", "Trecho"));
  h.draft = "Corrigi manualmente";
  h.emit(completed("a", "Trecho alterado"));
  assert.equal(h.draft, "Corrigi manualmente");
  assert.equal(h.voice.status, "idle");
  assert.equal(h.tracks[0].stopped, 1);
  h.voice.destroy();
});
test("explicit input handling stops dictation while retaining exact manual text", async () => {
  const h = harness();
  await h.voice.start({ consent: true });
  h.draft = "Novo texto";
  h.voice.handleTypedInput();
  assert.equal(h.draft, "Novo texto");
  assert.equal(h.voice.status, "idle");
  assert.equal(h.tracks[0].stopped, 1);
  h.voice.destroy();
});
test("microphone permission denial has actionable copy and does not contact the provider", async () => {
  const h = harness({
    gum: async () => {
      throw new DOMException("private device info", "NotAllowedError");
    },
  });
  assert.equal(await h.voice.start({ consent: true }), false);
  assert.equal(h.calls.length, 0);
  assert.match(h.errors[0], /Permita o acesso/);
  assert.equal(h.errors[0].includes("private"), false);
  h.voice.destroy();
});
test("cancel while permission is pending stops a late-granted stream without opening a session", async () => {
  let grant;
  const h = harness({
    gum: () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
  });
  const started = h.voice.start({ consent: true });
  h.voice.cancel();
  grant(h.makeStream());
  assert.equal(await started, false);
  assert.equal(h.tracks[0].stopped, 1);
  assert.equal(h.calls.length, 0);
  h.voice.destroy();
});
test("backgrounding, pagehide and destruction release audio capture", async () => {
  for (const reason of ["hidden", "pagehide", "destroy"]) {
    const h = harness();
    await h.voice.start({ consent: true });
    if (reason === "hidden") {
      h.doc.visibilityState = "hidden";
      h.doc.dispatchEvent(new Event("visibilitychange"));
    } else if (reason === "pagehide")
      h.win.dispatchEvent(new Event("pagehide"));
    else h.voice.destroy();
    assert.equal(h.tracks[0].stopped, 1);
    assert.equal(h.peers[0].closed, true);
    h.voice.destroy();
  }
});
test("connection failures stop capture and do not disclose raw provider details", async () => {
  const h = harness({
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: { code: "provider_error", message: "SECRET raw response" },
        }),
        { status: 502 },
      ),
  });
  assert.equal(await h.voice.start({ consent: true }), false);
  assert.equal(h.tracks[0].stopped, 1);
  assert.equal(
    h.errors.some((text) => text.includes("SECRET")),
    false,
  );
  h.voice.destroy();
});
test("lost realtime connection preserves the last draft and stops tracks", async () => {
  const h = harness();
  await h.voice.start({ consent: true });
  h.emit(delta("a", "Continuo"));
  h.peers[0].connectionState = "disconnected";
  h.peers[0].onconnectionstatechange();
  assert.equal(h.draft, "Já escrevi: Continuo");
  assert.equal(h.tracks[0].stopped, 1);
  assert.equal(h.voice.status, "error");
  assert.match(h.errors[0], /conexão/);
  h.voice.destroy();
});
test("duplicate start never creates concurrent microphones and destroyed modules cannot restart", async () => {
  const h = harness();
  await h.voice.start({ consent: true });
  assert.equal(await h.voice.start({ consent: true }), false);
  assert.equal(h.tracks.length, 1);
  h.voice.destroy();
  assert.equal(await h.voice.start({ consent: true }), false);
  assert.equal(h.tracks.length, 1);
});
