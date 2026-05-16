import Link from 'next/link';

// Same brand mark as Shell's <Logo /> — kept inline so the (auth)/sign-in
// route does not depend on the Shell-port-exception component tree.
// Source: apps/web/app/_components/shell.tsx Logo()
export function HatchLogo() {
  return (
    <Link href="/" className="logo" style={{ borderRight: 0, padding: 0 }}>
      <span className="logo-mark">
        <i className="logo-mark-inner" />
      </span>
      <span className="logo-text">
        hatch
        <i className="logo-dot" />
      </span>
    </Link>
  );
}
