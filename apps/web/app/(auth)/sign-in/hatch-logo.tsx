// Re-export of the canonical BrandLogo. The /sign-in page imports `HatchLogo`
// from this path; keeping a thin re-export means we don't have to touch its
// call sites while still routing through a single brand-mark component.
export { BrandLogo as HatchLogo } from '@/app/_components/brand-logo';
