/**
 * Site-wide security headers. Pure functions so they can be unit-tested.
 *
 * Pages get a per-request nonce CSP from src/proxy.ts: only scripts carrying the nonce (Next.js' own
 * bootstrap and bundles) run, and 'strict-dynamic' lets those load their chunks. No 'unsafe-inline'
 * for scripts. This requires every page to render per request, so Partial Prerendering is off.
 */
export function buildCsp(isDev: boolean, nonce: string) {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Inline style attributes (e.g. colour accents) are still allowed; they can't run code.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https://*.blob.vercel-storage.com", ...(isDev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "script-src-attr": ["'none'"],
    "manifest-src": ["'self'"],
  };
  const csp = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!isDev) csp.push("upgrade-insecure-requests");
  return csp.join("; ");
}

/** Locked-down policy for API responses (JSON, PDFs, images), which never need to run anything. */
export const API_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export function newNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function securityHeaders(isDev: boolean) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}
