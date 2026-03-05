export interface ScenarioStartingValueSuggestion {
  value: number;
  currency: string;
}

export interface ScenarioStartingValueSuggestions {
  cash: ScenarioStartingValueSuggestion | null;
  netWorth: ScenarioStartingValueSuggestion | null;
}
