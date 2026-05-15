import {
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
} from 'next/font/google';

export const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
});

// All variable classNames concatenated for use in <html className={fontVariables}>
export const fontVariables = [
  geist.variable,
  geistMono.variable,
  spaceGrotesk.variable,
  inter.variable,
  jetBrainsMono.variable,
  ibmPlexMono.variable,
].join(' ');
