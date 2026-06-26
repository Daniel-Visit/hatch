// BriefContent — the structured JSON stored in Brief.content.
// These are lowercase zod enum values matching the JSON shape the agents
// read and write. They are intentionally distinct from the UPPERCASE DB
// enums in enums.ts (two separate layers — DB storage vs. content shape).

import { z } from 'zod';

export const BriefContentSchema = z.object({
  title: z.string().max(120).optional(),
  problem: z
    .object({
      trigger: z.string().optional(),
      affected: z.string().optional(),
      currentWorkaround: z.string().optional(),
      costOfNotSolving: z.string().optional(),
    })
    .default({}),
  desiredOutcome: z
    .object({
      definitionOfGoodEnough: z.string().optional(),
      mustHaves: z.array(z.string()).default([]),
      niceToHaves: z.array(z.string()).default([]),
      outOfScope: z.array(z.string()).default([]),
    })
    .default({}),
  context: z
    .object({
      industry: z.string().optional(),
      useCase: z
        .enum(['personal', 'team', 'client_deliverable', 'other'])
        .optional(),
      technicalLevel: z
        .enum(['non_technical', 'semi_technical', 'developer'])
        .optional(),
      existingStack: z.array(z.string()).default([]),
    })
    .default({}),
  constraints: z
    .object({
      budgetBand: z
        .enum(['exploratory', 'lt_500', 'from_500_2k', 'from_2k_10k', 'gt_10k', 'open'])
        .optional(),
      timeline: z.enum(['asap', 'weeks', 'months', 'no_rush']).optional(),
      licensing: z
        .enum(['saas_ok', 'self_hosted_only', 'oss_only', 'no_pref'])
        .default('no_pref'),
      geography: z.string().nullable().default(null),
    })
    .default({}),
  preferredSolutionType: z
    .array(
      z.enum(['existing_app', 'custom_build', 'fork_and_modify', 'consulting']),
    )
    .default([]),
});

export type BriefContent = z.infer<typeof BriefContentSchema>;
