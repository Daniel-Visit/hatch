import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import { Topbar } from '../_landing/topbar';
import { Footer } from '../_landing/footer';
import '../landing.css';

import { getLocale } from 'next-intl/server';

export const metadata = {
  title: 'Commercial Agreement - Hatch',
};

export default async function CommercialAgreementPage() {
  const locale = await getLocale();
  const filename = locale === 'es' ? 'commercial-aggrement-es.md' : 'commercial-aggrement.md';
  const filePath = path.join(process.cwd(), 'content/legal', filename);
  const content = fs.readFileSync(filePath, 'utf-8');

  return (
    <div className="landing-root" style={{ background: 'var(--color-bg)' }}>
      <Topbar />
      <main
        className="container"
        style={{ paddingTop: 120, paddingBottom: 80, minHeight: '100vh' }}
      >
        <div className="legal-prose">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </main>
      <Footer />
    </div>
  );
}
