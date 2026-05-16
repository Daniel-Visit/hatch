// Banner gradient presets — reused from prototype app-art (apps/web/app/_components/app-art.tsx).
// Each entry is a self-contained CSS background value. Keep the list short and
// hand-picked for visual variety; the user picks one and we store the raw CSS
// string in profiles.banner_gradient.

export interface BannerGradient {
  id: string;
  label: string;
  css: string;
}

export const BANNER_GRADIENTS: readonly BannerGradient[] = [
  {
    id: 'sunset',
    label: 'Sunset',
    css: 'linear-gradient(135deg,#ff7a59 0%,#fb7185 50%,#a21caf 100%)',
  },
  {
    id: 'amber',
    label: 'Amber',
    css: 'linear-gradient(135deg,#fef3c7 0%,#f59e0b 60%,#dc2626 100%)',
  },
  { id: 'sky', label: 'Sky', css: 'linear-gradient(180deg,#0ea5e9 0%,#67e8f9 100%)' },
  {
    id: 'orchid',
    label: 'Orchid',
    css: 'radial-gradient(circle at 50% 50%,#fbcfe8 0%,#ec4899 40%,#3b0764 100%)',
  },
  { id: 'ocean', label: 'Ocean', css: 'linear-gradient(160deg,#bae6fd 0%,#3b82f6 100%)' },
  {
    id: 'aurora',
    label: 'Aurora',
    css: 'linear-gradient(135deg,#581c87 0%,#a855f7 50%,#fde047 100%)',
  },
  { id: 'lemon', label: 'Lemon', css: 'linear-gradient(180deg,#fef9c3 0%,#facc15 100%)' },
  { id: 'blush', label: 'Blush', css: 'linear-gradient(135deg,#fecdd3 0%,#f43f5e 100%)' },
  {
    id: 'magma',
    label: 'Magma',
    css: 'linear-gradient(135deg,#3b0764 0%,#db2777 50%,#fb923c 100%)',
  },
  { id: 'midnight', label: 'Midnight', css: 'linear-gradient(180deg,#1e3a8a 0%,#60a5fa 100%)' },
  { id: 'forest', label: 'Forest', css: 'linear-gradient(135deg,#022c22 0%,#10b981 100%)' },
  { id: 'peach', label: 'Peach', css: 'linear-gradient(135deg,#fed7aa 0%,#fb923c 100%)' },
] as const;

export const GRADIENT_CSS_SET = new Set(BANNER_GRADIENTS.map((g) => g.css));

// Resolves the banner CSS to use: stored gradient if known, else hue-based fallback.
export function resolveBannerCss(stored: string | null, hue: number): string {
  if (stored && GRADIENT_CSS_SET.has(stored)) return stored;
  return `linear-gradient(135deg, oklch(72% 0.18 ${hue}), oklch(60% 0.22 ${(hue + 60) % 360}))`;
}
