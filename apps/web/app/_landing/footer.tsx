// Hatch landing footer — verbatim port of /tmp/hatch-landing-v2/src/sections-3.jsx Footer (lines 279-321).
// All hrefs are `"#"` per prototype. Keeps `.landing-footer` class on outer <footer> so
// the override CSS in landing.css applies. Year is dynamic. Server Component.

import { getTranslations } from 'next-intl/server';
import { Logo } from '@/app/_landing/logo';
import { GitHub } from '@/app/_landing/icons';

export const Footer = async () => {
  const t = await getTranslations('Landing.Footer');
  return (
    <footer className="landing-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <Logo />
            <p className="footer-tag">{t('Tagline')}</p>
          </div>
          <div className="footer-col">
            <h5>{t('Columns.Product.Title')}</h5>
            <ul>
              <li>
                <a href="#">{t('Columns.Product.Gallery')}</a>
              </li>
              <li>
                <a href="#">{t('Columns.Product.Publish')}</a>
              </li>
              <li>
                <a href="#">{t('Columns.Product.Categories')}</a>
              </li>
              <li>
                <a href="#">{t('Columns.Product.HotToday')}</a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>{t('Columns.Agents.Title')}</h5>
            <ul>
              <li>
                <a href="#">{t('Columns.Agents.McpServer')}</a>
              </li>
              <li>
                <a href="#">{t('Columns.Agents.ApiDocs')}</a>
              </li>
              <li>
                <a href="#">{t('Columns.Agents.OpenApi')}</a>
              </li>
              <li>
                <a href="#">{t('Columns.Agents.LlmsTxt')}</a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>{t('Columns.Company.Title')}</h5>
            <ul>
              <li>
                <a href="#">{t('Columns.Company.About')}</a>
              </li>
              <li>
                <a href="#">
                  <GitHub size={12} /> {t('Columns.Company.GitHub')}
                </a>
              </li>
              <li>
                <a href="#">{t('Columns.Company.Privacy')}</a>
              </li>
              <li>
                <a href="#">{t('Columns.Company.Terms')}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t('Copyright', { year: new Date().getFullYear() })}</span>
          <span className="mono">
            {t('Version')}{' '}
            <span className="live-dot" style={{ verticalAlign: 'middle', marginLeft: 4 }} />
          </span>
        </div>
      </div>
    </footer>
  );
};
