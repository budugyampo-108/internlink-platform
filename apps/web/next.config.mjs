/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The shared package ships TypeScript source — let Next compile it.
  transpilePackages: ['@internlink/shared'],
  experimental: {
    // Keep uploads small; Vercel serverless request bodies are capped at ~4.5 MB anyway.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
