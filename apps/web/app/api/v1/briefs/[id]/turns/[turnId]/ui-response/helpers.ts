// Pure helpers for the ui-response route (§2.1.1 / §3.1.5.2). Extracted from
// route.ts because Next.js route files may only export route handlers + config
// (a stray export trips `next build`'s route-type validation). The route and
// its unit tests both import from here.

/** The ui_call envelope stored on a turn's `ui_component_invocation`. */
export type UiCallEnvelope = {
  /** Discriminates the stored shape: the ORIGINAL agent ui_call. */
  kind?: 'ui_call';
  component: string;
  props?: Record<string, unknown>;
};

/** The ui_response metadata stored on the synthesized USER turn. */
export type UiResponseEnvelope = {
  kind: 'ui_response';
  inResponseToTurnId: string;
  component: string;
  output: Record<string, unknown>;
};

/** Read a turn's `ui_component_invocation` as a ui_call envelope, or null. */
export function readUiCall(invocation: unknown): UiCallEnvelope | null {
  if (typeof invocation !== 'object' || invocation === null || Array.isArray(invocation)) {
    return null;
  }
  const rec = invocation as Record<string, unknown>;
  // A ui_response envelope is NOT a ui_call (it has kind === 'ui_response').
  if (rec.kind === 'ui_response') return null;
  if (typeof rec.component !== 'string' || rec.component.length === 0) return null;
  return {
    kind: 'ui_call',
    component: rec.component,
    props:
      typeof rec.props === 'object' && rec.props !== null && !Array.isArray(rec.props)
        ? (rec.props as Record<string, unknown>)
        : undefined,
  };
}

/** Read a turn's `ui_component_invocation` as a ui_response envelope, or null. */
export function readUiResponse(invocation: unknown): UiResponseEnvelope | null {
  if (typeof invocation !== 'object' || invocation === null || Array.isArray(invocation)) {
    return null;
  }
  const rec = invocation as Record<string, unknown>;
  if (rec.kind !== 'ui_response') return null;
  if (typeof rec.inResponseToTurnId !== 'string') return null;
  if (typeof rec.component !== 'string') return null;
  if (typeof rec.output !== 'object' || rec.output === null || Array.isArray(rec.output)) {
    return null;
  }
  return {
    kind: 'ui_response',
    inResponseToTurnId: rec.inResponseToTurnId,
    component: rec.component,
    output: rec.output as Record<string, unknown>,
  };
}

/**
 * Minimal JSON-Schema validator covering ONLY the shapes used by the six
 * `UI_TOOLS` output_schemas: object with `required`, properties of type
 * `string` / `integer` / `array` (with item type) / `enum` / `oneOf`, plus
 * integer `minimum` / `maximum`. Returns true iff `value` conforms. We hand-roll
 * this rather than add an ajv dependency (no new deps).
 */
export function validateAgainstSchema(schema: unknown, value: unknown): boolean {
  if (typeof schema !== 'object' || schema === null) return false;
  const s = schema as Record<string, unknown>;

  // oneOf: value must satisfy at least one branch.
  if (Array.isArray(s.oneOf)) {
    return s.oneOf.some((branch) => validateAgainstSchema(branch, value));
  }

  // enum: value must be one of the listed primitives.
  if (Array.isArray(s.enum)) {
    return s.enum.some((e) => e === value);
  }

  const type = s.type;

  if (type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const obj = value as Record<string, unknown>;
    const props = (s.properties as Record<string, unknown> | undefined) ?? {};
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];

    for (const key of required) {
      if (!(key in obj) || obj[key] === undefined) return false;
    }
    // Validate every present property that has a declared schema.
    for (const [key, propSchema] of Object.entries(props)) {
      if (key in obj && obj[key] !== undefined) {
        if (!validateAgainstSchema(propSchema, obj[key])) return false;
      }
    }
    return true;
  }

  if (type === 'array') {
    if (!Array.isArray(value)) return false;
    if (typeof s.minItems === 'number' && value.length < s.minItems) return false;
    if (typeof s.maxItems === 'number' && value.length > s.maxItems) return false;
    const itemSchema = s.items;
    if (itemSchema !== undefined) {
      return value.every((item) => validateAgainstSchema(itemSchema, item));
    }
    return true;
  }

  if (type === 'string') {
    return typeof value === 'string';
  }

  if (type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return false;
    if (typeof s.minimum === 'number' && value < s.minimum) return false;
    if (typeof s.maximum === 'number' && value > s.maximum) return false;
    return true;
  }

  if (type === 'number') {
    return typeof value === 'number';
  }

  if (type === 'boolean') {
    return typeof value === 'boolean';
  }

  // Unknown / unconstrained schema → accept (we only constrain known shapes).
  return true;
}

