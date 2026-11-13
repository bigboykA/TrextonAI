"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

const VIDEO_KEY = "trexton.active-video-id";
const JOB_KEY = "trexton.active-job-id";
const STORAGE_EVENT = "trexton-storage";

type WorkspaceContextValue = {
  activeVideoId: string;
  setActiveVideoId: (value: string) => void;
  activeJobId: string;
  setActiveJobId: (value: string) => void;
  librarySearch: string;
  setLibrarySearch: (value: string) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null
);

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function useStoredValue(key: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? "",
    () => ""
  );

  const setValue = useCallback(
    (nextValue: string) => {
      const normalizedValue = nextValue.trim();

      if (normalizedValue) {
        window.localStorage.setItem(key, normalizedValue);
      } else {
        window.localStorage.removeItem(key);
      }

      window.dispatchEvent(new Event(STORAGE_EVENT));
    },
    [key]
  );

  return [value, setValue] as const;
}

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeVideoId, setActiveVideoId] =
    useStoredValue(VIDEO_KEY);
  const [activeJobId, setActiveJobId] = useStoredValue(JOB_KEY);
  const [librarySearch, setLibrarySearch] = useState("");

  const value = useMemo(
    () => ({
      activeVideoId,
      setActiveVideoId,
      activeJobId,
      setActiveJobId,
      librarySearch,
      setLibrarySearch,
    }),
    [
      activeJobId,
      activeVideoId,
      librarySearch,
      setActiveJobId,
      setActiveVideoId,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace must be used inside WorkspaceProvider"
    );
  }

  return context;
}
