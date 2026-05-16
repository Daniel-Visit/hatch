export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Pass-through wrapper. Each page in (auth) owns its own width/centering.
  // /sign-in uses a full-bleed split layout; /publish wraps itself in the
  // prototype's centered container.
  return <>{children}</>;
}
