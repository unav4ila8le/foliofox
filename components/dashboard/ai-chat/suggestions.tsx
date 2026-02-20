import { Button } from "@/components/ui/button";

import type { ChatSuggestionsProps } from "./types";

const suggestions = [
  "What would happen to my portfolio if the market crashes 30% tomorrow?",
  "How should I rebalance my portfolio to reduce risk while maintaining growth potential?",
  "What are the biggest vulnerabilities in my current investment strategy?",
  "Based on my positions and portfolio history, what's my probability of reaching $1M net worth in 10 years?",
];

export function ChatSuggestions({
  messageCount,
  isAIEnabled,
  showProactiveCapAlert,
  onSuggestionClick,
}: ChatSuggestionsProps) {
  if (messageCount !== 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-4 pb-2">
      <p className="text-muted-foreground px-2 text-sm">Suggestions</p>
      <div className="space-y-1">
        {suggestions.map((suggestion) => (
          <Button
            disabled={!isAIEnabled || showProactiveCapAlert}
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            variant="ghost"
            className="h-auto w-full justify-stretch p-2 text-start whitespace-normal"
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
