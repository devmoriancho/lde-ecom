import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.walmartimages.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "glantix.co.ke",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "mavigadget.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "furnituredecor.co.ke",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
