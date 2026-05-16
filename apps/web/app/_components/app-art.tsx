// App preview art — abstract compositions per app, themed to its accent color.
// Two families coexist:
//   Group A (emoji): a big mascot glyph over a gradient with decorative blobs.
//                    These are the originals from the prototype.
//   Group B (procedural): seeded SVG patterns, no glyph. Imported from the
//                         landing design (Hatch-landing.zip / atoms.jsx).
// Final set (20 cover kinds — picked 2026-05-16):
//   A: pixel, roast, palette, dj, letter, bingo, snail, karaoke, tinydraw, fog, pasta  (11)
//   B: mesh, bokeh, griddots, blocks, rings, glyph, softrings, coolstripes, coolbokeh   (9)
// Legacy `cursor` (dropped A6) silently falls back to `pixel`.

import React from 'react';

// ── seed helpers ──────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// 8 curated palettes; B-kinds pick one by seed.
const PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#f97316', '#ec4899', '#a855f7'],
  ['#22c55e', '#0ea5e9', '#a855f7'],
  ['#f59e0b', '#ef4444', '#ec4899'],
  ['#0ea5e9', '#8b5cf6', '#22c55e'],
  ['#ec4899', '#a855f7', '#3b82f6'],
  ['#f97316', '#f59e0b', '#ef4444'],
  ['#10b981', '#0ea5e9', '#6366f1'],
  ['#a855f7', '#ec4899', '#f97316'],
];

// ── Group A: emoji entries (legacy) ───────────────────────────────────────────

interface ArtEntry {
  glyph: string;
  bg: string;
  deco: React.ReactNode;
}

