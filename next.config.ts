import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Partial Prerendering is off: the nonce-based CSP in src/proxy.ts needs every page rendered per request.
  poweredByHeader: false,
  experimental: {
    authInterrupts: true,
  },
  serverExternalPackages: ["pdf-lib"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV !== "production") }];
  },
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
