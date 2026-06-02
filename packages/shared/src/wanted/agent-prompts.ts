// Refiner agent — pure constants. No I/O, no side effects, no Anthropic SDK import.
// These are shared so the web route handler and any future worker both use
// identical configuration without duplicating strings.

export const REFINER_MODEL = 'claude-sonnet-4-6';
export const REFINER_TEMPERATURE = 0.4;
export const REFINER_MAX_TURNS = 12;

/**
 * Minimum completeness score required before the server will allow a Brief to
 * be published. The Refiner agent uses 0.7 as its own stop target, but the
 * hard server gate is lower (0.5) to give seekers editorial flexibility.
 */
export const MARK_READY_COMPLETENESS_FLOOR = 0.5;

export const REFINER_SYSTEM_PROMPT = `You are the Hatch Brief Refiner. Your job is to interview a seeker — a
person who arrived at Hatch with a problem to solve — and turn their vague
problem statement into a structured Brief that builders can act on.

Hatch is a community of indie builders shipping side projects. Seekers may
be non-technical, semi-technical, or developers themselves. Match your tone
to theirs: casual, concrete, no jargon unless they used it first.

Your goal: reach quality_score >= 0.7 in <= 6 turns. Strongly prefer fewer
turns over more. If you can stop at turn 3, stop at turn 3.

You will be given:
- The current draft BriefContent (may be partial or empty).
- The most recent user message.
- The conversation history.

You must:
1. Decide whether the current draft is good enough to publish (quality_score >= 0.7).
2. If not, ask exactly ONE clarifying question.
3. Update the structured BriefContent with any new information.

Question priority (skip questions already answered):
1. Trigger — what just happened to make them search now?
2. Workaround — what are they doing today? (reveals technical_level + stack)
3. End state — if it all worked, what would change?
4. Anti-solution — what they already know WON'T solve this. (Highest leverage.)
5. Constraints — budget band, timeline. Open-ended, not multi-choice.
6. Solution preference — existing app, custom build, fork, or consulting?

Do NOT:
- Ask multiple questions in one turn.
- Re-ask a question whose answer is already in the draft.
- Propose solutions yourself. (The matcher does that.)
- Use the phrase "great question" or similar AI-tells.

When the draft is good enough, stop asking questions and instead respond
with a one-paragraph summary of what you understood, plus the tool call
mark_ready_for_matching. The seeker can either confirm (→ matching) or
keep editing.

Your output is ALWAYS in two parts:
1. A short message to the seeker (max 3 sentences).
2. A tool call: either update_brief_draft (with patches) or
   mark_ready_for_matching (no args).`;

type RefinerTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const REFINER_TOOLS: RefinerTool[] = [
  {
    name: 'update_brief_draft',
    description: 'Patch the current brief draft. Pass only the fields you have new info for.',
    input_schema: {
      type: 'object',
      properties: {
        patch: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
            },
            problem: {
              type: 'object',
              properties: {
                trigger: { type: 'string' },
                affected: { type: 'string' },
                currentWorkaround: { type: 'string' },
                costOfNotSolving: { type: 'string' },
              },
            },
            desiredOutcome: {
              type: 'object',
              properties: {
                definitionOfGoodEnough: { type: 'string' },
                mustHaves: {
                  type: 'array',
                  items: { type: 'string' },
                },
                niceToHaves: {
                  type: 'array',
                  items: { type: 'string' },
                },
                outOfScope: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            context: {
              type: 'object',
              properties: {
                industry: { type: 'string' },
                useCase: {
                  type: 'string',
                  enum: ['personal', 'team', 'client_deliverable', 'other'],
                },
                technicalLevel: {
                  type: 'string',
                  enum: ['non_technical', 'semi_technical', 'developer'],
                },
                existingStack: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            constraints: {
              type: 'object',
              properties: {
                budgetBand: {
                  type: 'string',
                  enum: ['exploratory', 'lt_500', 'from_500_2k', 'from_2k_10k', 'gt_10k', 'open'],
                },
                timeline: {
                  type: 'string',
                  enum: ['asap', 'weeks', 'months', 'no_rush'],
                },
                licensing: {
                  type: 'string',
                  enum: ['saas_ok', 'self_hosted_only', 'oss_only', 'no_pref'],
                },
                geography: {
                  type: ['string', 'null'],
                },
              },
            },
            preferredSolutionType: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['existing_app', 'custom_build', 'fork_and_modify', 'consulting'],
              },
            },
          },
          required: [],
        },
      },
      required: ['patch'],
    },
  },
  {
    name: 'mark_ready_for_matching',
    description:
      'Call this when the draft is good enough (completenessScore >= 0.5). No arguments.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];
