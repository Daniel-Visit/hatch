// Hatch landing hero — verbatim port of /tmp/hatch-landing-v2/src/sections-1.jsx (Hero, lines 104-198).
// 3 floating cards are MOCK (Lumen.fm / Threadwise / Orbital CRM) with prototype's <Art/>.
// ONLY deviation: the hero-meta "<b>builders</b> builders shipping" and "<b>today</b> launched today"
// numbers come from real DB counts via the `counts` prop. Everything else byte-for-byte prototype.

import Link from 'next/link';
import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Art } from '@/app/_landing/art';
import { LandingAvatar } from '@/app/_landing/avatar';
import { FloatNotif } from '@/app/_landing/float-notif';
import { Arrow, HeartFill, Comment, Flame } from '@/app/_landing/icons';
import { builders } from './social-proof';

type HeroProps = {
  counts: { apps: number; builders: number; today: number };
};

export const Hero = async ({ counts }: HeroProps) => {
  const t = await getTranslations('Landing.Hero');
  return (
    <section className="hero">
      <div className="hero-grid" />
      <div className="hero-bg" />
      <div className="container hero-inner">
        <div>
          <span className="hero-badge">
            <span className="pill">{t('BadgePill')}</span>
            <span>{t('BadgeText')}</span>
          </span>
          <h1 className="hero-title">
            {t.rich('Headline', {
              grad: (chunks) => <span className="grad">{chunks}</span>,
            })}
          </h1>
          <p className="hero-sub">{t('Subhead')}</p>
          <div className="hero-cta-row">
            <Link href={'/sign-in' as Route} className="btn btn--primary btn--lg">
              {t('CtaStart')} <Arrow size={14} />
            </Link>
            <Link href={'/gallery' as Route} className="btn btn--lg">
              {t('CtaExplore')}
            </Link>
          </div>
          <div className="hero-meta">
            <div className="hero-meta-item">
              <span className="hero-meta-avatars">
                <LandingAvatar name="JD" hue={20} size={24} />
                <LandingAvatar name="ML" hue={290} size={24} />
                <LandingAvatar name="SR" hue={140} size={24} />
                <LandingAvatar name="AK" hue={210} size={24} />
              </span>
              <span>
                {t.rich('MetaBuilders', {
                  b: (chunks) => <b>{chunks}</b>,
                  count: counts.builders.toLocaleString(),
                })}
              </span>
            </div>
            <div className="hero-meta-item">
              <span className="live-dot" />
              <span>
                {t.rich('MetaToday', {
                  b: (chunks) => <b>{chunks}</b>,
                  count: counts.today,
                })}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: floating composition */}
        <div className="hero-stage" aria-hidden="true">
          <div className="float-card float-card--main">
            <div className="appcard-art" style={{ borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}>
              <Art kind={0} seed={3} />
            </div>
            <div className="appcard-body">
              <div className="appcard-head">
                <LandingAvatar name="LU" hue={20} />
                <div style={{ flex: 1 }}>
                  <div className="appcard-title">Lumen.fm</div>
                  <div className="appcard-byline">by alex.k</div>
                </div>
                <span className="appcard-cat">audio</span>
              </div>
              <p className="appcard-desc">
                Ambient soundscapes for deep work, generated on the fly.
              </p>
              <div className="appcard-foot">
                <div className="appcard-stats">
                  <span className="stat">
                    <HeartFill size={12} stroke={0} />
                    284
                  </span>
                  <span className="stat">
                    <Comment size={12} />
                    32
                  </span>
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ax)',
                  }}
                >
                  <Flame size={12} /> hot
                </span>
              </div>
            </div>
          </div>

          <div className="float-card float-card--left">
            <div
              className="appcard-art"
              style={{ aspectRatio: '16/9', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}
            >
              <Art kind={3} seed={5} />
            </div>
            <div className="appcard-body" style={{ padding: '10px 12px' }}>
              <div className="appcard-title" style={{ fontSize: 13 }}>
                Threadwise
              </div>
              <div className="appcard-byline">by sara.r</div>
            </div>
          </div>

          <div className="float-card float-card--right">
            <div
              className="appcard-art"
              style={{ aspectRatio: '16/9', borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }}
            >
              <Art kind={6} seed={7} />
            </div>
            <div className="appcard-body" style={{ padding: '10px 12px' }}>
              <div className="appcard-title" style={{ fontSize: 13 }}>
                Orbital CRM
              </div>
              <div className="appcard-byline">by m.chen</div>
            </div>
          </div>

          <FloatNotif />
        </div>
      </div>
    </section>
  );
};
