import type { Metadata } from 'next';
import { getUser } from '@/lib/auth';
import { ThemeController, themeBootScript } from './_components/theme-controller';
import { Shell } from './_components/shell';
import { fontVariables } from './_components/fonts';

import './globals.css';
import './styles/prototype-base.css';
import './styles/prototype-cards.css';
import './styles/prototype-screens.css';
import './styles/prototype-contact.css';

export const metadata: Metadata = {
  title: 'Hatch · Apps Gallery',
  description: 'Product Hunt for builders.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const result = await getUser();
  const initialTheme = (result?.profile.theme_pref as 'light' | 'dark' | 'system') ?? 'light';
  const signedIn = !!result;

  // ShellUser shape: { handle, avatar_url, hue, emoji, display_name }
  const shellUser = result
    ? {
        handle: result.profile.handle,
        avatar_url: result.profile.avatar_url,
        hue: result.profile.hue,
        emoji: result.profile.emoji,
        display_name: result.profile.display_name,
      }
    : null;

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
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeController initialTheme={initialTheme} initialDensity="regular" signedIn={signedIn}>
          <Shell user={shellUser}>{children}</Shell>
        </ThemeController>
      </body>
    </html>
  );
}
