// Conversations stay in this browser's IndexedDB, including local image data.
// Loading a conversation never restores permission to send its photo to a provider.
export const MAX_SESSIONS = 20;
const DATABASE = "skinboost-conversations";
const STORE = "sessions";
let connection;

function storageError(error) {
  if (
    error?.code === "SESSION_STORAGE_FULL" ||
    error?.code === "SESSION_STORAGE_UNAVAILABLE"
  )
    return error;
  const full = error?.name === "QuotaExceededError";
  const result = new Error(
    full
      ? "Não há espaço para salvar esta conversa neste navegador. Exclua uma conversa antiga ou remova imagens e tente novamente."
      : "Não foi possível acessar as conversas salvas neste navegador. Verifique se o armazenamento local está disponível e tente novamente.",
  );
  result.code = full ? "SESSION_STORAGE_FULL" : "SESSION_STORAGE_UNAVAILABLE";
  result.cause = error;
  return result;
}

export function serializeSession(session) {
  if (
    !session ||
    typeof session !== "object" ||
    typeof session.id !== "string" ||
    !session.id.trim() ||
    !Number.isFinite(session.updatedAt) ||
    session.updatedAt < 0 ||
    !session.state ||
    typeof session.state !== "object" ||
    Array.isArray(session.state)
  ) {
    throw new TypeError(
      "A conversa precisa de identificador, data e estado válidos para ser salva.",
    );
  }
  return {
    id: session.id,
    title:
      typeof session.title === "string" && session.title.trim()
        ? session.title.trim().slice(0, 160)
        : "Nova conversa",
    updatedAt: session.updatedAt,
    state: structuredClone(session.state),
  };
}

export function restoreSession(session) {
  const restored = serializeSession(session);
  const state = restored.state;
  for (const key of [
    "pending",
    "loading",
    "isPending",
    "isLoading",
    "photoPending",
    "generatingImage",
  ]) {
    if (Object.hasOwn(state, key)) state[key] = false;
  }
  state.error = "";
  state.failedRequest = false;
  state.photoConsent = false;
  if (["processing", "loading", "waiting", "generating"].includes(state.step)) {
    state.step = state.routine
      ? "routine"
      : state.context?.intent
        ? "context"
        : "welcome";
  }
  return restored;
}

export function selectRecentSessions(sessions, limit = MAX_SESSIONS) {
  const count = Math.min(
    MAX_SESSIONS,
    Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : MAX_SESSIONS),
  );
  const unique = new Map();
  for (const session of sessions) {
    const record = serializeSession(session);
    const previous = unique.get(record.id);
    if (!previous || record.updatedAt >= previous.updatedAt)
      unique.set(record.id, record);
  }
  return [...unique.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    .slice(0, count);
}

function database() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(storageError(new Error("IndexedDB unavailable")));
      return;
    }
    let request;
    try {
      request = globalThis.indexedDB.open(DATABASE, 1);
    } catch (error) {
      reject(storageError(error));
      return;
    }
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onblocked = () => {
      blocked = true;
      reject(storageError(new Error("Database blocked")));
    };
    request.onerror = () => reject(storageError(request.error));
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
  }).catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}

async function transaction(mode, execute) {
  const db = await database();
  return new Promise((resolve, reject) => {
    let tx, value;
    try {
      tx = db.transaction(STORE, mode);
      tx.oncomplete = () => resolve(value);
      tx.onerror = (event) =>
        reject(storageError(event.target?.error || tx.error));
      tx.onabort = () => reject(storageError(tx.error));
      execute(tx.objectStore(STORE), (result) => {
        value = result;
      });
    } catch (error) {
      try {
        tx?.abort();
      } catch {
        /* Already finished or unavailable. */
      }
      reject(storageError(error));
    }
  });
}

export async function loadSessions() {
  const records = await transaction("readonly", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => done(request.result);
  });
  const restored = [];
  for (const record of records || []) {
    try {
      restored.push(restoreSession(record));
    } catch {
      /* An invalid legacy record must not hide other saved conversations. */
    }
  }
  return selectRecentSessions(restored);
}

export async function saveSession(session) {
  let record;
  try {
    record = serializeSession(session);
  } catch (error) {
    throw storageError(error);
  }
  return transaction("readwrite", (store) => {
    const request = store.getAll();
    request.onsuccess = () => {
      try {
        const existing = request.result;
        const valid = existing.filter(
          (item) =>
            item.id !== record.id &&
            typeof item.id === "string" &&
            Number.isFinite(item.updatedAt),
        );
        // Choose retention by metadata before writing a potentially large image.
        const keep = new Set(
          [...valid, record]
            .sort(
              (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
            )
            .slice(0, MAX_SESSIONS)
            .map((item) => item.id),
        );
        for (const item of existing)
          if (!keep.has(item.id)) store.delete(item.id);
        if (keep.has(record.id)) store.put(record);
      } catch (error) {
        // An exception in an IDB callback must abort rather than report a save.
        store.transaction.abort();
      }
    };
  });
}

export async function deleteSession(id) {
  if (typeof id !== "string" || !id)
    throw new TypeError("Informe a conversa que deseja excluir.");
  return transaction("readwrite", (store) => {
    store.delete(id);
  });
}

export async function clearSessions() {
  return transaction("readwrite", (store) => {
    store.clear();
  });
}
