import type { SavedUploadSession } from "./multipart-client";

const STORAGE_KEY = "trexton.uploadSession.v1";
const STORE_EVENT = "trexton:upload-session-changed";

let cachedRaw: string | null | undefined;
let cachedSession: SavedUploadSession | null = null;

function parseSession(raw: string | null) {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<SavedUploadSession>;
    if (
      typeof value.sessionId !== "string" ||
      typeof value.resumeToken !== "string" ||
      typeof value.videoId !== "string" ||
      typeof value.fileName !== "string" ||
      typeof value.fileSize !== "number" ||
      typeof value.fileFingerprint !== "string" ||
      typeof value.partSize !== "number" ||
      typeof value.partCount !== "number"
    ) {
      return null;
    }

    return value as SavedUploadSession;
  } catch {
    return null;
  }
}

export function getSavedUploadSnapshot() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parseSession(raw);
  }
  return cachedSession;
}

export function getSavedUploadServerSnapshot() {
  return null;
}

export function subscribeToSavedUpload(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORE_EVENT, callback);
  };
}

export function saveUploadSession(session: SavedUploadSession) {
  const raw = JSON.stringify(session);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSession = session;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function clearSavedUploadSession() {
  window.localStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedSession = null;
  window.dispatchEvent(new Event(STORE_EVENT));
}
