// Inline SVG icons — used wherever a unicode glyph looked off.
// Stroke-based, 1.6 width, currentColor, 16x16 viewBox.

import React from 'react';

const SVG_ICONS = {
  message: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  inbox: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  send: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2 7.5 8.5M14 2l-4.5 12-2-5.5-5.5-2L14 2Z" />
    </svg>
  ),
  plus: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 13.5s-5-3.1-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 6.5c0 3.9-5 7-5 7Z" />
    </svg>
  ),
  heartLine: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 13.5s-5-3.1-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 6.5c0 3.9-5 7-5 7Z" />
    </svg>
  ),
  comment: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8a5 5 0 1 1 2.4 4.3L2 13l.7-2.7A5 5 0 0 1 2.5 8Z" />
    </svg>
  ),
  share: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="8" r="2" />
      <circle cx="12" cy="3.5" r="2" />
      <circle cx="12" cy="12.5" r="2" />
      <path d="M6.7 7 10.3 4.5M6.7 9l3.6 2.5" />
    </svg>
  ),
  eye: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  externalArrow: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.5 10.5 11 5" />
      <path d="M5.5 5h5.5v5.5" />
    </svg>
  ),
  phone: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3.5c0 6 3.5 9.5 9.5 9.5l1-2.2-2.5-1.3-1 1A8 8 0 0 1 6.5 6.5l1-1L6.2 3l-2.2 1Z" />
    </svg>
  ),
  video: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="9" height="8" rx="1.2" />
      <path d="M11 6.5 14 5v6l-3-1.5z" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  ),
  search: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="m13.5 13.5-3-3" />
    </svg>
  ),
  arrowLeft: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 3.5 5 8l4.5 4.5M5 8h8" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3.5 8.5 3 3 6-6.5" />
    </svg>
  ),
  doubleCheck: (
    <svg
      viewBox="0 0 18 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 8.5 3 3 6-6.5" />
      <path d="m7 11.5 6-6.5" />
    </svg>
  ),
};

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: keyof typeof SVG_ICONS;
  size?: number;
}

function Icon({ name, size = 16, ...rest }: IconProps) {
  const svg = SVG_ICONS[name];
  if (!svg) return null;
  return React.cloneElement(svg, {
    width: size,
    height: size,
    ...rest,
    style: { display: 'inline-block', verticalAlign: '-2px', flexShrink: 0, ...rest.style },
  });
}

export { Icon, SVG_ICONS };
