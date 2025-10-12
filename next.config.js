// next.config.js
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "etheriumtech.com.br" }
    ]
  },
  webpack: (config) => {
    // Fallback para garantir que os aliases funcionem no bundler,
    // independentemente do tsconfig/jsconfig.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@components": path.resolve(__dirname, "components"),
      "@lib": path.resolve(__dirname, "lib"),
      "@services": path.resolve(__dirname, "services"),
      "@store": path.resolve(__dirname, "store"),
      "@types": path.resolve(__dirname, "types")
    };
    return config;
  }
};

module.exports = nextConfig;
