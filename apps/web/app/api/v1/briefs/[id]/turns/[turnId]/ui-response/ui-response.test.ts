import { describe, it, expect } from 'vitest';
import { UI_TOOLS } from '@hatch/shared';
import {
  readUiCall,
  readUiResponse,
  validateAgainstSchema,
  synthesizeUserMessage,
} from './helpers';

/**
 * Unit tests for the pure helpers in the ui-response route. These cover the
 * subtle §2.1.1 logic (schema validation + envelope reading + synthesis)
 * without exercising the HTTP handler (which depends on auth/Supabase).
 */

function schemaFor(name: string): unknown {
  const tool = UI_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`missing UI tool ${name}`);
  return tool.output_schema;
}

describe('validateAgainstSchema — against the real UI_TOOLS output_schemas', () => {
  it('accepts a valid multiple_choice (string selected)', () => {
    expect(validateAgainstSchema(schemaFor('multiple_choice'), { selected: 'a' })).toBe(true);
  });

  it('accepts a valid multiple_choice (array selected, oneOf branch)', () => {
    expect(validateAgainstSchema(schemaFor('multiple_choice'), { selected: ['a', 'b'] })).toBe(
      true,
    );
  });

  it('rejects multiple_choice missing required `selected`', () => {
    expect(validateAgainstSchema(schemaFor('multiple_choice'), {})).toBe(false);
  });

  it('rejects multiple_choice with a number selected (fails both oneOf branches)', () => {
    expect(validateAgainstSchema(schemaFor('multiple_choice'), { selected: 3 })).toBe(false);
  });

  it('accepts a valid negative_picker (excluded required; reasons optional)', () => {
    expect(validateAgainstSchema(schemaFor('negative_picker'), { excluded: ['x'] })).toBe(true);
    expect(
      validateAgainstSchema(schemaFor('negative_picker'), {
        excluded: ['x'],
        exclusionReasons: ['too complex'],
      }),
    ).toBe(true);
  });

  it('rejects negative_picker missing required `excluded`', () => {
    expect(validateAgainstSchema(schemaFor('negative_picker'), { exclusionReasons: ['a'] })).toBe(
      false,
    );
  });

  it('validates dimension_slider integer bounds (0..4)', () => {
    const s = schemaFor('dimension_slider');
    expect(validateAgainstSchema(s, { dimension: 'simple', position: 2, label: 'mid' })).toBe(true);
    expect(validateAgainstSchema(s, { dimension: 'simple', position: 5, label: 'mid' })).toBe(
      false,
    );
    expect(validateAgainstSchema(s, { dimension: 'simple', position: 1.5, label: 'mid' })).toBe(
      false,
    );
  });

  it('validates budget_picker enum membership', () => {
    const s = schemaFor('budget_picker');
    expect(validateAgainstSchema(s, { band: 'FROM_2K_10K' })).toBe(true);
    expect(validateAgainstSchema(s, { band: 'not_a_band' })).toBe(false);
  });

  it('validates priority_ranking array of strings', () => {
    const s = schemaFor('priority_ranking');
    expect(validateAgainstSchema(s, { ranked: ['a', 'b', 'c'] })).toBe(true);
    expect(validateAgainstSchema(s, { ranked: [1, 2] })).toBe(false);
  });

  it('accepts a valid app_comparison (both arrays required)', () => {
    expect(
      validateAgainstSchema(schemaFor('app_comparison'), {
        similarTo: ['Notion'],
        notSimilarTo: ['Trello', 'Asana'],
      }),
    ).toBe(true);
  });

  it('rejects app_comparison missing required `notSimilarTo`', () => {
    expect(validateAgainstSchema(schemaFor('app_comparison'), { similarTo: ['Notion'] })).toBe(
      false,
    );
  });

  it('rejects non-object output', () => {
    expect(validateAgainstSchema(schemaFor('multiple_choice'), 'nope')).toBe(false);
    expect(validateAgainstSchema(schemaFor('multiple_choice'), null)).toBe(false);
  });
});

describe('readUiCall / readUiResponse', () => {
  it('reads a ui_call envelope from ui_component_invocation', () => {
    const call = readUiCall({ component: 'negative_picker', props: { category: 'crm' } });
    expect(call).not.toBeNull();
    expect(call?.component).toBe('negative_picker');
    expect(call?.props).toEqual({ category: 'crm' });
  });

  it('does NOT read a ui_response as a ui_call', () => {
    expect(
      readUiCall({ kind: 'ui_response', inResponseToTurnId: 't1', component: 'x', output: {} }),
    ).toBeNull();
  });

  it('returns null for non-object / array invocations', () => {
    expect(readUiCall(null)).toBeNull();
    expect(readUiCall([])).toBeNull();
    expect(readUiCall({})).toBeNull();
  });

  it('reads a ui_response envelope', () => {
    const r = readUiResponse({
      kind: 'ui_response',
      inResponseToTurnId: 't1',
      component: 'budget_picker',
      output: { band: 'OPEN' },
    });
    expect(r).not.toBeNull();
    expect(r?.inResponseToTurnId).toBe('t1');
    expect(r?.output).toEqual({ band: 'OPEN' });
  });

  it('returns null reading a ui_call as a ui_response', () => {
    expect(readUiResponse({ component: 'budget_picker', props: {} })).toBeNull();
  });
});

describe('synthesizeUserMessage', () => {
  it('multiple_choice (single)', () => {
    expect(synthesizeUserMessage('multiple_choice', { selected: 'team' })).toContain('team');
  });

  it('negative_picker', () => {
    const msg = synthesizeUserMessage('negative_picker', { excluded: ['Notion', 'Trello'] });
    expect(msg).toContain('Notion');
    expect(msg).toContain('Trello');
  });

  it('budget_picker', () => {
    expect(synthesizeUserMessage('budget_picker', { band: 'LT_500' })).toContain('LT_500');
  });

  it('unknown component falls back to JSON', () => {
    expect(synthesizeUserMessage('mystery', { foo: 1 })).toContain('"foo":1');
  });
});
