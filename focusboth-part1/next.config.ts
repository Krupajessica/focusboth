import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Demo tunnels proxy the dev server from an outside hostname. */
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
