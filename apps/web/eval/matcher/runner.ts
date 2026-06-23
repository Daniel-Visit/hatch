/**
 * Eval runner for the Wanted Matcher (Phase A + Phase B).
 *
 * Injects a synthetic in-memory CandidateRetriever so the eval is hermetic
 * except for the Haiku re-rank LLM call. The retriever returns a fixed pool
 * of apps and builders keyed to each eval case (the case carries the expected
 * IDs the pool contains). Each case's pool is defined in the synthetic pool
 * tables below — the retriever is wired per-case to only surface the pool
 * relevant to that case.
 *
 * Assertions check:
 * - Phase A outcome: 'should_surface_app' → hasStrongMatch=true;
 *   'should_skip_to_builders' → Phase A returned no strong match.
 * - appsAtLeastIncluded: all listed app IDs appear in ranked (Phase A).
 * - appsMustNotInclude: none of the listed app IDs appear in ranked (Phase A).
 * - buildersAtLeastIncluded: all listed builder IDs appear in ranked (Phase B).
 * - buildersMustNotInclude: none of the listed builder IDs appear in ranked (Phase B).
 * - maxBuildersReturned: ranked builders count <= this value.
 *
 * This module is only imported in the env-guarded eval test — it is never
 * executed in normal unit test runs.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { BriefContent } from '@hatch/shared';
import type {
  AppCandidate,
  BuilderCandidate,
  CandidateRetriever,
} from '@/lib/wanted/matching/retriever';
import { runPhaseA } from '@/lib/wanted/matching/phase-a';
import { runPhaseB } from '@/lib/wanted/matching/phase-b';
import cases from './cases.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvalCase = {
  id: string;
  description: string;
  briefContent: BriefContent;
  expected: {
    phaseAOutcome: 'should_surface_app' | 'should_skip_to_builders';
    appsAtLeastIncluded?: string[];
    appsMustNotInclude?: string[];
    buildersAtLeastIncluded?: string[];
    buildersMustNotInclude?: string[];
    maxBuildersReturned?: number;
  };
};

export type CaseResult = {
  id: string;
  passed: boolean;
  details: {
    phaseAHasStrongMatch: boolean;
    rankedAppIds: string[];
    rankedBuilderIds: string[];
    phaseBRan: boolean;
    failedAssertions: string[];
  };
};

// ---------------------------------------------------------------------------
// Synthetic pool — apps
// ---------------------------------------------------------------------------

/**
 * A fixed catalog of synthetic app candidates for the eval pool.
 * Each app is designed to match specific eval case assertions.
 */
const SYNTHETIC_APPS: AppCandidate[] = [
  // Lumen.fm — the canonical "obvious app exists" match for match_001 and match_005
  {
    id: 'lumen-fm',
    slug: 'lumen-fm',
    title: 'Lumen',
    tagline: 'API mock server with custom scripting, team workspaces, and OpenAPI import',
    description:
      'Lumen is a developer tool for API mocking. Create realistic mock APIs with custom response scripting, share workspaces with your team, import OpenAPI specs, and simulate edge cases. Used by frontend teams to develop independently of backend availability.',
    categoryId: 'developer-tools',
    tags: ['api-mocking', 'developer-tools', 'team-collaboration', 'openapi'],
    solvesProblems: [
      'frontend blocked waiting for backend APIs',
      'mock server with scripting',
      'team sharing for API collections',
    ],
    link: 'https://lumen.fm',
    authorId: 'user-lumen-author',
  },
  // A route optimization SaaS — weak match, present but should NOT beat Lumen for match_001
  {
    id: 'routemaster-saas',
    slug: 'routemaster-saas',
    title: 'RouteMaster',
    tagline: 'Fleet route optimization for delivery companies',
    description:
      'RouteMaster helps logistics companies optimize delivery routes for fleets of 5–100 drivers. Real-time traffic integration, mobile driver app, and a manager dashboard. Supports Spanish and Portuguese.',
    categoryId: 'logistics',
    tags: ['route-optimization', 'fleet-management', 'logistics', 'mobile'],
    solvesProblems: ['delivery route optimization', 'fleet management', 'last-mile logistics'],
    link: 'https://routemaster.io',
    authorId: 'user-routemaster-author',
  },
  // A generic note-taking app — weak match for most cases
  {
    id: 'noteflow-app',
    slug: 'noteflow-app',
    title: 'NoteFlow',
    tagline: 'Simple Markdown note-taking with sync',
    description:
      'NoteFlow is a distraction-free Markdown editor with sync across devices. Organize notes in folders, export as PDF or HTML.',
    categoryId: 'productivity',
    tags: ['notes', 'markdown', 'productivity', 'sync'],
    solvesProblems: ['note-taking', 'personal organization'],
    link: 'https://noteflow.app',
    authorId: 'user-noteflow-author',
  },
  // A CSV importer tool — for match_003
  {
    id: 'csv-importer-app',
    slug: 'csv-importer-app',
    title: 'EasyImport',
    tagline: 'No-code CSV import tool with visual column mapping for non-technical users',
    description:
      'EasyImport lets non-technical users upload CSV files, map columns with a drag-and-drop UI, validate data with plain-English error messages, and push records to your system via a simple API. No SQL or code required.',
    categoryId: 'data-tools',
    tags: ['csv', 'data-import', 'no-code', 'non-technical'],
    solvesProblems: [
      'CSV import without engineering help',
      'data onboarding for non-technical users',
      'column mapping and validation',
    ],
    link: 'https://easyimport.app',
    authorId: 'user-easyimport-author',
  },
];

