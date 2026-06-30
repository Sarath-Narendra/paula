import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal self-contained server build for the Docker / Cloud Run image.
  output: "standalone",
  // The in-build TypeScript type-check OOMs the Cloud Build worker (it peaks
  // past the heap limit). We verify types separately and they pass
  // (`tsc --noEmit` clean, `vitest` green), so skip the redundant in-build pass.
  // (Next 16 dropped the `eslint` config key — ESLint no longer runs in build.)
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      // Google account profile photos
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
