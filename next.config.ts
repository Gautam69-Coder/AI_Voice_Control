import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['streamdown', 'shiki'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  devIndicators: false,
};

export default nextConfig;
