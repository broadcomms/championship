/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  reactStrictMode: true,
  swcMinify: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    unoptimized: false, // Let Next.js handle optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compiler options for better tree-shaking
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@/components'],
  },

  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:3000';

    return {
      // Routes handled by Next.js API routes (not rewritten)
      beforeFiles: [],
      // Only rewrite routes NOT handled by Next.js API routes
      afterFiles: [
        // Auth routes - proxy to backend
        { source: '/api/auth/:path*', destination: `${apiUrl}/api/auth/:path*` },
        // Workspace routes - proxy to backend
        { source: '/api/workspaces/:path*', destination: `${apiUrl}/api/workspaces/:path*` },
        // Organization routes
        { source: '/api/organizations/:path*', destination: `${apiUrl}/api/organizations/:path*` },
        // User routes
        { source: '/api/users/:path*', destination: `${apiUrl}/api/users/:path*` },
        // Admin routes
        { source: '/api/admin/:path*', destination: `${apiUrl}/api/admin/:path*` },
        // Billing routes
        { source: '/api/billing/:path*', destination: `${apiUrl}/api/billing/:path*` },
        // SSO routes
        { source: '/api/sso/:path*', destination: `${apiUrl}/api/sso/:path*` },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