const A: Record<string, ArtEntry> = {
  pixel: {
    glyph: '🍣',
    bg: 'linear-gradient(135deg,#ff7a59 0%,#fb7185 50%,#a21caf 100%)',
    deco: (
      <>
        <i className="art-grid" style={{ opacity: 0.18 }} />
        <i className="art-dot" style={{ left: '18%', top: '24%', background: '#fef3c7' }} />
        <i className="art-dot" style={{ left: '72%', top: '38%', background: '#fcd34d' }} />
        <i className="art-dot" style={{ left: '42%', top: '78%', background: '#fef3c7' }} />
      </>
    ),
  },
  roast: {
    glyph: '🔥',
    bg: 'linear-gradient(135deg,#fef3c7 0%,#f59e0b 60%,#dc2626 100%)',
    deco: (
      <>
        <i className="art-blob" style={{ background: '#fde047', left: '-10%', top: '50%' }} />
        <i className="art-blob" style={{ background: '#f97316', right: '-15%', top: '-20%' }} />
      </>
    ),
  },
  palette: {
    glyph: '🪟',
    bg: 'linear-gradient(180deg,#0ea5e9 0%,#67e8f9 100%)',
    deco: (
      <>
        <i className="art-stripe" style={{ left: '8%', background: '#fef3c7' }} />
        <i className="art-stripe" style={{ left: '24%', background: '#f472b6' }} />
        <i className="art-stripe" style={{ left: '40%', background: '#a78bfa' }} />
        <i className="art-stripe" style={{ left: '56%', background: '#34d399' }} />
        <i className="art-stripe" style={{ left: '72%', background: '#fb923c' }} />
        <i className="art-stripe" style={{ left: '88%', background: '#fff' }} />
      </>
    ),
  },
  dj: {
    glyph: '🪩',
    bg: 'radial-gradient(circle at 50% 50%,#fbcfe8 0%,#ec4899 40%,#3b0764 100%)',
    deco: (
      <>
        <i className="art-ring" />
        <i className="art-ring" style={{ width: 220, height: 220, opacity: 0.3 }} />
        <i className="art-ring" style={{ width: 320, height: 320, opacity: 0.15 }} />
      </>
    ),
  },
  letter: {
    glyph: '✉',
    bg: 'linear-gradient(160deg,#bae6fd 0%,#3b82f6 100%)',
    deco: (
      <>
        <i
          className="art-card"
          style={{ transform: 'rotate(-6deg) translate(-20%,10%)', background: '#fff' }}
        />
        <i
          className="art-card"
          style={{ transform: 'rotate(4deg) translate(20%,-10%)', background: '#e0f2fe' }}
        />
      </>
    ),
  },
  bingo: {
    glyph: '◧',
    bg: 'linear-gradient(180deg,#fef9c3 0%,#facc15 100%)',
    deco: (
      <>
        <i className="art-grid5" />
      </>
    ),
  },
  snail: {
    glyph: '🐝',
    bg: 'linear-gradient(135deg,#fecdd3 0%,#f43f5e 100%)',
    deco: (
      <>
        <i
          className="art-blob"
          style={{ background: '#fff', opacity: 0.35, left: '60%', top: '40%' }}
        />
      </>
    ),
  },
  karaoke: {
    glyph: '🎤',
    bg: 'linear-gradient(135deg,#3b0764 0%,#db2777 50%,#fb923c 100%)',
    deco: (
      <>
        <i className="art-bar" style={{ left: '20%', height: '40%' }} />
        <i className="art-bar" style={{ left: '32%', height: '75%' }} />
        <i className="art-bar" style={{ left: '44%', height: '55%' }} />
        <i className="art-bar" style={{ left: '56%', height: '85%' }} />
        <i className="art-bar" style={{ left: '68%', height: '30%' }} />
      </>
    ),
  },
  tinydraw: {
    glyph: '◰',
    bg: 'linear-gradient(180deg,#1e3a8a 0%,#60a5fa 100%)',
    deco: (
      <>
        <i className="art-grid8" />
      </>
    ),
  },
  fog: {
    glyph: '◍',
    bg: 'linear-gradient(135deg,#022c22 0%,#10b981 100%)',
    deco: (
      <>
        <i className="art-blob" style={{ background: '#34d399', filter: 'blur(40px)' }} />
        <i
          className="art-dot"
          style={{
            left: '50%',
            top: '50%',
            width: 36,
            height: 36,
            background: '#fff',
            transform: 'translate(-50%,-50%)',
          }}
        />
      </>
    ),
  },
  pasta: {
    glyph: '🍝',
    bg: 'linear-gradient(135deg,#fed7aa 0%,#fb923c 100%)',
    deco: (
      <>
        <i className="art-blob" style={{ background: '#fde68a', left: '-10%', top: '-10%' }} />
      </>
    ),
  },
};

// Map legacy / dropped kinds onto an active one. Keeps old DB rows working.
const A_FALLBACKS: Record<string, string> = {
  cursor: 'pixel', // A6 dropped 2026-05-16
};

const B_KINDS = new Set([
  'mesh',
  'bokeh',
  'griddots',
  'blocks',
  'rings',
  'glyph',
  'softrings',
  'coolstripes',
  'coolbokeh',
]);

// ── Group B: procedural SVG renderers ─────────────────────────────────────────

interface BProps {
  seed: number;
}

function BMesh({ seed }: BProps) {
  const p = PALETTES[seed % PALETTES.length];
  const id = `mesh-${seed}`;
  return (
    <svg
      viewBox="0 0 200 130"
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <radialGradient id={`${id}a`} cx="20%" cy="20%">
          <stop offset="0%" stopColor={p[0]} stopOpacity="0.9" />
          <stop offset="100%" stopColor={p[0]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}b`} cx="80%" cy="40%">
          <stop offset="0%" stopColor={p[1]} stopOpacity="0.9" />
          <stop offset="100%" stopColor={p[1]} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}c`} cx="50%" cy="90%">
          <stop offset="0%" stopColor={p[2]} stopOpacity="0.9" />
          <stop offset="100%" stopColor={p[2]} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="200" height="130" fill={p[2]} opacity="0.18" />
      <rect width="200" height="130" fill={`url(#${id}a)`} />
      <rect width="200" height="130" fill={`url(#${id}b)`} />
      <rect width="200" height="130" fill={`url(#${id}c)`} />
    </svg>
  );
}

