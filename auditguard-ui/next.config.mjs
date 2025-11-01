/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Using sandbox deployment with content-type detection fixes
        destination: 'https://svc-01k8vsdvcee1j74vtx7y8xan0z.01k8njsj98qqesz0ppxff2yq4n.lmapp.run/api/:path*',
      },
    ];
  },
};

export default nextConfig;
