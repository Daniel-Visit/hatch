'use client';

import { AppArt } from '@/app/_components/app-art';
import { ART_KINDS, ACCENT_COLORS } from '@/lib/zod/publish';
import styles from './sign-in.module.css';

// 12 cards. The prototype's `snail` glyph is replaced with a custom one
// (sign-in screen only — does not touch the prototype-port-exception AppArt).
const CUSTOM_GLYPH = '🐝';
const PAIRS = ART_KINDS.map((kind, i) => ({
  kind,
  accent: ACCENT_COLORS[i % ACCENT_COLORS.length],
}));

export function SignInArt() {
  return (
    <div className={styles.grid} aria-hidden="true">
      {PAIRS.map(({ kind, accent }) =>
        kind === 'snail' ? (
          <div
            key={kind}
            className={styles.gridCard}
            style={{
              background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 60%, #000))`,
            }}
          >
            <div
              className={styles.customCard}
              style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))' }}
            >
              {CUSTOM_GLYPH}
            </div>
          </div>
        ) : (
          <div key={kind} className={styles.gridCard} style={{ ['--ax' as string]: accent }}>
            <AppArt kind={kind} accent={accent} glyphSize={56} />
          </div>
        ),
      )}
    </div>
  );
}
