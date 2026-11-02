import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enables smaller Docker runtime image (apps/web/Dockerfile).
  output: "standalone",
};

export default nextConfig;
