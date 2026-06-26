// Wanted / Brief & Match — DB enum mirrors.
// Values MUST match the SQL enums exactly (uppercase, as in Prisma schema).
// These are the DB-layer constants. For the JSON content shape (lowercase),
// see brief-content.ts (intentionally distinct layers).

export const BRIEF_STATUS = [
  'DRAFT',
  'REFINING',
  'PARSING',
  'AWAITING_VALIDATION',
  'REVIEW_HEALTH',
  'MATCHING',
  'PRIVATE',
  'PUBLIC',
  'RESOLVED',
  'EXPIRED',
] as const;
export type BriefStatus = (typeof BRIEF_STATUS)[number];

/** Statuses that count toward a seeker's active-brief quota (max 3). */
export const ACTIVE_BRIEF_STATUSES = [
  'REFINING',
  'PARSING',
  'AWAITING_VALIDATION',
  'REVIEW_HEALTH',
  'MATCHING',
  'PRIVATE',
] as const;
export type ActiveBriefStatus = (typeof ACTIVE_BRIEF_STATUSES)[number];

export const BRIEF_ENTRY_MODE = ['CHAT', 'FORM', 'PASTE'] as const;
export type BriefEntryMode = (typeof BRIEF_ENTRY_MODE)[number];

export const SUGGESTION_STATUS = [
  'PENDING',
  'APPLIED',
  'DISMISSED',
  'AUTO_DISMISSED',
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUS)[number];

export const BRIEF_VISIBILITY = ['PRIVATE_MATCHED', 'PUBLIC_GALLERY'] as const;
export type BriefVisibility = (typeof BRIEF_VISIBILITY)[number];

export const BRIEF_USE_CASE = [
  'PERSONAL',
  'TEAM',
  'CLIENT_DELIVERABLE',
  'OTHER',
] as const;
export type BriefUseCase = (typeof BRIEF_USE_CASE)[number];

export const TECHNICAL_LEVEL = [
  'NON_TECHNICAL',
  'SEMI_TECHNICAL',
  'DEVELOPER',
] as const;
export type TechnicalLevel = (typeof TECHNICAL_LEVEL)[number];

export const BUDGET_BAND = [
  'EXPLORATORY',
  'LT_500',
  'FROM_500_2K',
  'FROM_2K_10K',
  'GT_10K',
  'OPEN',
] as const;
export type BudgetBand = (typeof BUDGET_BAND)[number];

export const BRIEF_TIMELINE = ['ASAP', 'WEEKS', 'MONTHS', 'NO_RUSH'] as const;
export type BriefTimeline = (typeof BRIEF_TIMELINE)[number];

export const SOLUTION_TYPE = [
  'EXISTING_APP',
  'CUSTOM_BUILD',
  'FORK_AND_MODIFY',
  'CONSULTING',
] as const;
export type SolutionType = (typeof SOLUTION_TYPE)[number];

export const CANDIDATE_TYPE = ['APP', 'BUILDER'] as const;
export type CandidateType = (typeof CANDIDATE_TYPE)[number];

export const SWIPE_ACTION = [
  'PENDING',
  'CONNECT',
  'SKIP',
  'AUTO_SKIPPED',
] as const;
export type SwipeAction = (typeof SWIPE_ACTION)[number];

export const COMMERCIAL_STATUS = [
  'NONE',
  'REPORTED_AGREED',
  'REPORTED_CLOSED',
] as const;
export type CommercialStatus = (typeof COMMERCIAL_STATUS)[number];

export const TURN_ROLE = ['AGENT', 'USER', 'SYSTEM'] as const;
export type TurnRole = (typeof TURN_ROLE)[number];

export const MATCH_PHASE = ['APP', 'BUILDER'] as const;
export type MatchPhase = (typeof MATCH_PHASE)[number];

export const BRIEF_RESOLUTION = [
  'RESOLVED_WITH_APP',
  'RESOLVED_WITH_BUILDER',
  'RESOLVED_ELSEWHERE',
  'ABANDONED',
] as const;
export type BriefResolution = (typeof BRIEF_RESOLUTION)[number];
