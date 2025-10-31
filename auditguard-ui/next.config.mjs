/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://svc-01k8vse632epjq0ytp43h8ke5j.01k8njsj98qqesz0ppxff2yq4n.lmapp.run/api/:path*',
      },
    ];
  },
};

export default nextConfig;
