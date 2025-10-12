/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "etheriumtech.com.br"
      }
    ]
  }
};

module.exports = nextConfig;
