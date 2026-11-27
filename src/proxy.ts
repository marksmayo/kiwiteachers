import { NextResponse, type NextRequest } from "next/server";
import { API_CSP, buildCsp, newNonce } from "@/lib/security-headers";

/**
 * Sets a fresh nonce-based Content-Security-Policy on every page. Next.js reads the nonce from the
 * request's CSP header and stamps it on its own scripts, so injected scripts without it never run.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const res = NextResponse.next();
    res.headers.set("Content-Security-Policy", API_CSP);
    return res;
  }
  const nonce = newNonce();
  const csp = buildCsp(process.env.NODE_ENV !== "production", nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)"],
};
