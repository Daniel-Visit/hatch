// Hatch landing final-cta — verbatim port of /tmp/hatch-landing-v2/src/sections-3.jsx
// (FinalCta, lines 258-274). CTA anchors converted to Next Link targeting /sign-in and /gallery.

import Link from 'next/link';
import type { Route } from 'next';
import { Arrow } from '@/app/_landing/icons';

export const FinalCta = () => (
  <section className="final-cta">
    <div className="final-cta-bg" />
    <div className="container">
      <span className="section-eyebrow">
        <span className="dot" />
        ship something
      </span>
      <h2>
        Your project
        <br />
        deserves to be <span className="grad">seen</span>.
      </h2>
      <p>Sixty seconds from idea to live page. Free forever for builders.</p>
      <div className="hero-cta-row">
        <Link href={'/sign-in' as Route} className="btn btn--primary btn--lg">
          Start building <Arrow size={14} />
        </Link>
        <Link href={'/gallery' as Route} className="btn btn--lg">
          Explore the gallery first
        </Link>
      </div>
    </div>
  </section>
);