function BBokeh({ seed }: BProps) {
  const p = PALETTES[seed % PALETTES.length];
  const rand = seededRand(seed * 17 + 1);
  const shapes = Array.from({ length: 8 }, (_, i) => ({
    x: rand() * 200,
    y: rand() * 130,
    r: 16 + rand() * 42,
    c: p[i % 3],
    op: 0.55 + rand() * 0.4,
  }));
  return (
    <svg viewBox="0 0 200 130" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="200" height="130" fill="#0f0c08" />
      {shapes.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={s.c}
          opacity={s.op}
          style={{ mixBlendMode: 'screen' }}
        />
      ))}
    </svg>
  );
}

function BGridDots({ seed }: BProps) {
  const p = PALETTES[seed % PALETTES.length];
  const cells = [];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 11; x++) {
      const d = Math.hypot(x - 5, y - 3);
      cells.push({
        x: x * 20 + 10,
        y: y * 20 + 5,
        r: 1.5 + (1 - d / 8) * 4,
        c: p[(x + y) % 3],
      });
    }
  }
  return (
    <svg viewBox="0 0 220 145" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="220" height="145" fill={p[2]} opacity="0.08" />
      {cells.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={c.c} />
      ))}
    </svg>
  );
}

function BBlocks({ seed }: BProps) {
  const p = PALETTES[seed % PALETTES.length];
  const rand = seededRand(seed * 17 + 5);
  const cells: { x: number; y: number; c: string; op: number }[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 10; x++) {
      if (rand() > 0.45) {
        cells.push({
          x: x * 20,
          y: y * 22,
          c: p[Math.floor(rand() * 3)],
          op: 0.4 + rand() * 0.5,
        });
      }
    }
  }
  return (
    <svg
      viewBox="0 0 200 130"
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <rect width="200" height="130" fill="#0a0a0c" />
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width="18" height="20" fill={c.c} opacity={c.op} rx="2" />
      ))}
    </svg>
  );
}

function BRings({ seed }: BProps) {
  const p = PALETTES[seed % PALETTES.length];
  return (
    <svg viewBox="0 0 200 130" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="200" height="130" fill={p[2]} opacity="0.12" />
      {[40, 55, 70, 85, 100].map((r, i) => (
        <circle
          key={i}
          cx="100"
          cy="65"
          r={r}
          fill="none"
          stroke={p[i % 3]}
          strokeWidth="2"
          opacity={0.85 - i * 0.12}
        />
      ))}
      <circle cx="100" cy="65" r="14" fill={p[0]} />
    </svg>
  );
}

function BGlyph({ seed }: BProps) {
  const p = PALETTES[seed % PALETTES.length];
  const glyphs = ['◆', '◇', '▲', '●', '◐', '✦', '◈', '▼'];
  const g = glyphs[seed % glyphs.length];
  const id = `gly-${seed}`;
  return (
    <svg viewBox="0 0 200 130" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={p[0]} />
          <stop offset="100%" stopColor={p[2]} />
        </linearGradient>
      </defs>
      <rect width="200" height="130" fill="#0f0c08" />
      <text
        x="100"
        y="95"
        fontSize="100"
        fontFamily="Geist Mono, ui-monospace, monospace"
        textAnchor="middle"
        fill={`url(#${id})`}
      >
        {g}
      </text>
    </svg>
  );
}

function BSoftRings({ seed }: BProps) {
  void seed; // Palette is intentionally fixed so this cover reads consistently across apps.
  const ringColors = ['#f472b6', '#fb923c', '#fbbf24', '#f472b6', '#fb923c', '#fbbf24', '#f472b6'];
  const radii = [22, 36, 50, 64, 78, 92, 106];
  return (
    <svg viewBox="0 0 200 130" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="200" height="130" fill="#fde8e0" />
      {radii.map((r, i) => (
        <circle
          key={i}
          cx="100"
          cy="65"
          r={r}
          fill="none"
          stroke={ringColors[i]}
          strokeWidth="1.4"
          opacity="0.85"
        />
      ))}
      <circle cx="100" cy="65" r="11" fill="#fb923c" />
    </svg>
  );
}

