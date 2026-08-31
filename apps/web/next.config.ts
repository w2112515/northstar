import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  // Dev-only: Next 16 blocks dev asset requests from origins other than the
  // bound hostname; allow the loopback IP so http://127.0.0.1:3000 works too.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
