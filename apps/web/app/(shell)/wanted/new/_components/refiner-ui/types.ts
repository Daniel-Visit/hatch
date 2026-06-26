// Shared types for the 6 declarative Refiner UI components (§3.1.5).
//
// Each component is invoked by the agent via a `ui_call` envelope
// ({ component, props }) and returns a structured `output` via /ui-response.
// The props/output shapes mirror UI_TOOLS in @hatch/shared.

export type UiComponentName =
  | 'multiple_choice'
  | 'app_comparison'
  | 'negative_picker'
  | 'dimension_slider'
  | 'priority_ranking'
  | 'budget_picker';

// ── Props (agent → frontend) ──

export type MultipleChoiceProps = {
  question: string;
  options: Array<{ id: string; label: string; description?: string }>;
  multiSelect?: boolean;
};

export type AppComparisonProps = {
  category: string;
  count: 2 | 3 | 4;
  contextHint?: string;
  // The agent supplies category/count; the frontend would resolve real apps.
  // For the declarative catalog we accept an optional pre-resolved app list.
  apps?: Array<{ id: string; name: string; tagline?: string; glyph?: string }>;
};

export type NegativePickerProps = {
  category: string;
  count: 3 | 4 | 5;
  prompt: string;
  apps?: Array<{ id: string; name: string; glyph?: string }>;
};

export type DimensionSliderProps = {
  dimension: string;
  prompt: string;
  leftAnchor: string;
  rightAnchor: string;
  stops: Array<{ position: number; label: string }>;
};

export type PriorityRankingProps = {
  prompt: string;
  items: Array<{ id: string; label: string }>;
};

export type BudgetPickerProps = Record<string, never>;

// ── Output (frontend → agent, via /ui-response) ──

export type MultipleChoiceOutput = { selected: string | string[] };
export type AppComparisonOutput = { similarTo: string[]; notSimilarTo: string[] };
export type NegativePickerOutput = { excluded: string[]; exclusionReasons?: string[] };
export type DimensionSliderOutput = { dimension: string; position: number; label: string };
export type PriorityRankingOutput = { ranked: string[] };
export type BudgetPickerOutput = {
  band: 'EXPLORATORY' | 'LT_500' | 'FROM_500_2K' | 'FROM_2K_10K' | 'GT_10K' | 'OPEN';
};

export type UiOutput = Record<string, unknown>;

/** Common props for every component: interactive vs frozen + the submit hook. */
export type ComponentMode =
  | { frozen: false; onSubmit: (output: UiOutput) => void; disabled?: boolean }
  | { frozen: true; output: UiOutput };
