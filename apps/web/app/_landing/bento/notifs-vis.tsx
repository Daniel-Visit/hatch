// Hatch landing — NotifsVis bento cell.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx NotifsVis (lines 92-131).
// Decorative; Server Component, no props, no state.

import { LandingAvatar } from '@/app/_landing/avatar';
import { Comment, HeartFill } from '@/app/_landing/icons';

export const NotifsVis = () => (
  <div
    className="bento-vis"
    style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      margin: '8px 0 0px',
      paddingTop: 0,
      minHeight: 200,
      maxHeight: 230,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--sh-2)',
        width: '88%',
        margin: 0,
        transform: 'scale(0.82)',
        transformOrigin: 'bottom center',
      }}
    >
      <div className="notif-head">
        <span className="ttl">Notifications</span>
        <span className="ct">3</span>
      </div>
      <div className="notif">
        <LandingAvatar name="MR" hue={290} size={24} />
        <div className="body">
          <b>maria.r</b> liked your project
          <br />
          <span style={{ color: 'var(--muted)' }}>Lumen.fm · 2m</span>
        </div>
        <HeartFill size={12} stroke={0} />
      </div>
      <div className="notif">
        <LandingAvatar name="JL" hue={140} size={24} />
        <div className="body">
          <b>j.lee</b> wants to invest
          <br />
          <span style={{ color: 'var(--muted)' }}>3 minutes ago</span>
        </div>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ax)' }}>
          NEW
        </span>
      </div>
      <div className="notif">
        <LandingAvatar name="SO" hue={20} size={24} />
        <div className="body">
          <b>s.okoye</b> commented
          <br />
          <span style={{ color: 'var(--muted)' }}>&quot;This is sick. How did you…&quot;</span>
        </div>
        <Comment size={12} />
      </div>
    </div>
  </div>
);
