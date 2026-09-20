import { createExperienceState, mountExperience } from "../experience.js";
import "./composer.css";
import { createThreadFixture, act } from "./thread-state.js";
import { createAlternative } from "./conversation-tools.js";
import {
  loadSessions,
  saveSession,
  deleteSession,
  clearSessions,
} from "./session-store.js";

/** Route + browser-local conversations. The renderer stays shared with Storybook. */
export function initChat({ onPhotoChange, onReset } = {}) {
  const state = createExperienceState();
  let sessions = [],
    activeId = crypto.randomUUID(),
    mounted,
    returnFocus,
    landingUrl = "/wireframe",
    ownsHistoryEntry = false,
    saveTimer,
    loading = true,
    storageFailed = false,
    interacted = false;
  let saveStatus = "";
  let writes = Promise.resolve();
  const shell = document.createElement("main");
  shell.className = "composer-shell";
  shell.setAttribute("aria-label", "Conversa SkinBoost");
  shell.hidden = true;
  document.body.append(shell);
  const resume = document.createElement("button");
  resume.id = "resume-experience";
  resume.className = "experience-return";
  resume.hidden = true;
  resume.innerHTML =
    '<i class="ph ph-chat-circle-text" aria-hidden="true"></i> Retomar minha conversa';
  document.body.append(resume);
  function replaceState(next) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, next);
  }
  function reportStorageError() {
    storageFailed = true;
    saveStatus = "Não foi possível salvar neste navegador";
    state.error =
      "Não foi possível salvar no navegador. A conversa continua aberta, mas pode não estar disponível ao recarregar.";
    mounted?.show();
  }
  async function saveCurrent() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (
      loading ||
      storageFailed ||
      (!state.context.intent &&
        !state.draft &&
        !state.messages.some((m) => m.role === "user"))
    )
      return;
    const session = {
      id: activeId,
      title: (
        state.sessionLabel ||
        state.context.intent ||
        state.draft ||
        "Nova conversa"
      ).slice(0, 100),
      updatedAt: Date.now(),
      state: structuredClone(state),
    };
    sessions = [session, ...sessions.filter((s) => s.id !== activeId)]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);
    mounted?.refreshSessions();
    writes = writes.catch(() => {}).then(() => saveSession(session));
    try {
      await writes;
      saveStatus = "Salvo neste navegador";
      mounted?.refreshSaveStatus();
    } catch {
      reportStorageError();
    }
  }
  function changed() {
    if (
      !state.context.intent &&
      !state.draft &&
      !state.messages.some((message) => message.role === "user")
    ) {
      saveStatus = "No seu tempo. Do seu jeito.";
      return;
    }
    if (!loading && !storageFailed) {
      saveStatus = "Salvando neste navegador…";
      if (!saveTimer) saveTimer = setTimeout(saveCurrent, 650);
    }
  }
  function show(step = state.step, initialMessage = "") {
    shell.hidden = false;
    document.body.classList.add("composer-open");
    document.title = "Sua conversa — SkinBoost";
    mounted?.destroy();
    mounted = mountExperience(shell, {
      state,
      initialStep: step,
      initialMessage,
      liveApi: true,
      onClose: goHome,
      onPhotoChange,
      onChange: changed,
      getSessions: () => sessions,
      getSessionId: () => activeId,
      getSaveStatus: () => saveStatus,
      onAlternative: async (choice) => {
        mounted?.destroy();
        await saveCurrent();
        const next = createAlternative(state, {
          sourceId: activeId,
          title: state.sessionLabel || state.context.intent,
          choice,
        });
        activeId = crypto.randomUUID();
        replaceState(next);
        await saveCurrent();
        show();
      },
      onSessionSelect: async (id) => {
        if (id === activeId) return;
        mounted?.destroy();
        await saveCurrent();
        const session = sessions.find((s) => s.id === id);
        if (!session) return;
        activeId = id;
        replaceState(structuredClone(session.state));
        saveStatus = "Conversa retomada neste navegador";
        state.photoConsent = false;
        onPhotoChange?.(state.photoName || "");
        show();
      },
      onNewConversation: async () => {
        mounted?.destroy();
        await saveCurrent();
        activeId = crypto.randomUUID();
        replaceState(createExperienceState());
        onReset?.();
        show();
      },
      onDeleteSession: async (id) => {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (id === activeId) mounted?.destroy();
        await writes.catch(() => {});
        await deleteSession(id);
        sessions = sessions.filter((s) => s.id !== id);
        if (id === activeId) {
          activeId = crypto.randomUUID();
          replaceState(createExperienceState());
          onReset?.();
          show();
        } else mounted?.refreshSessions();
      },
      onClearSessions: async () => {
        mounted?.destroy();
        clearTimeout(saveTimer);
        saveTimer = null;
        await writes.catch(() => {});
        await clearSessions();
        sessions = [];
        activeId = crypto.randomUUID();
        replaceState(createExperienceState());
        onReset?.();
        show();
      },
      onReset: () => {
        resume.hidden = true;
        onReset?.();
      },
    });
  }
  function hide() {
    mounted?.destroy();
    saveCurrent();
    mounted = null;
    shell.hidden = true;
    document.body.classList.remove("composer-open");
    document.title = "SkinBoost — Sua pele. Seu próximo passo.";
    resume.hidden = !state.context.intent && !state.draft;
    returnFocus?.focus({ preventScroll: true });
    window.dispatchEvent(new Event("resize"));
  }
  function open(goal = "", attachment = "", requestedStep) {
    interacted = true;
    returnFocus = document.activeElement;
    if (location.pathname.replace(/\/$/, "") !== "/wireframe/chat") {
      landingUrl = location.pathname + location.search + location.hash;
      history.pushState({ skinboostChat: true }, "", "/wireframe/chat");
      ownsHistoryEntry = true;
    }
    if (requestedStep === "routine" && !state.routine)
      replaceState(createThreadFixture("routine", "general"));
    if (requestedStep === "checkin" && state.routine)
      replaceState(act(state, "checkin"));
    if (attachment) state.photoName = attachment;
    show(requestedStep || state.step, goal);
  }
  function goHome() {
    if (ownsHistoryEntry) {
      history.back();
      ownsHistoryEntry = false;
    } else {
      history.replaceState(null, "", landingUrl);
      hide();
    }
  }
  function fitMobileViewport() {
    if (
      window.visualViewport &&
      window.matchMedia("(max-width: 760px)").matches
    ) {
      shell.style.height = `${window.visualViewport.height}px`;
      shell.style.top = `${window.visualViewport.offsetTop}px`;
    } else {
      shell.style.height = "";
      shell.style.top = "";
    }
  }
  window.visualViewport?.addEventListener("resize", fitMobileViewport);
  window.visualViewport?.addEventListener("scroll", fitMobileViewport);
  window.addEventListener("resize", fitMobileViewport);
  fitMobileViewport();
  resume.onclick = () => open();
  window.addEventListener("popstate", () =>
    location.pathname.replace(/\/$/, "") === "/wireframe/chat"
      ? show()
      : hide(),
  );
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !shell.hidden) {
      if (shell.querySelector("dialog[open]")) return;
      event.preventDefault();
      const sidebar = shell.querySelector(".sx-sidebar.is-open");
      if (sidebar) {
        sidebar.classList.remove("is-open");
        shell.querySelector(".sx-history-scrim")?.classList.remove("is-open");
        shell.querySelector('[data-action="history"]')?.focus();
      } else goHome();
    }
  });
  window.addEventListener("pagehide", saveCurrent);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveCurrent();
  });
  loadSessions()
    .then((saved) => {
      sessions = saved;
      if (
        !interacted &&
        !state.context.intent &&
        !state.draft &&
        saved.length
      ) {
        activeId = saved[0].id;
        replaceState(structuredClone(saved[0].state));
        state.photoConsent = false;
        onPhotoChange?.(state.photoName || "");
      }
      loading = false;
      if (location.pathname.replace(/\/$/, "") === "/wireframe/chat") show();
      else {
        resume.hidden = !state.context.intent && !state.draft;
        if (location.hash === "#conversa") open();
      }
    })
    .catch(() => {
      loading = false;
      storageFailed = true;
      state.error =
        "Este navegador não permitiu salvar o histórico. A conversa continua disponível nesta aba.";
      if (location.pathname.replace(/\/$/, "") === "/wireframe/chat") show();
    });
  return {
    open,
    checkin() {
      open("", "", state.routine ? "checkin" : "welcome");
    },
    demo() {
      open("", "", "routine");
    },
    state,
  };
}
