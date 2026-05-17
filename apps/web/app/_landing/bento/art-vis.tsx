// Hatch landing — ArtVis bento cell.
// 3 hand-picked covers (softrings / coolstripes / coolbokeh) rendered as
// dev-covers-style cards (cover + label + index) on the b-art dark background.
// Middle card rotated slightly. Positioned so the full cards are visible (no
// negative margin that would crop them at the bottom of the bento cell).

import { AppArt } from '@/app/_components/app-art';

type Item = { kind: string; index: number };
const ITEMS: readonly Item[] = [
  { kind: 'softrings', index: 18 },
  { kind: 'coolstripes', index: 19 },
  { kind: 'coolbokeh', index: 20 },
];

const ACCENT = '#a855f7';

const cardStyle: React.CSSProperties = {
  background: '#1a1610',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const labelStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 13,
  color: '#fff',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

export const ArtVis = () => (
  <div
    className="bento-vis"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '8px 0 12px',
      padding: '0 8px',
    }}
  >
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        width: '100%',
      }}
    >
      {ITEMS.map((item, i) => (
        <div
          key={item.kind}
          style={{
            ...cardStyle,
            ...(i === 0
              ? {
                  transform: 'rotate(-3deg)',
                  boxShadow: '0 10px 28px -8px rgba(0,0,0,0.55)',
                }
              : i === 1
                ? {
                    transform: 'rotate(-2deg)',
                    boxShadow: '0 12px 32px -8px rgba(0,0,0,0.6)',
                    zIndex: 1,
                  }
                : {
                    transform: 'rotate(4deg)',
                    boxShadow: '0 10px 28px -8px rgba(0,0,0,0.55)',
                  }),
          }}
        >
          <div style={{ aspectRatio: '16 / 10', overflow: 'hidden' }}>
            <AppArt kind={item.kind} accent={ACCENT} seed={item.index} />
          </div>
          <div style={labelStyle}>
            <span>{item.kind}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>#{item.index}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);
