import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  // Dev-only: hosts allowed to load /_next/* dev resources, so the app can be
  // tested from other devices on the LAN (e.g. ALLOWED_DEV_ORIGINS=10.2.51.15).
  ...(process.env.ALLOWED_DEV_ORIGINS && {
    allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS.split(","),
  }),
  ...(process.env.DOCKER_BUILD === "true" && { output: "standalone" }),
};

export default nextConfig;
