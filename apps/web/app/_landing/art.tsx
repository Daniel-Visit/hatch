// Hatch landing procedural art — verbatim port of /tmp/hatch-landing-v2/src/atoms.jsx (Art, lines 54-191).
// 8 generative SVG styles (kind 0-7) with seeded randomness. Server Component.

type ArtProps = { kind?: number; seed?: number; palette?: string[][] };

type Shape = { x: number; y: number; r: number; c: string; op: number };
type Cell = { x: number; y: number; r: number; c: string };
type Block = { x: number; y: number; c: string; op: number };

const seededRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

export const Art = ({ kind = 0, seed = 1, palette }: ArtProps) => {
  const pals = palette || [
    ['#f97316', '#ec4899', '#a855f7'],
    ['#22c55e', '#0ea5e9', '#a855f7'],
    ['#f59e0b', '#ef4444', '#ec4899'],
    ['#0ea5e9', '#8b5cf6', '#22c55e'],
    ['#ec4899', '#a855f7', '#3b82f6'],
    ['#f97316', '#f59e0b', '#ef4444'],
    ['#10b981', '#0ea5e9', '#6366f1'],
    ['#a855f7', '#ec4899', '#f97316'],
  ];
  const p = pals[seed % pals.length];
  const rand = seededRand(seed * 17 + kind);

  switch (kind % 12) {
    case 0: // Gradient mesh
      return (
        <svg
          viewBox="0 0 200 130"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <radialGradient id={`g${seed}a`} cx="20%" cy="20%">
              <stop offset="0%" stopColor={p[0]} stopOpacity="0.9" />
              <stop offset="100%" stopColor={p[0]} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`g${seed}b`} cx="80%" cy="40%">
              <stop offset="0%" stopColor={p[1]} stopOpacity="0.9" />
              <stop offset="100%" stopColor={p[1]} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`g${seed}c`} cx="50%" cy="90%">
              <stop offset="0%" stopColor={p[2]} stopOpacity="0.9" />
              <stop offset="100%" stopColor={p[2]} stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="200" height="130" fill={p[2]} opacity="0.18" />
          <rect width="200" height="130" fill={`url(#g${seed}a)`} />
          <rect width="200" height="130" fill={`url(#g${seed}b)`} />
          <rect width="200" height="130" fill={`url(#g${seed}c)`} />
        </svg>
      );
    case 1: {
      // Geometric shapes
      const shapes: Shape[] = Array.from({ length: 8 }, (_, i) => ({
        x: rand() * 200,
        y: rand() * 130,
        r: 16 + rand() * 42,
        c: p[i % 3],
        op: 0.55 + rand() * 0.4,
      }));
      return (
        <svg
          viewBox="0 0 200 130"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <rect x="-200" y="-200" width="600" height="530" fill="#0f0c08" />
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
    case 2: {
      // Grid dots
      const cells: Cell[] = [];
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 11; x++) {
          const d = Math.hypot(x - 5, y - 3);
          cells.push({
            x: x * 20 + 10,
            y: y * 20 + 5,
            r: 1.5 + (1 - d / 8) * 4,
            c: p[(x + y) % 3],
          });
        }
      return (
        <svg
          viewBox="0 0 220 145"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <rect x="-200" y="-200" width="620" height="545" fill={p[2]} opacity="0.08" />
          {cells.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={c.c} />
          ))}
        </svg>
      );
    }
    case 3: {
      // Diagonal stripes
      return (
        <svg
          viewBox="0 0 200 130"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id={`s${seed}`} x1="0" x2="1">
              <stop offset="0%" stopColor={p[0]} />
              <stop offset="50%" stopColor={p[1]} />
              <stop offset="100%" stopColor={p[2]} />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill={`url(#s${seed})`} opacity="0.85" />
          {Array.from({ length: 6 }).map((_, i) => (
            <rect
              key={i}
              x={-50 + i * 45}
              y="-20"
              width="20"
              height="200"
              fill="#fff"
              opacity="0.08"
              transform="rotate(20 100 65)"
            />
          ))}
        </svg>
      );
    }
    case 4: {
      // Waveform
      let pathD = 'M0,80 ';
      for (let x = 0; x <= 200; x += 10) {
        const y = 65 + Math.sin(x / 14 + seed) * 22 + Math.cos(x / 24) * 8;
        pathD += `L${x},${y} `;
      }
      pathD += 'L200,130 L0,130 Z';
      return (
        <svg
          viewBox="0 0 200 130"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id={`w${seed}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={p[0]} />
              <stop offset="100%" stopColor={p[2]} />
            </linearGradient>
          </defs>
          <rect x="-200" y="-200" width="600" height="530" fill={p[1]} opacity="0.15" />
          <path d={pathD} fill={`url(#w${seed})`} opacity="0.85" />
          <path
            d={pathD.replace(/M0,80/, 'M0,90').replace('L200,130 L0,130 Z', '')}
            stroke={p[0]}
            strokeWidth="1.5"
            fill="none"
            opacity="0.6"
          />
        </svg>
      );
    }
    case 5: {
      // ASCII-ish blocks
      const cells: Block[] = [];
      for (let y = 0; y < 6; y++)
        for (let x = 0; x < 10; x++) {
          if (rand() > 0.45)
            cells.push({
              x: x * 20,
              y: y * 22,
              c: p[Math.floor(rand() * 3)],
              op: 0.4 + rand() * 0.5,
            });
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
    case 6: {
      // Rings
      return (
        <svg
          viewBox="0 0 200 130"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <rect x="-200" y="-200" width="600" height="530" fill={p[2]} opacity="0.12" />
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
    case 7: {
      // Glyph
      const glyphs = ['◆', '◇', '▲', '●', '◐', '✦', '◈', '▼'];
      const g = glyphs[seed % glyphs.length];
      return (
        <svg
          viewBox="0 0 200 130"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id={`gly${seed}`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor={p[0]} />
              <stop offset="100%" stopColor={p[2]} />
            </linearGradient>
          </defs>
          <rect x="-200" y="-200" width="600" height="530" fill="#0f0c08" />
          <text
            x="100"
            y="95"
            fontSize="100"
            fontFamily="Geist Mono, monospace"
            textAnchor="middle"
            fill={`url(#gly${seed})`}
          >
            {g}
          </text>
        </svg>
      );
    }
    default:
      return <Art kind={(kind + 1) % 12} seed={seed + 1} palette={palette} />;
  }
};
