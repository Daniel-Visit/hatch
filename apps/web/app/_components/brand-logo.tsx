// Canonical Hatch brand logo — wraps `/public/logo.svg` (the full mark: gradient
// square + white rotated diamond + "hatch" wordmark + orange dot) in a Next/Image
// inside a Next/Link. All three legacy logo implementations (Shell's `Logo()`,
// the sign-in `HatchLogo`, and the landing `Logo`) re-export this so the brand
// mark stays in sync everywhere.
//
// Default width 92px renders ~34px tall keeping the source 253:94 aspect ratio,
// which matches the height of the previous CSS-generated marks in the topbar.
//
// Theme-aware: renders both light and dark variants; visibility is toggled
// purely by CSS based on the `[data-theme="dark"]` attribute on <html> (set
// by the anti-flash boot script + ThemeController). No JS needed — no flash
// of wrong logo during hydration. See `prototype-base.css` for the rules.

import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';

type BrandLogoProps = {
  href?: Route | string;
  width?: number;
  className?: string;
};

export function BrandLogo({ href = '/', width = 92, className }: BrandLogoProps) {
  const height = Math.round((width * 94) / 253);
  return (
    <Link
      href={href as Route}
      aria-label="Hatch"
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      <Image
        src="/logo.svg"
        alt="Hatch"
        width={width}
        height={height}
        priority
        className="brand-logo-light"
      />
      <Image
        src="/logo_dark.svg"
        alt=""
        width={width}
        height={height}
        priority
        className="brand-logo-dark"
        aria-hidden="true"
      />
    </Link>
  );
}
