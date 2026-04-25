import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['@libsql/client', 'drizzle-orm', '@auth/drizzle-adapter'],
};

export default nextConfig;
