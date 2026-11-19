import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fonty pro PDF se čtou ze souborového systému → přibalit je k serverless funkcím.
  outputFileTracingIncludes: {
    "/api/export/**": ["./assets/fonts/**"],
  },
  serverExternalPackages: ["@react-pdf/renderer"],
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
