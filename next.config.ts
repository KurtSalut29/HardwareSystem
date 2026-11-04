import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    localPatterns: [{ pathname: "/uploads/**" }, { pathname: "/api/uploads/**" }, { pathname: "/logo.png" }, { pathname: "/images/**" }],
    // 90 is used for the full-width background photos, which show compression at the default 75.
    qualities: [75, 90],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
