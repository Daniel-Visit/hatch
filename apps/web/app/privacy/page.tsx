import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import { Topbar } from '../_landing/topbar';
import { Footer } from '../_landing/footer';
import '../landing.css';

import { getLocale } from 'next-intl/server';

export const metadata = {
  title: 'Privacy Policy - Hatch',
};

export default async function PrivacyPage() {
  const locale = await getLocale();
  const filename = locale === 'es' ? 'privacy-es.md' : 'privacy.md';
  let content = 'Privacy Policy content not found.';
  try {
    const filePath = path.join(process.cwd(), '../../', filename);
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    try {
      const fallbackPath = path.join(process.cwd(), filename);
      content = fs.readFileSync(fallbackPath, 'utf-8');
    } catch (e2) {
      console.error(e2);
    }
  }

  return (
    <div className="landing-root" style={{ background: 'var(--color-bg)' }}>
      <Topbar />
      <main className="container" style={{ paddingTop: 120, paddingBottom: 80, minHeight: '100vh' }}>
        <div className="legal-prose">
          <ReactMarkdown>
            {content}
          </ReactMarkdown>
        </div>
      </main>
      <Footer />
    </div>
  );
}
