'use client';

// Declarative Refiner UI renderer (§3.1.5 / §4.4.0a). Resolves a `ui_call`
// envelope's `component` against the fixed catalog and renders it in either
// interactive (with an onSubmit hook) or frozen (final selection, no handlers)
// state. The parent (refiner-transcript.tsx) decides which based on whether the
// turn has a recorded output.

import { MultipleChoice } from './multiple-choice';
import { AppComparison } from './app-comparison';
import { NegativePicker } from './negative-picker';
import { DimensionSlider } from './dimension-slider';
import { PriorityRanking } from './priority-ranking';
import { BudgetPicker } from './budget-picker';
import type {
  AppComparisonProps,
  DimensionSliderProps,
  MultipleChoiceProps,
  NegativePickerProps,
  PriorityRankingProps,
  UiOutput,
} from './types';

type CommonProps = Record<string, unknown>;

type RendererProps =
  | {
      component: string;
      props: CommonProps;
      frozen: false;
      onSubmit: (output: UiOutput) => void;
      disabled?: boolean;
    }
  | {
      component: string;
      props: CommonProps;
      frozen: true;
      output: UiOutput;
    };

/**
 * Render one declarative UI component. Unknown components render nothing
 * (forward-compatibility — the route already validates the component name).
 */
export function RefinerUiComponent(rp: RendererProps) {
  const mode = rp.frozen
    ? ({ frozen: true, output: rp.output } as const)
    : ({ frozen: false, onSubmit: rp.onSubmit, disabled: rp.disabled } as const);

  switch (rp.component) {
    case 'multiple_choice':
      return <MultipleChoice {...(rp.props as unknown as MultipleChoiceProps)} {...mode} />;
    case 'app_comparison':
      return <AppComparison {...(rp.props as unknown as AppComparisonProps)} {...mode} />;
    case 'negative_picker':
      return <NegativePicker {...(rp.props as unknown as NegativePickerProps)} {...mode} />;
    case 'dimension_slider':
      return <DimensionSlider {...(rp.props as unknown as DimensionSliderProps)} {...mode} />;
    case 'priority_ranking':
      return <PriorityRanking {...(rp.props as unknown as PriorityRankingProps)} {...mode} />;
    case 'budget_picker':
      return <BudgetPicker {...mode} />;
    default:
      return null;
  }
}

export type { RendererProps };
