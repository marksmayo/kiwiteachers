/**
 * Te Mātaiaho (refreshed NZ Curriculum) codes. We store whatever official code
 * strings are entered — normalised to upper case — so they can be searched
 * and filtered exactly. No code list is hard-coded: the official codes are
 * still being published learning area by learning area.
 */

export const MAX_CODES = 20;
export const MAX_CODE_LENGTH = 40;
const CODE_RE = /^[A-Z0-9][A-Z0-9 .:/_-]*$/;

export function normaliseCode(raw: string): string | null {
  const code = raw.trim().replace(/\s+/g, " ").toUpperCase();
  if (!code || code.length > MAX_CODE_LENGTH) return null;
  return CODE_RE.test(code) ? code : null;
}

/** Accepts a list or a comma/newline/semicolon-separated string; returns unique valid codes. */
export function normaliseCodes(input: string | string[]): { codes: string[]; invalid: string[] } {
  const parts = (Array.isArray(input) ? input : input.split(/[,;\n]/)).map((p) => p.trim()).filter(Boolean);
  const codes: string[] = [];
  const invalid: string[] = [];
  for (const p of parts) {
    const c = normaliseCode(p);
    if (!c) invalid.push(p);
    else if (!codes.includes(c)) codes.push(c);
  }
  return { codes: codes.slice(0, MAX_CODES), invalid };
}
