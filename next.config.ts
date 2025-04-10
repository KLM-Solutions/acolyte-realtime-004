import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Only include the d-id client SDK on the client-side
    if (isServer) {
      config.externals = [...(config.externals || []), '@d-id/client-sdk'];
    }
    
    return config;
  }
};

export default nextConfig;
