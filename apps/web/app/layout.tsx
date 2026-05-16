import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';
import { ThemeController, themeBootScript } from './_components/theme-controller';
import { fontVariables } from './_components/fonts';
import { NotificationToaster } from './_components/notification-toast';
import { ServiceWorkerRegistrar } from './_components/service-worker-registrar';

import './globals.css';
import './styles/prototype-base.css';
import './styles/prototype-cards.css';
import './styles/prototype-screens.css';
import './styles/prototype-contact.css';
import './styles/phase6.css';

export const metadata: Metadata = {
  title: 'Hatch',
  description: 'Product Hunt for builders.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const result = await getUser();
  const initialTheme = (result?.profile.theme_pref as 'light' | 'dark' | 'system') ?? 'light';
  const signedIn = !!result;

  // themeBootScript is a trusted compile-time constant, not user input — safe to inline.
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const bootHtml = { __html: themeBootScript } as any;

  return (
    <html
      lang="en"
      data-theme={initialTheme === 'system' ? 'light' : initialTheme}
      data-density="regular"
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash: apply localStorage theme/density BEFORE first paint */}
        <script dangerouslySetInnerHTML={bootHtml} />
      </head>
      <body>
        <ThemeController initialTheme={initialTheme} initialDensity="regular" signedIn={signedIn}>
          {children}
        </ThemeController>
        <NotificationToaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
