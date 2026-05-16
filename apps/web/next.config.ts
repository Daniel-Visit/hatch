import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hatch/shared'],
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'vcbdtjjkkwryvmqbflah.supabase.co' },
    ],
  },
};

export default config;
