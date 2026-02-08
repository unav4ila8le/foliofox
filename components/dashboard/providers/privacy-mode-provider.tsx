"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

const PRIVACY_MODE_COOKIE_NAME = "privacy_mode";
const PRIVACY_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type PrivacyModeListener = () => void;

const privacyModeListeners = new Set<PrivacyModeListener>();

// Reads persisted state from cookies/localStorage.
function readPersistedPrivacyMode(): boolean {
  try {
    const privacyModeFromCookie = document.cookie
      .split("; ")
      .map((cookieRow) => cookieRow.split("="))
      .find(([cookieName]) => cookieName === PRIVACY_MODE_COOKIE_NAME)?.[1];

    const persisted =
      (privacyModeFromCookie
        ? decodeURIComponent(privacyModeFromCookie)
        : window.localStorage.getItem(PRIVACY_MODE_COOKIE_NAME)) === "true";

    return persisted;
  } catch {
    return true;
  }
}

// Persists the flag for future visits and other tabs.
function persistPrivacyMode(next: boolean) {
  const secureSuffix = location.protocol === "https:" ? "; Secure" : "";

  document.cookie =
    `${PRIVACY_MODE_COOKIE_NAME}=${encodeURIComponent(String(next))}; Path=/; Max-Age=${PRIVACY_MODE_COOKIE_MAX_AGE}; SameSite=Lax` +
    secureSuffix;

  try {
    window.localStorage.setItem(PRIVACY_MODE_COOKIE_NAME, String(next));
  } catch {
    // Ignore storage errors
  }
}

function notifyPrivacyModeListeners() {
  privacyModeListeners.forEach((listener) => listener());
}

// Wires the store to the browser storage event.
function subscribeToPrivacyMode(listener: PrivacyModeListener) {
  privacyModeListeners.add(listener);

  const handleStorageChange = (storageEvent: StorageEvent) => {
    if (storageEvent.key === PRIVACY_MODE_COOKIE_NAME) {
      notifyPrivacyModeListeners();
    }
  };

  window.addEventListener("storage", handleStorageChange);

  return () => {
    privacyModeListeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}

type PrivacyModeContextType = {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
};

const PrivacyModeContext = createContext<PrivacyModeContextType | undefined>(
  undefined,
);

export function usePrivacyMode() {
  const privacyModeContext = useContext(PrivacyModeContext);
  if (!privacyModeContext)
    throw new Error("usePrivacyMode must be used within <PrivacyModeProvider>");
  return privacyModeContext;
}

export function PrivacyModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isPrivacyMode = useSyncExternalStore(
    subscribeToPrivacyMode,
    readPersistedPrivacyMode,
    () => true,
  );

  const togglePrivacyMode = useCallback(() => {
    const next = !readPersistedPrivacyMode();
    persistPrivacyMode(next);
    notifyPrivacyModeListeners();
  }, []);

  return (
    <PrivacyModeContext.Provider value={{ isPrivacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyModeContext.Provider>
  );
}

/**
 * UI button for toggling privacy mode.
 */
export function PrivacyModeButton({ className }: { className?: string }) {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacyMode();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={togglePrivacyMode}
    >
      {isPrivacyMode ? <Eye /> : <EyeOff />}
      <span className="sr-only">
        {isPrivacyMode ? "Disable privacy mode" : "Enable privacy mode"}
      </span>
    </Button>
  );
}
