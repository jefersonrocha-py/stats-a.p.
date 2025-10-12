// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "etheriumtech.com.br",
        pathname: "/wp-content/uploads/**",
      },
      // se eventualmente servir via www, já deixa previsto:
      {
        protocol: "https",
        hostname: "www.etheriumtech.com.br",
        pathname: "/wp-content/uploads/**",
      },
    ],
    // opcional: formatos modernos
    // formats: ["image/avif", "image/webp"],
  },
};

module.exports = nextConfig;
