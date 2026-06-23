// MatchBanner — "This might already exist…" or "custom build" banner.
//
// Verbatim port of the .match-banner block from mockups.html #matches.
// CSS in apps/web/app/styles/wanted.css: .match-banner / -glyph / -text.

type MatchBannerProps = {
  title: string;
  body: string;
};

export function MatchBanner({ title, body }: MatchBannerProps) {
  return (
    <div className="match-banner">
      <div className="match-banner-glyph">✨</div>
      <div className="match-banner-text">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </div>
  );
}
