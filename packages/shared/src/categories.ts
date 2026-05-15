// Phase 0 stub. Phase 1 (migration 0002_categories.sql) seeds the real list;
// this constant mirrors that seed for client-side use.
// See SPEC.md §4.2 for the canonical 8 categories.

export interface Category {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly sortOrder: number;
}

export const CATEGORIES: readonly Category[] = [];
