// App preview art — abstract compositions per app, themed to its accent color.
// No icon drawings; just layered gradients, dots, and a glyph (the only "emoji"
// usage is a single hero glyph that doubles as the app's mascot — matches the
// Linear/Vercel sticker vibe). Each composition reads as a unique "thumbnail"
// without trying to fake an actual screenshot.

import React from 'react';

interface ArtEntry {
  glyph: string;
  bg: string;
  deco: React.ReactNode;
}

const ART: Record<string, ArtEntry> = {
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
  cursor: {
    glyph: '✦',
    bg: 'linear-gradient(135deg,#581c87 0%,#a855f7 50%,#fde047 100%)',
    deco: (
      <>
        <i className="art-trail" />
        <i
          className="art-dot"
          style={{ left: '74%', top: '32%', width: 22, height: 22, background: '#fef3c7' }}
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
    glyph: '🐌',
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

export interface AppArtProps {
  kind: string;
  accent: string;
  dense?: boolean;
  glyphSize?: number;
}

export function AppArt({ kind, accent: _accent, dense, glyphSize }: AppArtProps) {
  const a = ART[kind] || ART.pixel;
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
