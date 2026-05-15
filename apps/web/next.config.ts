import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@hatch/shared'],
  typedRoutes: true,
};

export default config;