/** Options for {@link synthesizeUserMessage}. */
export type SynthesizeOptions = {
  /** The original ui_call props (carries `options`/`items`/`apps` for label lookup). */
  props?: Record<string, unknown>;
  /** Seeker's locale (`profile.locale_pref`). `es*` → Spanish, anything else → English. */
  locale?: string | null;
};

/**
 * Synthesize a natural-language user message representing the seeker's selection
 * (§3.1.5.2). The message is for the conversation log only — the agent patches
 * the draft from the structured `output`, which is preserved in turn metadata.
 *
 * It is rendered as the seeker's own chat bubble, so it must (a) read in the
 * seeker's language (not always English — that was making the Refiner switch to
 * English) and (b) show option LABELS, not raw values (e.g. "Para otros
 * peluqueros", not "others"). Falls back to the raw value when no label is found,
 * which keeps the 2-arg callers (unit tests) producing the original English text.
 */
export function synthesizeUserMessage(
  component: string,
  output: Record<string, unknown>,
  opts: SynthesizeOptions = {},
): string {
  const es = (opts.locale ?? 'en').toLowerCase().startsWith('es');

  // Pool every option-like array the props might carry, so a selected VALUE can
  // be resolved to its human LABEL regardless of the component's prop key.
  const optionPool = [opts.props?.options, opts.props?.items, opts.props?.apps]
    .filter((a): a is unknown[] => Array.isArray(a))
    .flat()
    .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null);
  const labelOf = (value: unknown): string => {
    const hit = optionPool.find((o) => o.value === value || o.id === value);
    if (hit && typeof hit.label === 'string') return hit.label;
    if (hit && typeof hit.name === 'string') return hit.name;
    return String(value ?? '');
  };
  const labels = (v: unknown): string =>
    (Array.isArray(v) ? v : [v]).map(labelOf).filter(Boolean).join(', ');
  const raw = (v: unknown): string =>
    Array.isArray(v) ? v.map(String).join(', ') : String(v ?? '');

  switch (component) {
    case 'multiple_choice':
      return es ? `Elegí: ${labels(output.selected)}.` : `I picked: ${labels(output.selected)}.`;
    case 'app_comparison': {
      const similar = raw(output.similarTo);
      const notSimilar = raw(output.notSimilarTo);
      const parts: string[] = [];
      if (es) {
        if (similar) parts.push(`más parecida a: ${similar}`);
        if (notSimilar) parts.push(`nada que ver con: ${notSimilar}`);
        return `Comparando esas apps, la mía es ${parts.join('; ') || 'difícil de comparar'}.`;
      }
      if (similar) parts.push(`closest to: ${similar}`);
      if (notSimilar) parts.push(`not like: ${notSimilar}`);
      return `Comparing those apps, mine is ${parts.join('; ') || 'hard to compare'}.`;
    }
    case 'negative_picker': {
      const excluded = labels(output.excluded);
      return es
        ? `Esto claramente NO es lo que quiero: ${excluded || 'ninguna'}.`
        : `These are clearly NOT what I want: ${excluded || 'none of them'}.`;
    }
    case 'dimension_slider': {
      const dim = String(output.dimension ?? (es ? 'eso' : 'that'));
      const val = String(output.label ?? output.position ?? '');
      return es ? `Para ${dim}, lo pongo en: ${val}.` : `For ${dim}, I'd put it at: ${val}.`;
    }
    case 'priority_ranking':
      return es
        ? `Mi orden de prioridad: ${labels(output.ranked)}.`
        : `My priority order is: ${labels(output.ranked)}.`;
    case 'budget_picker':
      return es
        ? `Mi presupuesto: ${String(output.band ?? '')}.`
        : `My budget band is: ${String(output.band ?? '')}.`;
    default:
      return es
        ? `Esta es mi selección: ${JSON.stringify(output)}.`
        : `Here is my selection: ${JSON.stringify(output)}.`;
  }
}
