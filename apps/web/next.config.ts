import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  transpilePackages: ['@hatch/shared'],
  typedRoutes: true,
  outputFileTracingIncludes: {
    '/privacy': ['./content/legal/**'],
    '/terms': ['./content/legal/**'],
    '/commercial': ['./content/legal/**'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'vcbdtjjkkwryvmqbflah.supabase.co' },
    ],
  },
};

export default withNextIntl(config);
