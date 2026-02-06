import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@openpkg-ts/json-render',
    '@openpkg-ts/registry',
    '@openpkg-ts/sdk',
    '@openpkg-ts/spec',
  ],
};

export default nextConfig;