// ---------------------------------------------------------------------------
// Synthetic pool — builders
// ---------------------------------------------------------------------------

const NOW_ISO = new Date().toISOString();
const RECENT_ISO = new Date(Date.now() - 7 * 86_400_000).toISOString(); // 7 days ago
const OLD_ISO = new Date(Date.now() - 90 * 86_400_000).toISOString(); // 90 days ago

const SYNTHETIC_BUILDERS: BuilderCandidate[] = [
  // builder-alice: creative/AI tooling, good for match_002
  {
    id: 'builder-alice',
    handle: 'alice',
    displayName: 'Alice Chen',
    bio: 'Full-stack developer specializing in AI-powered creative tools. Shipped 3 apps in the media/design space.',
    acceptsRequests: true,
    requestCapacity: 3,
    requestDomains: ['media', 'creative-tools', 'ai'],
    requestRateBand: 'FROM_500_2K',
    inferredCapabilities: ['React', 'Python', 'OpenAI API', 'Figma API'],
    lastBriefResponseAt: RECENT_ISO,
    shippedAppCount: 3,
    shippedApps: [
      {
        title: 'BrandBot',
        tagline: 'AI brand identity generator',
        categoryId: 'ai-tools',
        tags: ['ai', 'branding', 'design'],
      },
      {
        title: 'PaletteAI',
        tagline: 'Color palette generator from brand guidelines',
        categoryId: 'design-tools',
        tags: ['design', 'ai', 'colors'],
      },
      {
        title: 'CopyFlow',
        tagline: 'AI-assisted marketing copy for indie creators',
        categoryId: 'marketing',
        tags: ['ai', 'copywriting', 'marketing'],
      },
    ],
    activeMatchCount: 1,
  },
  // builder-bob: creative/media, good for match_002
  {
    id: 'builder-bob',
    handle: 'bob',
    displayName: 'Bob Martinez',
    bio: 'Designer-turned-developer. Build tools for the music and creative industries.',
    acceptsRequests: true,
    requestCapacity: 2,
    requestDomains: ['music', 'creative-tools', 'media'],
    requestRateBand: 'FROM_500_2K',
    inferredCapabilities: ['Next.js', 'TypeScript', 'Spotify API', 'Figma'],
    lastBriefResponseAt: RECENT_ISO,
    shippedAppCount: 2,
    shippedApps: [
      {
        title: 'ArtistKit',
        tagline: 'Brand toolkit for independent musicians',
        categoryId: 'music-tools',
        tags: ['music', 'branding', 'creative'],
      },
      {
        title: 'ReleaseBoard',
        tagline: 'Release management dashboard for indie labels',
        categoryId: 'music-tools',
        tags: ['music', 'labels', 'management'],
      },
    ],
    activeMatchCount: 0,
  },
  // builder-carol: AI/generative, good for match_002
  {
    id: 'builder-carol',
    handle: 'carol',
    displayName: 'Carol Kim',
    bio: 'ML engineer shipping generative AI applications. Focus on visual AI systems.',
    acceptsRequests: true,
    requestCapacity: 4,
    requestDomains: ['ai', 'media', 'creative-tools'],
    requestRateBand: 'FROM_2K_10K',
    inferredCapabilities: ['Python', 'Stable Diffusion', 'ComfyUI', 'FastAPI', 'React'],
    lastBriefResponseAt: NOW_ISO,
    shippedAppCount: 4,
    shippedApps: [
      {
        title: 'StyleSync',
        tagline: 'AI visual style transfer for brand assets',
        categoryId: 'ai-tools',
        tags: ['ai', 'visual', 'brand'],
      },
      {
        title: 'MockupAI',
        tagline: 'Generate product mockups with AI',
        categoryId: 'design-tools',
        tags: ['ai', 'design', 'mockup'],
      },
      {
        title: 'LogoForge',
        tagline: 'AI-powered logo variations from a seed design',
        categoryId: 'ai-tools',
        tags: ['ai', 'logo', 'branding'],
      },
      {
        title: 'VideoTheme',
        tagline: 'Auto-generate themed video intros from brand kit',
        categoryId: 'ai-tools',
        tags: ['ai', 'video', 'brand'],
      },
    ],
    activeMatchCount: 2,
  },
  // builder-latam: LATAM-focused, for match_004
  {
    id: 'builder-latam',
    handle: 'carlos_dev',
    displayName: 'Carlos Mendoza',
    bio: 'Backend developer in São Paulo. Build logistics and delivery apps for the LATAM market. Fluent in Portuguese and Spanish.',
    acceptsRequests: true,
    requestCapacity: 3,
    requestDomains: ['logistics', 'delivery', 'latam'],
    requestRateBand: 'FROM_2K_10K',
    inferredCapabilities: [
      'Node.js',
      'React Native',
      'PostgreSQL',
      'Google Maps API',
      'Spanish',
      'Portuguese',
    ],
    lastBriefResponseAt: RECENT_ISO,
    shippedAppCount: 2,
    shippedApps: [
      {
        title: 'EntregaFácil',
        tagline: 'Delivery route planner for Brazilian SMBs',
        categoryId: 'logistics',
        tags: ['logistics', 'delivery', 'brazil', 'route-optimization'],
      },
      {
        title: 'FlotaManager',
        tagline: 'Fleet management for Latin American delivery companies',
        categoryId: 'logistics',
        tags: ['fleet', 'logistics', 'latam', 'spanish'],
      },
    ],
    activeMatchCount: 1,
  },
  // builder-us-only: US-only, should NOT match for match_004 (LATAM brief)
  {
    id: 'builder-us-only',
    handle: 'john_us',
    displayName: 'John Smith',
    bio: 'US-based developer. Build logistics apps for US/Canada market only.',
    acceptsRequests: true,
    requestCapacity: 3,
    requestDomains: ['logistics', 'us-market'],
    requestRateBand: 'FROM_2K_10K',
    inferredCapabilities: ['Node.js', 'React', 'Google Maps API'],
    lastBriefResponseAt: RECENT_ISO,
    shippedAppCount: 2,
    shippedApps: [
      {
        title: 'RouteUS',
        tagline: 'Delivery route optimization for US fleets',
        categoryId: 'logistics',
        tags: ['logistics', 'us', 'route-optimization'],
      },
      {
        title: 'FleetPro',
        tagline: 'Fleet management for North American companies',
        categoryId: 'logistics',
        tags: ['fleet', 'us', 'canada'],
      },
    ],
    activeMatchCount: 0,
  },
  // builder-expensive: GT_10K rate, must be filtered for match_003 (exploratory budget)
  {
    id: 'builder-expensive',
    handle: 'enterprise_dev',
    displayName: 'Enterprise Dev LLC',
    bio: 'Enterprise software development firm. Minimum engagement $15,000.',
    acceptsRequests: true,
    requestCapacity: 5,
    requestDomains: ['data-tools', 'enterprise'],
    requestRateBand: 'GT_10K',
    inferredCapabilities: ['Java', 'Spring Boot', 'Oracle', 'AWS'],
    lastBriefResponseAt: OLD_ISO,
    shippedAppCount: 2,
    shippedApps: [
      {
        title: 'DataBridge',
        tagline: 'Enterprise ETL pipeline builder',
        categoryId: 'data-tools',
        tags: ['etl', 'enterprise', 'data'],
      },
      {
        title: 'ImportSuite',
        tagline: 'Enterprise data import and transformation platform',
        categoryId: 'data-tools',
        tags: ['import', 'enterprise', 'data'],
      },
    ],
    activeMatchCount: 2,
  },
  // builder-csv: indie CSV builder with no rate band (open to any budget), good for match_003 exploratory
  {
    id: 'builder-csv',
    handle: 'csv_wizard',
    displayName: 'Sam Lee',
    bio: 'Indie developer building small data tools. Love making data accessible to non-technical users.',
    acceptsRequests: true,
    requestCapacity: 5,
    requestDomains: ['data-tools', 'no-code'],
    requestRateBand: null,
    inferredCapabilities: ['React', 'Node.js', 'Papa Parse', 'Airtable'],
    lastBriefResponseAt: RECENT_ISO,
    shippedAppCount: 3,
    shippedApps: [
      {
        title: 'QuickImport',
        tagline: 'Simple CSV uploader for small teams',
        categoryId: 'data-tools',
        tags: ['csv', 'import', 'no-code'],
      },
      {
        title: 'DataMapper',
        tagline: 'Visual column mapping tool for non-technical users',
        categoryId: 'data-tools',
        tags: ['csv', 'mapping', 'non-technical'],
      },
      {
        title: 'SheetBridge',
        tagline: 'Sync spreadsheets to databases without code',
        categoryId: 'data-tools',
        tags: ['spreadsheet', 'database', 'no-code'],
      },
    ],
    activeMatchCount: 0,
  },
];

