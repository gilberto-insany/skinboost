/** Realtime transcription only. Audio is sent to OpenAI; it is never recorded or
 * persisted here. Integration must save every onDraft update and show consent
 * before start({consent:true}). No method sends a chat message.
 * Docs: https://developers.openai.com/api/docs/guides/realtime-transcription
 * https://developers.openai.com/api/docs/guides/voice-webrtc
 */

export function createTranscriptBuffer() {
  const segments = new Map(),
    order = [],
    events = new Set();
  function segment(id) {
    if (!segments.has(id)) {
      segments.set(id, { text: "", final: false });
      order.push(id);
    }
    return segments.get(id);
  }
  return {
    accept(event) {
      if (!event || typeof event !== "object") return false;
      if (
        ![
          "input_audio_buffer.committed",
          "conversation.item.input_audio_transcription.delta",
          "conversation.item.input_audio_transcription.completed",
        ].includes(event.type)
      )
        return false;
      if (event.event_id) {
        if (events.has(event.event_id)) return false;
        events.add(event.event_id);
      }
      const id = event.item_id;
      if (typeof id !== "string" || !id) return false;
      const value = segment(id);
      if (event.type === "input_audio_buffer.committed") {
        const index = order.indexOf(id);
        order.splice(index, 1);
        const previous = order.indexOf(event.previous_item_id);
        order.splice(
          previous >= 0
            ? previous + 1
            : event.previous_item_id === null
              ? 0
              : order.length,
          0,
          id,
        );
        return true;
      }
      if (
        event.type === "conversation.item.input_audio_transcription.delta" &&
        !value.final &&
        typeof event.delta === "string"
      ) {
        value.text += event.delta;
        return true;
      }
      if (
        event.type ===
          "conversation.item.input_audio_transcription.completed" &&
        typeof event.transcript === "string"
      ) {
        value.text = event.transcript;
        value.final = true;
        return true;
      }
      return false;
    },
    get text() {
      return order
        .map((id) => segments.get(id).text.trim())
        .filter(Boolean)
        .join(" ");
    },
    get final() {
      return order.length > 0 && order.every((id) => segments.get(id).final);
    },
  };
}

const JOIN = (draft, spoken) =>
  !spoken
    ? draft
    : `${draft}${draft && !/\s$/.test(draft) ? " " : ""}${spoken}`;
const ACTIVE = new Set(["requesting", "connecting", "listening", "stopping"]);
const messages = {
  permission:
    "O microfone não foi autorizado. Permita o acesso nas configurações do navegador ou continue digitando.",
  missing:
    "Não encontrei um microfone disponível. Conecte um microfone ou continue digitando.",
  unavailable:
    "Não foi possível usar o microfone. Ele pode estar ocupado em outro aplicativo.",
  unsupported:
    "Este navegador não oferece transcrição por microfone. Use Safari ou Chrome atualizado em uma página HTTPS, ou continue digitando.",
  connection:
    "A transcrição perdeu a conexão. O texto que já apareceu foi mantido; você pode continuar digitando ou tentar novamente.",
};

