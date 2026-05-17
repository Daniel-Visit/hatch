// Re-export of the canonical BrandLogo. The landing Topbar + Footer import
// `Logo` from this path; keeping a thin re-export means we don't have to touch
// their call sites while still routing through a single brand-mark component.
export { BrandLogo as Logo } from '@/app/_components/brand-logo';
