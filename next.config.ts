import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "convex/_generated/api": "./convex/_generated/api",
      "convex/_generated/api.js": "./convex/_generated/api.js",
      "convex/_generated/dataModel": "./convex/_generated/dataModel",
      "convex/_generated/server": "./convex/_generated/server",
      "convex/_generated/server.js": "./convex/_generated/server.js",
    },
  },
};

export default nextConfig;
