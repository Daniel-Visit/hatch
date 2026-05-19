// Root / — public landing for anonymous visitors. Verbatim port of the
// Hatch-landing-v2 prototype EXCEPT: hero meta + SocialProof stats are real
// DB counts, and GalleryPreview tabs render real published apps.
// Signed-in users are redirected to /gallery.

import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { fetchLandingData } from './_landing/data';

import { Topbar } from './_landing/topbar';
import { Hero } from './_landing/hero';
import { SocialProof } from './_landing/social-proof';
import { Bento } from './_landing/bento';
import { HowItWorks } from './_landing/how-it-works';
import { ForInvestors } from './_landing/for-investors';
import { Agents } from './_landing/agents';
import { GalleryPreview } from './_landing/gallery-preview';
import { Testimonials } from './_landing/testimonials';
import { FinalCta } from './_landing/final-cta';
import { Footer } from './_landing/footer';

import './landing.css';

// ISR: cache the rendered landing for 60 seconds. Anonymous traffic dominates
// here, and a 60-second lag on counters / gallery rows is acceptable for a marketing page.
// DO NOT also set `dynamic = 'force-dynamic'` — they are mutually exclusive.

export const revalidate = 60;

export default async function LandingPage() {
  const u = await getUser();
  if (u) redirect('/gallery');

  const { counts, tabs } = await fetchLandingData();

  return (
    <div className="landing-root">
      <Topbar />
      <section className="snap-section" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 30}}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          <Hero counts={{ apps: counts.apps, builders: counts.builders, today: counts.today }} />
        </div>
        <SocialProof
          counts={{ builders: counts.builders, apps: counts.apps, connections: counts.connections }}
        />
      </section>
      
      <Bento />
      <HowItWorks />
      <ForInvestors />
      <Agents />
      <GalleryPreview tabs={tabs} />
      <Testimonials />
      <FinalCta />
      <Footer />
    </div>
  );
}
