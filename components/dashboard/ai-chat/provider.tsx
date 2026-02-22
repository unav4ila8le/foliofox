"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { Mode } from "@/server/ai/system-prompt";

export interface AIChatDraftState {
  input: string;
  mode: Mode;
  files: File[];
}

interface AIChatProviderValue {
  activeConversationId: string | null;
  draftsByConversationId: Record<string, AIChatDraftState>;
  setActiveConversationId: (conversationId: string) => void;
  setDraftInput: (conversationId: string, input: string) => void;
  setDraftMode: (conversationId: string, mode: Mode) => void;
  setDraftFiles: (conversationId: string, files: File[]) => void;
}

const DEFAULT_DRAFT_STATE: AIChatDraftState = {
  input: "",
  mode: "advisory",
  files: [],
};

function createDefaultDraftState(): AIChatDraftState {
  return {
    input: DEFAULT_DRAFT_STATE.input,
    mode: DEFAULT_DRAFT_STATE.mode,
    files: [...DEFAULT_DRAFT_STATE.files],
  };
}

function isDefaultDraftState(draft: AIChatDraftState): boolean {
  return (
    draft.input.trim().length === 0 &&
    draft.mode === DEFAULT_DRAFT_STATE.mode &&
    draft.files.length === 0
  );
}

const AIChatContext = createContext<AIChatProviderValue | null>(null);

export function AIChatProvider({ children }: { children: React.ReactNode }) {
  const [activeConversationId, setActiveConversationIdState] = useState<
    string | null
  >(null);
  const [draftsByConversationId, setDraftsByConversationId] = useState<
    Record<string, AIChatDraftState>
  >({});

  const setActiveConversationId = useCallback((conversationId: string) => {
    setActiveConversationIdState(conversationId);
  }, []);

  const setDraftInput = useCallback((conversationId: string, input: string) => {
    setDraftsByConversationId((previousDrafts) => {
      const previousDraft =
        previousDrafts[conversationId] ?? createDefaultDraftState();
      const nextDraft: AIChatDraftState = {
        ...previousDraft,
        input,
      };

      if (isDefaultDraftState(nextDraft)) {
        if (!previousDrafts[conversationId]) return previousDrafts;
        const remainingDrafts = { ...previousDrafts };
        delete remainingDrafts[conversationId];
        return remainingDrafts;
      }

      return {
        ...previousDrafts,
        [conversationId]: nextDraft,
      };
    });
  }, []);

  const setDraftMode = useCallback((conversationId: string, mode: Mode) => {
    setDraftsByConversationId((previousDrafts) => {
      const previousDraft =
        previousDrafts[conversationId] ?? createDefaultDraftState();
      const nextDraft: AIChatDraftState = {
        ...previousDraft,
        mode,
      };

      if (isDefaultDraftState(nextDraft)) {
        if (!previousDrafts[conversationId]) return previousDrafts;
        const remainingDrafts = { ...previousDrafts };
        delete remainingDrafts[conversationId];
        return remainingDrafts;
      }

      return {
        ...previousDrafts,
        [conversationId]: nextDraft,
      };
    });
  }, []);

  const setDraftFiles = useCallback((conversationId: string, files: File[]) => {
    setDraftsByConversationId((previousDrafts) => {
      const previousDraft =
        previousDrafts[conversationId] ?? createDefaultDraftState();
      const nextDraft: AIChatDraftState = {
        ...previousDraft,
        files: [...files],
      };

      if (isDefaultDraftState(nextDraft)) {
        if (!previousDrafts[conversationId]) return previousDrafts;
        const remainingDrafts = { ...previousDrafts };
        delete remainingDrafts[conversationId];
        return remainingDrafts;
      }

      return {
        ...previousDrafts,
        [conversationId]: nextDraft,
      };
    });
  }, []);

  const value = useMemo<AIChatProviderValue>(
    () => ({
      activeConversationId,
      draftsByConversationId,
      setActiveConversationId,
      setDraftInput,
      setDraftMode,
      setDraftFiles,
    }),
    [
      activeConversationId,
      draftsByConversationId,
      setActiveConversationId,
      setDraftInput,
      setDraftMode,
      setDraftFiles,
    ],
  );

  return (
    <AIChatContext.Provider value={value}>{children}</AIChatContext.Provider>
  );
}

export function useAIChatState(): AIChatProviderValue {
  const context = useContext(AIChatContext);

  if (!context) {
    throw new Error("useAIChatState must be used within an AIChatProvider.");
  }

  return context;
}
