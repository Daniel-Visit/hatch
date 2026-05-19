// Hatch landing footer — verbatim port of /tmp/hatch-landing-v2/src/sections-3.jsx Footer (lines 279-321).
// Hrefs wired to real routes (gallery, trending, llms.txt, openapi.json, GitHub, Railway MCP).
// `About / Privacy / Terms` still `#` until those pages exist. Year is dynamic. Server Component.

import { getTranslations } from 'next-intl/server';
import { Logo } from '@/app/_landing/logo';
import { GitHub } from '@/app/_landing/icons';

const MCP_URL = 'https://hatch-mcp-production.up.railway.app';
const REPO_URL = 'https://github.com/Daniel-Visit/hatch';
const OPENAPI_URL = '/api/v1/openapi.json';
const LLMS_TXT_URL = '/llms.txt';

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
                <a href="/gallery">{t('Columns.Product.Gallery')}</a>
              </li>
              <li>
                <a href="/sign-in?next=/publish">{t('Columns.Product.Publish')}</a>
              </li>
              <li>
                <a href="/gallery">{t('Columns.Product.Categories')}</a>
              </li>
              <li>
                <a href="/trending">{t('Columns.Product.HotToday')}</a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>{t('Columns.Agents.Title')}</h5>
            <ul>
              <li>
                <a href={MCP_URL} target="_blank" rel="noopener noreferrer">
                  {t('Columns.Agents.McpServer')}
                </a>
              </li>
              <li>
                <a href={OPENAPI_URL} target="_blank" rel="noopener noreferrer">
                  {t('Columns.Agents.ApiDocs')}
                </a>
              </li>
              <li>
                <a href={OPENAPI_URL} target="_blank" rel="noopener noreferrer">
                  {t('Columns.Agents.OpenApi')}
                </a>
              </li>
              <li>
                <a href={LLMS_TXT_URL} target="_blank" rel="noopener noreferrer">
                  {t('Columns.Agents.LlmsTxt')}
                </a>
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
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
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
