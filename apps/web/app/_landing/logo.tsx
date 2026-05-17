// Hatch logo — verbatim port of /tmp/hatch-landing-v2/src/atoms.jsx Logo (line 43).
// All styling (gradient mark, inner diamond via ::after, trailing accent dot via .logo-text::after)
// comes from the prototype's components.css rules already in landing.css.

export const Logo = () => (
  <span className="logo" aria-label="Hatch">
    <span className="logo-mark" />
    <span className="logo-text">hatch</span>
  </span>
);