export function createVoiceInput({
  getDraft = () => "",
  onDraft = () => {},
  onState = () => {},
  onError = () => {},
  maxChars = 2000,
  endpoint = "/api/voice-session",
  dependencies = {},
} = {}) {
  const media = dependencies.mediaDevices || globalThis.navigator?.mediaDevices;
  const Peer = dependencies.RTCPeerConnection || globalThis.RTCPeerConnection;
  const fetcher = dependencies.fetch || globalThis.fetch;
  const doc = dependencies.document || globalThis.document;
  const win = dependencies.window || globalThis.window;
  const later = dependencies.setTimeout || globalThis.setTimeout;
  const clear = dependencies.clearTimeout || globalThis.clearTimeout;
  const supported =
    (dependencies.isSecureContext ?? globalThis.isSecureContext) !== false &&
    !!media?.getUserMedia &&
    typeof Peer === "function";
  let active = null,
    status = "idle",
    destroyed = false;
  const setState = (next) => {
    status = next;
    if (!destroyed) onState({ status: next });
  };
  const valid = (run) => active === run && !destroyed;
  function timer(run, fn, delay) {
    const id = later(() => {
      run.timers.delete(id);
      if (valid(run)) fn();
    }, delay);
    run.timers.add(id);
    return id;
  }
  function stopTracks(run) {
    for (const track of run.stream?.getTracks() || []) {
      track.onended = null;
      track.stop();
    }
  }
  function cleanup(run) {
    run.controller.abort();
    for (const id of run.timers) clear(id);
    run.timers.clear();
    stopTracks(run);
    if (run.channel) {
      run.channel.onopen = null;
      run.channel.onmessage = null;
      run.channel.onclose = null;
      run.channel.onerror = null;
      try {
        run.channel.close();
      } catch {}
    }
    if (run.peer) {
      run.peer.onconnectionstatechange = null;
      run.peer.oniceconnectionstatechange = null;
      try {
        run.peer.close();
      } catch {}
    }
    run.resolveStart?.(false);
    run.resolveStop?.();
  }
  function fail(run, message) {
    if (!valid(run)) return;
    active = null;
    cleanup(run);
    setState("error");
    onError(message);
  }
  function publish(run, final = false) {
    if (!valid(run)) return;
    // If the person edits manually, retain their exact value. Never overwrite
    // user typing with a delayed partial/final transcription callback.
    if (String(getDraft() || "") !== run.lastWritten) {
      cancel();
      return;
    }
    const text = JOIN(run.base, run.buffer.text).slice(0, maxChars);
    if (text !== run.lastWritten || final) {
      run.lastWritten = text;
      onDraft(text, { final });
    }
    if (text.length >= maxChars && status === "listening") {
      onError(
        "O rascunho chegou ao limite de texto. Revise antes de continuar.",
      );
      stop();
    }
  }
  function finish(run, { incomplete = false } = {}) {
    if (!valid(run)) return;
    publish(run, !incomplete);
    if (!valid(run)) return;
    active = null;
    cleanup(run);
    setState("idle");
    if (incomplete)
      onError(
        "A fala terminou, mas a última transcrição pode estar incompleta. O texto recebido foi mantido para você revisar.",
      );
  }
  function receive(run, raw) {
    if (!valid(run)) return;
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    if (event.type === "error") {
      if (
        status === "stopping" &&
        event.error?.code === "input_audio_buffer_commit_empty"
      ) {
        finish(run);
        return;
      }
      fail(
        run,
        "Não foi possível continuar a transcrição. O texto recebido foi mantido; tente novamente ou digite.",
      );
      return;
    }
    if (event.type === "conversation.item.input_audio_transcription.failed") {
      fail(
        run,
        "Não consegui transcrever esse trecho. O restante do rascunho foi mantido.",
      );
      return;
    }
    if (run.buffer.accept(event))
      publish(run, event.type.endsWith(".completed"));
    if (
      valid(run) &&
      status === "stopping" &&
      run.commitSent &&
      event.type === "conversation.item.input_audio_transcription.completed"
    )
      finish(run);
  }
  async function start({ consent = false } = {}) {
    if (destroyed || ACTIVE.has(status)) return false;
    if (!consent) {
      setState("error");
      onError("Autorize o envio da fala à OpenAI antes de ativar o microfone.");
      return false;
    }
    if (!supported) {
      setState("error");
      onError(messages.unsupported);
      return false;
    }
    if (String(getDraft() || "").length >= maxChars) {
      setState("error");
      onError(
        "O rascunho chegou ao limite de texto. Revise antes de ditar mais.",
      );
      return false;
    }
    const run = {
      base: String(getDraft() || ""),
      lastWritten: String(getDraft() || ""),
      buffer: createTranscriptBuffer(),
      controller: new AbortController(),
      timers: new Set(),
      stream: null,
      peer: null,
      channel: null,
      commitSent: false,
    };
    active = run;
    setState("requesting");
    const watchdog = timer(
      run,
      () =>
        fail(
          run,
          "Não foi possível iniciar o microfone a tempo. Verifique a permissão e tente novamente.",
        ),
      30_000,
    );
    try {
      const stream = await media.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (!valid(run)) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      run.stream = stream;
      const tracks = stream.getAudioTracks();
      if (!tracks.length) {
        fail(run, messages.missing);
        return false;
      }
      for (const track of tracks) {
        track.enabled = false;
        track.onended = () => {
          if (valid(run) && status === "listening") stop();
        };
      }
      setState("connecting");
      const tokenResponse = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
        cache: "no-store",
        signal: run.controller.signal,
      });
      let token;
      try {
        token = await tokenResponse.json();
      } catch {
        throw new Error("voice_session");
      }
      if (!valid(run)) return false;
      if (!tokenResponse.ok)
        throw new Error(
          token?.error?.code === "rate_limited"
            ? "rate_limited"
            : "voice_session",
        );
      if (
        typeof token.clientSecret !== "string" ||
        !token.clientSecret.startsWith("ek_") ||
        !Number.isFinite(token.expiresAt) ||
        token.expiresAt <= Date.now() / 1000
      )
        throw new Error("voice_session");
      const peer = new Peer();
      run.peer = peer;
      for (const track of tracks) peer.addTrack(track, stream);
      const channel = peer.createDataChannel("oai-events");
      run.channel = channel;
      const opened = new Promise((resolve) => {
        run.resolveStart = resolve;
      });
      channel.onmessage = (event) => receive(run, event.data);
      channel.onopen = () => {
        if (!valid(run)) return;
        clear(watchdog);
        run.timers.delete(watchdog);
        for (const track of tracks) track.enabled = true;
        setState("listening");
        run.resolveStart?.(true);
        run.resolveStart = null;
        timer(
          run,
          () => stop(),
          Math.min(120_000, Number(token.maxDurationMs) || 120_000),
        );
      };
      channel.onclose = () => {
        if (valid(run))
          status === "stopping"
            ? finish(run, { incomplete: !run.buffer.final })
            : fail(run, messages.connection);
      };
      channel.onerror = () => fail(run, messages.connection);
      peer.onconnectionstatechange = () => {
        if (
          valid(run) &&
          ["failed", "disconnected", "closed"].includes(peer.connectionState)
        )
          fail(run, messages.connection);
      };
      const offer = await peer.createOffer();
      if (!valid(run)) return false;
      await peer.setLocalDescription(offer);
      if (!valid(run)) return false;
      const answer = await fetcher("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
        signal: run.controller.signal,
      });
      token.clientSecret = "";
      if (!valid(run)) return false;
      if (!answer.ok) throw new Error("voice_connection");
      const sdp = await answer.text();
      if (!valid(run)) return false;
      if (!sdp.startsWith("v=0")) throw new Error("voice_connection");
      await peer.setRemoteDescription({ type: "answer", sdp });
      if (!valid(run)) return false;
      return await opened;
    } catch (error) {
      if (!valid(run)) return false;
      const message =
        error?.name === "NotAllowedError"
          ? messages.permission
          : error?.name === "NotFoundError"
            ? messages.missing
            : error?.name === "NotReadableError"
              ? messages.unavailable
              : error?.message === "rate_limited"
                ? "Você atingiu o limite temporário de ditados. Aguarde alguns minutos ou continue digitando."
                : messages.connection;
      fail(run, message);
      return false;
    }
  }
  function stop() {
    const run = active;
    if (!run) return Promise.resolve();
    if (status === "stopping") return run.stopPromise;
    if (status !== "listening") {
      cancel();
      return Promise.resolve();
    }
    setState("stopping");
    stopTracks(run);
    run.stopPromise = new Promise((resolve) => {
      run.resolveStop = resolve;
    });
    // Allow the last RTP packets to arrive after capture has stopped, then ask
    // the transcription session to finalize its current item (never response.create).
    timer(
      run,
      () => {
        if (run.channel?.readyState !== "open") {
          finish(run, { incomplete: true });
          return;
        }
        run.commitSent = true;
        try {
          run.channel.send(
            JSON.stringify({ type: "input_audio_buffer.commit" }),
          );
        } catch {
          finish(run, { incomplete: true });
        }
      },
      250,
    );
    timer(run, () => finish(run, { incomplete: !run.buffer.final }), 8_000);
    return run.stopPromise;
  }
  function cancel() {
    const run = active;
    if (run) {
      active = null;
      cleanup(run);
    }
    if (!destroyed) setState("idle");
  }
  function background() {
    if (doc?.visibilityState === "hidden") cancel();
  }
  function leave() {
    cancel();
  }
  doc?.addEventListener("visibilitychange", background);
  win?.addEventListener("pagehide", leave);
  return {
    supported,
    start,
    stop,
    cancel,
    get status() {
      return status;
    },
    handleTypedInput() {
      if (ACTIVE.has(status)) cancel();
    },
    destroy() {
      cancel();
      destroyed = true;
      doc?.removeEventListener("visibilitychange", background);
      win?.removeEventListener("pagehide", leave);
    },
  };
}

export default createVoiceInput;
