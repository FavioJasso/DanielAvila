import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not advertise the framework in an `X-Powered-By` response header.
  poweredByHeader: false,
  // Surface unsafe effects early; the game engine must survive a double mount.
  reactStrictMode: true,
};

export default nextConfig;