function BCoolStripes({ seed }: BProps) {
  // Cool gradient base (pink→violet→blue) + diagonal bands.
  const colors = [
    '#ec4899',
    '#d946ef',
    '#a855f7',
    '#8b5cf6',
    '#7c3aed',
    '#6366f1',
    '#3b82f6',
    '#60a5fa',
    '#ec4899',
  ];
  const id = `cs-${seed}`;
  return (
    <svg
      viewBox="0 0 200 130"
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect width="200" height="130" fill={`url(#${id})`} />
      {colors.map((c, i) => (
        <rect
          key={i}
          x={-40 + i * 32}
          y={-30}
          width={32}
          height={200}
          fill={c}
          opacity="0.30"
          transform="rotate(22 100 65)"
        />
      ))}
    </svg>
  );
}

function BCoolBokeh({ seed }: BProps) {
  // Same composition as BBokeh but cool palette (greens/blues/teals).
  const cools = ['#22c55e', '#10b981', '#0ea5e9', '#3b82f6', '#06b6d4', '#14b8a6'];
  const rand = seededRand(seed * 17 + 11);
  const shapes = Array.from({ length: 7 }, (_, i) => ({
    x: rand() * 200,
    y: rand() * 130,
    r: 22 + rand() * 44,
    c: cools[i % cools.length],
    op: 0.5 + rand() * 0.4,
  }));
  return (
    <svg viewBox="0 0 200 130" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="200" height="130" fill="#0a0a0c" />
      {shapes.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={s.c}
          opacity={s.op}
          style={{ mixBlendMode: 'screen' }}
        />
      ))}
    </svg>
  );
}

const B_RENDERERS: Record<string, React.FC<BProps>> = {
  mesh: BMesh,
  bokeh: BBokeh,
  griddots: BGridDots,
  blocks: BBlocks,
  rings: BRings,
  glyph: BGlyph,
  softrings: BSoftRings,
  coolstripes: BCoolStripes,
  coolbokeh: BCoolBokeh,
};

// ── Public API ────────────────────────────────────────────────────────────────

export interface AppArtProps {
  kind: string;
  accent: string;
  dense?: boolean;
  glyphSize?: number;
  /** Optional override; defaults to a hash of `accent` so each app's color drives variation. */
  seed?: number;
}

export function AppArt({ kind, accent, dense, glyphSize, seed }: AppArtProps) {
  const resolvedKind = A_FALLBACKS[kind] ?? kind;
  const computedSeed = seed ?? hashStr(accent || resolvedKind);

  if (B_KINDS.has(resolvedKind)) {
    const Renderer = B_RENDERERS[resolvedKind];
    return (
      <div className="app-art" style={{ background: '#0a0a0c' }}>
        <Renderer seed={computedSeed} />
      </div>
    );
  }

  const a = A[resolvedKind] ?? A.pixel;
  return (
    <div className="app-art" style={{ background: a.bg }}>
      {a.deco}
      <div className="art-glyph" style={{ fontSize: glyphSize || (dense ? 56 : 78) }}>
        {a.glyph}
      </div>
      <i className="art-noise" />
    </div>
  );
}

export default AppArt;

/** Every cover kind currently selectable, in stable display order. */
export const ALL_COVER_KINDS: ReadonlyArray<string> = [
  'pixel',
  'roast',
  'palette',
  'dj',
  'letter',
  'bingo',
  'snail',
  'karaoke',
  'tinydraw',
  'fog',
  'pasta',
  'mesh',
  'bokeh',
  'griddots',
  'blocks',
  'rings',
  'glyph',
  'softrings',
  'coolstripes',
  'coolbokeh',
];
