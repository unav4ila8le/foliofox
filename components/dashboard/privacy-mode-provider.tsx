"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Eye, EyeOff } from "lucide-react";

const PRIVACY_MODE_COOKIE_NAME = "privacy_mode";
const PRIVACY_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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
  // Always start blurred (true) so SSR and the client's first render match.
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(true);

  // After hydration, read persisted value and update if needed.
  useEffect(() => {
    try {
      const privacyModeFromCookie = document.cookie
        .split("; ")
        .map((cookieRow) => cookieRow.split("="))
        .find(([cookieName]) => cookieName === PRIVACY_MODE_COOKIE_NAME)?.[1];

      const persisted =
        (privacyModeFromCookie
          ? decodeURIComponent(privacyModeFromCookie)
          : localStorage.getItem(PRIVACY_MODE_COOKIE_NAME)) === "true";

      setIsPrivacyMode((prev) => (prev !== persisted ? persisted : prev));
    } catch {
      // stay true (safe default)
      setIsPrivacyMode(true);
    }
    // Listen for changes from other tabs
    const handleStorageChange = (storageEvent: StorageEvent) => {
      if (
        storageEvent.key === PRIVACY_MODE_COOKIE_NAME &&
        storageEvent.newValue != null
      ) {
        setIsPrivacyMode(storageEvent.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const togglePrivacyMode = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      document.cookie =
        `${PRIVACY_MODE_COOKIE_NAME}=${encodeURIComponent(String(next))}; Path=/; Max-Age=${PRIVACY_MODE_COOKIE_MAX_AGE}; SameSite=Lax` +
        (location.protocol === "https:" ? "; Secure" : "");
      try {
        localStorage.setItem(PRIVACY_MODE_COOKIE_NAME, String(next));
      } catch {}
      return next;
    });
  };

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
