/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://svc-01k91gnrcx1vyq8fb1w0wfveg9.01k8njsj98qqesz0ppxff2yq4n.lmapp.run/api/:path*',
      },
    ];
  },
};

export default nextConfig;
