// Hatch landing — How it works.
// Verbatim port of /tmp/hatch-landing-v2/src/sections-2.jsx HowItWorks (lines 232-260).

import type { ReactNode } from 'react';

import { Flame, GitHub, Plus, Send } from '@/app/_landing/icons';

type Step = { ico: ReactNode; n: string; t: string; d: string };

const steps: Step[] = [
  {
    ico: <GitHub size={18} />,
    n: '01',
    t: 'Sign in',
    d: 'GitHub or Google — no waitlist, no email verification roundtrips.',
  },
  {
    ico: <Plus size={18} />,
    n: '02',
    t: 'Publish',
    d: 'Fill three fields, pick a vibe. We generate the cover art for you.',
  },
  {
    ico: <Flame size={18} />,
    n: '03',
    t: 'Get discovered',
    d: 'Hot ranking, search, and categories surface your project to the right people.',
  },
  {
    ico: <Send size={18} />,
    n: '04',
    t: 'Connect',
    d: 'Contact requests, then real messaging — Slack-style threads built in.',
  },
];

export const HowItWorks = () => (
  <section id="how" className="sect">
    <div className="container">
      <div className="section-head">
        <span className="section-eyebrow">
          <span className="dot" />
          how it works
        </span>
        <h2 className="section-title">Four steps from idea to inbox</h2>
        <p className="section-sub">
          A path so short you&apos;ll spend more time building than launching.
        </p>
      </div>
      <div className="steps">
        {steps.map((s) => (
          <div className="card step" key={s.n}>
            <div className="step-icon">{s.ico}</div>
            <div className="step-num">STEP {s.n}</div>
            <h4>{s.t}</h4>
            <p>{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
