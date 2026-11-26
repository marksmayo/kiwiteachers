/**
 * Site-wide security headers. Kept as a pure function so it can be unit-tested.
 * 'unsafe-inline' scripts are needed for Next.js' inline bootstrap without per-request nonces
 * (nonces would make every page dynamic and defeat static shells).
 */
export function buildCsp(isDev: boolean) {
  const vercelLive = "https://vercel.live";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", vercelLive, ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'", vercelLive],
    "img-src": ["'self'", "data:", "blob:", vercelLive, "https://vercel.com"],
    "font-src": ["'self'", "data:", vercelLive, "https://assets.vercel.com"],
    "connect-src": ["'self'", "https://vercel.com", "https://*.blob.vercel-storage.com", vercelLive, "wss://*.pusher.com", ...(isDev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'self'", vercelLive],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const csp = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) csp.push("upgrade-insecure-requests");
  return csp.join("; ");
}

export function securityHeaders(isDev: boolean) {
  return [
    { key: "Content-Security-Policy", value: buildCsp(isDev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}
