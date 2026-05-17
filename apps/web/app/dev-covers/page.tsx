// Dev preview — renders all 20 AppArt cover kinds so we can pick which 3
// to feature in the landing ArtVis bento cell.
// Visit: http://localhost:3000/dev-covers

import { AppArt, ALL_COVER_KINDS } from '@/app/_components/app-art';

const ACCENT = '#a855f7'; // brand violet — stable accent so the procedural seed is deterministic

export default function CoversPreviewPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '40px 24px',
        background: '#0f0c08',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
          Cover preview — {ALL_COVER_KINDS.length} generative kinds
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
          Pick the 3 you want in the landing ArtVis bento cell. All rendered with accent ={' '}
          <code>{ACCENT}</code>.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {ALL_COVER_KINDS.map((kind, i) => (
            <div
              key={kind}
              style={{
                background: '#1a1610',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                <AppArt kind={kind} accent={ACCENT} seed={i + 3} />
              </div>
              <div
                style={{
                  padding: '10px 14px',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  fontSize: 13,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{kind}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>#{i + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
