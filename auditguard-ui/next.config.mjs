/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Use environment variable for API URL with fallback
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
