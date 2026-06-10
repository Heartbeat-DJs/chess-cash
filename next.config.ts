import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships optional native bindings — keep it out of the bundle
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
