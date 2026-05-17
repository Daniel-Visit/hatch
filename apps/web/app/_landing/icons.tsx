// Hatch landing icons — verbatim port of /tmp/hatch-landing-v2/src/atoms.jsx (Icons object).
// Each icon is a named export so consumers can `import { Heart, Flame } from '@/app/_landing/icons'`.
// The shared <svg> wrapper from the prototype's Icon helper is kept local as `Icon`.

import type { ReactNode } from 'react';

type IconProps = { size?: number; stroke?: number };

type InnerIconProps = IconProps & {
  d: ReactNode;
  fill?: string;
};

const Icon = ({ d, size = 16, stroke = 1.6, fill = 'none' }: InnerIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

export const Heart = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    }
  />
);

export const HeartFill = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    fill="currentColor"
    d={
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    }
  />
);

export const Comment = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
    }
  />
);

export const Search = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    }
  />
);

export const Bell = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>
    }
  />
);

export const Arrow = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    }
  />
);

export const Sparkles = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    }
  />
);

export const Flame = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.4 0 2.5-1.1 2.5-2.5 0-1.5-1-2.5-2-3.5-.9-1-1-2-1-3 0-1.5 1-3 2.5-3 1 3-1 4 1 6 .5.5 1 1.5 1 3 0 2.5-2 5-5 5s-5-2.5-5-5c0-1.3.5-2.5 1.3-3.5" />
    }
  />
);

export const Sun = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    }
  />
);

export const Moon = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
  />
);

export const GitHub = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    }
  />
);

export const Check = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon size={size} stroke={stroke} d={<path d="m5 12 5 5L20 7" />} />
);

export const Bolt = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon size={size} stroke={stroke} d={<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />} />
);

export const Plus = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    }
  />
);

export const Diamond = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="M2.7 10.3 12 2l9.3 8.3L12 22 2.7 10.3z" />
      </>
    }
  />
);

export const Send = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4 20-7z" />
      </>
    }
  />
);

export const User = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
      </>
    }
  />
);

export const Globe = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    }
  />
);

export const Lock = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    }
  />
);

export const Mcp = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="M3 12h4l3-7 4 14 3-7h4" />
      </>
    }
  />
);

export const Terminal = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="m4 9 4 3-4 3M12 17h8" />
        <rect x="2" y="4" width="20" height="16" rx="2" />
      </>
    }
  />
);

export const Code = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
      </>
    }
  />
);

export const Clock = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    }
  />
);

export const Layers = ({ size = 16, stroke = 1.6 }: IconProps) => (
  <Icon
    size={size}
    stroke={stroke}
    d={
      <>
        <path d="m12 2 10 6-10 6L2 8l10-6z" />
        <path d="m2 14 10 6 10-6M2 11l10 6 10-6" />
      </>
    }
  />
);