// ---------------------------------------------------------------------------
// Synthetic CandidateRetriever factory
// ---------------------------------------------------------------------------

/**
 * Build a synthetic in-memory retriever that returns a fixed set of
 * apps and builders. The retriever respects:
 * - existingStack exclusion (apps whose title/slug is in the stack are dropped).
 * - requestRateBand overlap (builders whose rate doesn't overlap the brief budget
 *   are excluded — mirrors the FTS retriever's cheap in-memory filter).
 * - requestDomains / geography filter: if the brief has geography and the builder
 *   has requestDomains, only include builders whose domains contain a keyword
 *   from the geography hint.
 *
 * The `appPool` and `builderPool` are injected per-case so each case exercises
 * only the relevant subset of the synthetic catalog (or the full catalog if
 * desired — callers decide the pool size per case).
 */
function createSyntheticRetriever(
  appPool: AppCandidate[],
  builderPool: BuilderCandidate[],
): CandidateRetriever {
  return {
    async retrieveApps(brief: BriefContent): Promise<AppCandidate[]> {
      const existing = new Set(
        (brief.context?.existingStack ?? []).map((s) => s.toLowerCase().trim()),
      );
      return appPool.filter(
        (app) =>
          !existing.has(app.title.toLowerCase().trim()) &&
          !existing.has(app.slug.toLowerCase().trim()),
      );
    },

    async retrieveBuilders(brief: BriefContent): Promise<BuilderCandidate[]> {
      const briefBand = brief.constraints?.budgetBand?.toUpperCase() ?? null;
      const geo = brief.constraints?.geography?.toLowerCase().trim() ?? null;

      return builderPool.filter((builder) => {
        // Rate band filter (mirrors retriever.ts rateBandOverlaps)
        if (briefBand !== null && builder.requestRateBand !== null) {
          if (briefBand !== 'OPEN' && builder.requestRateBand !== 'OPEN') {
            if (briefBand !== builder.requestRateBand) return false;
          }
        }

        // Geography filter: if geo is set and builder has domains, require
        // that at least one domain keyword overlaps the geography hint.
        // This is a synthetic proxy for the real geo filter (which would be
        // a proper regions column) — good enough for eval purposes.
        if (geo !== null && builder.requestDomains.length > 0) {
          const geoKeywords = geo.split(/[\s,/]+/).filter((k) => k.length > 2);
          const domainStr = builder.requestDomains.join(' ').toLowerCase();
          const hasGeoOverlap = geoKeywords.some((k) => domainStr.includes(k));
          if (!hasGeoOverlap) return false;
        }

        return true;
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Per-case pool configuration
// ---------------------------------------------------------------------------

/**
 * Map each eval case ID to its synthetic app and builder pools.
 * The pools are designed to make the assertions meaningful:
 * - match_001: Lumen is in the app pool; the brief exactly matches Lumen.
 * - match_002: No app fits the music-brand brief; multiple creative builders fit.
 * - match_003: Exploratory budget; expensive builder must be filtered out.
 * - match_004: LATAM geo; US-only builder must be filtered out; LATAM builder included.
 * - match_005: Lumen is in existingStack; Lumen must NOT appear in ranked.
 */
function getPoolForCase(caseId: string): {
  apps: AppCandidate[];
  builders: BuilderCandidate[];
} {
  switch (caseId) {
    case 'match_001_obvious_app_exists':
      return {
        apps: [SYNTHETIC_APPS[0], SYNTHETIC_APPS[2], SYNTHETIC_APPS[3]], // Lumen, NoteFlow, EasyImport
        builders: [SYNTHETIC_BUILDERS[0], SYNTHETIC_BUILDERS[1]], // alice, bob
      };

    case 'match_002_no_app_fits':
      return {
        // All apps are poor matches for AI-powered music brand system
        apps: [SYNTHETIC_APPS[1], SYNTHETIC_APPS[2], SYNTHETIC_APPS[3]], // RouteMaster, NoteFlow, EasyImport — none fit
        builders: [SYNTHETIC_BUILDERS[0], SYNTHETIC_BUILDERS[1], SYNTHETIC_BUILDERS[2]], // alice, bob, carol — all creative/AI builders
      };

    case 'match_003_budget_filter':
      return {
        // Deliberately irrelevant apps (logistics, notes) — nothing near-matches the CSV brief,
        // so Phase A legitimately finds no strong match and the test exercises only the
        // rate-band builder filter. EasyImport is intentionally excluded here because its
        // description nearly verbatim-matches the brief and would score ≥75, defeating the
        // purpose of this case (which is to verify GT_10K builders are filtered out).
        apps: [SYNTHETIC_APPS[1], SYNTHETIC_APPS[2]], // RouteMaster, NoteFlow — neither matches a CSV-import brief
        builders: [SYNTHETIC_BUILDERS[5], SYNTHETIC_BUILDERS[6]], // builder-expensive (GT_10K), builder-csv (null rate band)
      };

    case 'match_004_geo_filter':
      return {
        apps: [SYNTHETIC_APPS[1], SYNTHETIC_APPS[2]], // RouteMaster (logistics), NoteFlow — RouteMaster is partial match
        builders: [SYNTHETIC_BUILDERS[3], SYNTHETIC_BUILDERS[4]], // builder-latam, builder-us-only
      };

    case 'match_005_seeker_existing_stack':
      return {
        // Lumen is in the pool but must be excluded by the existingStack filter before
        // it ever reaches the re-ranker. After exclusion only NoteFlow and EasyImport
        // remain — neither is a strong match for the API-testing brief, so hasStrongMatch
        // is false and phaseAOutcome = "should_skip_to_builders".
        apps: [SYNTHETIC_APPS[0], SYNTHETIC_APPS[2], SYNTHETIC_APPS[3]], // Lumen (excluded by existingStack), NoteFlow, EasyImport
        builders: [SYNTHETIC_BUILDERS[0], SYNTHETIC_BUILDERS[1]],
      };

    default:
      return { apps: SYNTHETIC_APPS, builders: SYNTHETIC_BUILDERS };
  }
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function checkPhaseAOutcome(
  outcome: 'should_surface_app' | 'should_skip_to_builders',
  hasStrongMatch: boolean,
): string[] {
  if (outcome === 'should_surface_app' && !hasStrongMatch) {
    return ['expected Phase A to surface a strong app match (score >= 75) but none found'];
  }
  if (outcome === 'should_skip_to_builders' && hasStrongMatch) {
    return ['expected Phase A to produce no strong app match but got one'];
  }
  return [];
}

function checkAppsAtLeastIncluded(
  rankedAppIds: string[],
  required: string[] | undefined,
): string[] {
  if (!required || required.length === 0) return [];
  const failures: string[] = [];
  const ranked = new Set(rankedAppIds);
  for (const id of required) {
    if (!ranked.has(id)) {
      failures.push(`app "${id}" expected in ranked Phase A results but not found`);
    }
  }
  return failures;
}

function checkAppsMustNotInclude(
  rankedAppIds: string[],
  forbidden: string[] | undefined,
): string[] {
  if (!forbidden || forbidden.length === 0) return [];
  const failures: string[] = [];
  const ranked = new Set(rankedAppIds);
  for (const id of forbidden) {
    if (ranked.has(id)) {
      failures.push(`app "${id}" must NOT appear in ranked Phase A results but was found`);
    }
  }
  return failures;
}

function checkBuildersAtLeastIncluded(
  rankedBuilderIds: string[],
  required: string[] | undefined,
): string[] {
  if (!required || required.length === 0) return [];
  const failures: string[] = [];
  const ranked = new Set(rankedBuilderIds);
  for (const id of required) {
    if (!ranked.has(id)) {
      failures.push(`builder "${id}" expected in ranked Phase B results but not found`);
    }
  }
  return failures;
}

function checkBuildersMustNotInclude(
  rankedBuilderIds: string[],
  forbidden: string[] | undefined,
): string[] {
  if (!forbidden || forbidden.length === 0) return [];
  const failures: string[] = [];
  const ranked = new Set(rankedBuilderIds);
  for (const id of forbidden) {
    if (ranked.has(id)) {
      failures.push(`builder "${id}" must NOT appear in ranked Phase B results but was found`);
    }
  }
  return failures;
}

function checkMaxBuilders(count: number, max: number | undefined): string[] {
  if (max === undefined) return [];
  if (count > max) {
    return [`ranked builders count ${count} exceeds maxBuildersReturned ${max}`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Run one eval case through Phase A + conditionally Phase B.
 * The retriever is the synthetic in-memory one (no DB calls).
 */
export async function runCase(anthropic: Anthropic, testCase: EvalCase): Promise<CaseResult> {
  const { apps: appPool, builders: builderPool } = getPoolForCase(testCase.id);
  const retriever = createSyntheticRetriever(appPool, builderPool);
  const brief = testCase.briefContent;
  const { expected } = testCase;

  // --- Phase A ---
  const phaseA = await runPhaseA({ anthropic, retriever, brief });
  const rankedAppIds = phaseA.ranked.map((s) => s.app.id);
  const hasStrongMatch = phaseA.hasStrongMatch;

  // --- Phase B (always run in eval to verify builder assertions) ---
  // For the eval we always run Phase B regardless of Phase A outcome — the
  // §3.2.2 conditional logic is tested in matching.test.ts (unit tests).
  // Here we want to validate builder ranking quality independently.
  const phaseB = await runPhaseB({ anthropic, retriever, brief });
  const rankedBuilderIds = phaseB.ranked.map((s) => s.builder.id);

  const failedAssertions: string[] = [
    ...checkPhaseAOutcome(expected.phaseAOutcome, hasStrongMatch),
    ...checkAppsAtLeastIncluded(rankedAppIds, expected.appsAtLeastIncluded),
    ...checkAppsMustNotInclude(rankedAppIds, expected.appsMustNotInclude),
    ...checkBuildersAtLeastIncluded(rankedBuilderIds, expected.buildersAtLeastIncluded),
    ...checkBuildersMustNotInclude(rankedBuilderIds, expected.buildersMustNotInclude),
    ...checkMaxBuilders(rankedBuilderIds.length, expected.maxBuildersReturned),
  ];

  return {
    id: testCase.id,
    passed: failedAssertions.length === 0,
    details: {
      phaseAHasStrongMatch: hasStrongMatch,
      rankedAppIds,
      rankedBuilderIds,
      phaseBRan: true,
      failedAssertions,
    },
  };
}

/**
 * Run all eval cases and return aggregate results.
 */
export async function runAll(
  anthropic: Anthropic,
): Promise<{ passRate: number; results: CaseResult[] }> {
  const typedCases = cases as EvalCase[];
  const results: CaseResult[] = [];

  for (const testCase of typedCases) {
    const result = await runCase(anthropic, testCase);
    results.push(result);
  }

  const passed = results.filter((r) => r.passed).length;
  const passRate = results.length > 0 ? passed / results.length : 0;

  return { passRate, results };
}
