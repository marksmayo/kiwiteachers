/**
 * Returns a same-origin path for post-sign-in redirects, or "/".
 * Rejects protocol-relative (//x), backslash (/\x) and control-character tricks
 * that browsers normalise into off-site URLs.
 */
export function safeNext(raw: string | null | undefined, origin = "https://kiwiteachers.local"): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(raw) || raw.startsWith("//")) return "/";
  const url = new URL(raw, origin);
  if (url.origin !== new URL(origin).origin) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
