// Hatch landing testimonials — verbatim port of /tmp/hatch-landing-v2/src/sections-3.jsx
// (Testimonials, lines 211-253). The 3 mock quotes are intentional copy placeholders.

import { LandingAvatar } from '@/app/_landing/avatar';
import { Diamond } from '@/app/_landing/icons';

const quotes = [
  {
    q: "I'd been sitting on a side-project for 8 months waiting for it to be 'ready.' Published it on Hatch in 40 minutes. Three angels reached out the same week.",
    n: 'Alex K.',
    r: 'founder, Lumen.fm',
    hue: 20,
    av: 'AK',
  },
  {
    q: "It's the first builder community where I can actually find pre-seed deal-flow without spamming Twitter DMs. Hatch's intent labels saved my entire workflow.",
    n: 'J. Lee',
    r: 'partner, signal capital',
    hue: 280,
    av: 'JL',
  },
  {
    q: 'Wiring my agent into Hatch took 30 seconds. It now publishes my changelog entries, replies to comments, and routes contact requests. Real magic.',
    n: 'M. Chen',
    r: 'maker, Orbital CRM',
    hue: 210,
    av: 'MC',
  },
];

export const Testimonials = () => (
  <section className="sect">
    <div className="container">
      <div className="section-head">
        <span className="section-eyebrow">
          <span className="dot" />
          signal
        </span>
        <h2 className="section-title">From builders &amp; backers</h2>
        <p className="section-sub">Early users from both sides of the table.</p>
      </div>
      <div className="tests">
        {quotes.map((q, i) => (
          <div className="card test" key={i}>
            <Diamond size={20} />
            <p className="test-quote">&quot;{q.q}&quot;</p>
            <div className="test-author">
              <LandingAvatar name={q.av} hue={q.hue} />
              <div className="meta">
                <div className="n">{q.n}</div>
                <div className="r">{q.r}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
