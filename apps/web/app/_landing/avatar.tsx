// Hatch landing avatar — verbatim port of /tmp/hatch-landing-v2/src/sections-1.jsx Avatar.
// Renamed to LandingAvatar to avoid collision with apps/web/app/_components/cards.tsx Avatar.

type LandingAvatarProps = { name: string; hue?: number; size?: number };

export const LandingAvatar = ({ name, hue = 280, size = 28 }: LandingAvatarProps) => {
  const bg = `linear-gradient(135deg, hsl(${hue},70%,60%), hsl(${(hue + 50) % 360},75%,55%))`;
  return (
    <span
      className="avatar"
      style={{ background: bg, width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
};
