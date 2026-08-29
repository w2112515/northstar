import type { NextConfig } from "next";

const API_BASE = process.env.API_BASE ?? "http://localhost:8800";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_BASE}/api/:path*` },
      { source: "/healthz", destination: `${API_BASE}/healthz` },
    ];
  },
};

export default nextConfig;
