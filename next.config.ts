import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  serverExternalPackages: [
    '@libsql/client',
    '@libsql/hrana-client',
    '@libsql/isomorphic-ws',
    'drizzle-orm',
    '@auth/drizzle-adapter',
  ],
  typescript: {
    // Type-check separately via tsc --noEmit; skip during build to avoid timeouts
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
