// Hatch landing footer — verbatim port of /tmp/hatch-landing-v2/src/sections-3.jsx Footer (lines 279-321).
// All hrefs are `"#"` per prototype. Keeps `.landing-footer` class on outer <footer> so
// the override CSS in landing.css applies. Year is dynamic. Server Component.

import { Logo } from '@/app/_landing/logo';
import { GitHub } from '@/app/_landing/icons';

export const Footer = () => (
  <footer className="landing-footer">
    <div className="container">
      <div className="footer-grid">
        <div className="footer-col">
          <Logo />
          <p className="footer-tag">
            Where builders ship, get discovered, and connect. Builder-centric, agent-native, made
            for shipping.
          </p>
        </div>
        <div className="footer-col">
          <h5>Product</h5>
          <ul>
            <li>
              <a href="#">Gallery</a>
            </li>
            <li>
              <a href="#">Publish</a>
            </li>
            <li>
              <a href="#">Categories</a>
            </li>
            <li>
              <a href="#">Hot today</a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h5>For agents</h5>
          <ul>
            <li>
              <a href="#">MCP server</a>
            </li>
            <li>
              <a href="#">API docs</a>
            </li>
            <li>
              <a href="#">OpenAPI</a>
            </li>
            <li>
              <a href="#">llms.txt</a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h5>Company</h5>
          <ul>
            <li>
              <a href="#">About</a>
            </li>
            <li>
              <a href="#">
                <GitHub size={12} /> GitHub
              </a>
            </li>
            <li>
              <a href="#">Privacy</a>
            </li>
            <li>
              <a href="#">Terms</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Hatch. Built by builders, for builders.</span>
        <span className="mono">
          v1.0.0 · all systems nominal{' '}
          <span className="live-dot" style={{ verticalAlign: 'middle', marginLeft: 4 }} />
        </span>
      </div>
    </div>
  </footer>
);
