export interface ScenarioInitialValueSuggestion {
  value: number;
  currency: string;
}

export interface ScenarioInitialValueSuggestions {
  cash: ScenarioInitialValueSuggestion | null;
  netWorth: ScenarioInitialValueSuggestion | null;
}
