import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aplikace je téměř celá per-uživatel dynamická (cookies, RLS) → bez Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
