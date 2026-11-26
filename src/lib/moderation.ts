/**
 * Lightweight review moderation. Anything flagged is held back from the public
 * and surfaced to admins in the moderation queue — never silently deleted.
 */

export type ModerationReason = "link" | "email" | "phone" | "profanity" | "spam";

export const REASON_LABELS: Record<ModerationReason, string> = {
  link: "Contains a link or web address",
  email: "Contains an email address",
  phone: "Contains a phone number",
  profanity: "Contains bad language",
  spam: "Looks like spam (shouting, repetition)",
};

// Whole-word matches after normalisation. Kept deliberately to clear-cut words to avoid false positives.
const PROFANITY = [
  "fuck", "fucks", "fucked", "fucker", "fuckers", "fucking", "fuckin", "motherfucker", "motherfucking",
  "shit", "shits", "shitty", "shite", "bullshit", "horseshit", "shithead",
  "cunt", "cunts", "bitch", "bitches", "bitchy", "bastard", "bastards",
  "dick", "dicks", "dickhead", "cock", "cocks", "cocksucker", "prick", "pricks",
  "piss", "pissed", "pissing", "wanker", "wankers", "wank", "twat", "twats",
  "slut", "sluts", "whore", "whores", "arsehole", "arseholes", "asshole", "assholes",
  "bollocks", "dipshit", "jackass", "fag", "fags", "faggot", "faggots",
  "retard", "retarded", "retards", "nigger", "niggers", "nigga", "niggas", "spastic", "tosser",
];
const PROFANITY_SET = new Set(PROFANITY);
const collapse = (w: string) => w.replace(/([a-z])\1+/g, "$1");
/** Same list with doubled letters collapsed, to catch stretched spellings ("fuuuuck", "shiiiit"). */
const PROFANITY_COLLAPSED = new Set(PROFANITY.map(collapse));
const isProfane = (w: string) => PROFANITY_SET.has(w) || PROFANITY_COLLAPSED.has(collapse(w));

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i", "+": "t" };

/** Lower-case, undo leetspeak, strip accents, collapse 3+ repeated letters ("shiiiit" → "shit"). */
export function normaliseForMatching(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$!+]/g, (c) => LEET[c] ?? c)
    .replace(/([a-z])\1{2,}/g, "$1$1");
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
const BARE_DOMAIN_RE = /\b[a-z0-9-]{2,}(?:\.[a-z0-9-]{2,})*\s?(?:\.|\(dot\)|\[dot\]|\sdot\s)\s?(?:com|net|org|nz|au|io|co|info|biz|xyz|ru|cn|me|ly|link|shop|site|online|app|dev|gl|gg)\b/i;
const EMAIL_RE = /[a-z0-9._%+-]+\s?(?:@|\(at\)|\[at\])\s?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s().-]?){8,}/;

function hasProfanity(text: string) {
  const words = normaliseForMatching(text).split(/[^a-z]+/).filter(Boolean);
  if (words.some(isProfane)) return true;
  // Catch spaced-out words like "f u c k"
  const singles = text.toLowerCase().match(/\b(?:[a-z][\s.*_-]){3,}[a-z]\b/g) ?? [];
  return singles.some((s) => isProfane(normaliseForMatching(s.replace(/[\s.*_-]/g, ""))));
}

function looksLikeSpam(text: string) {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length >= 20) {
    const upper = letters.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.7) return true;
  }
  if (/(.)\1{7,}/.test(text)) return true; // aaaaaaaa / !!!!!!!!
  if (/[!?]{5,}/.test(text)) return true;
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 8) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    const max = Math.max(...counts.values());
    if (max / words.length > 0.4) return true;
  }
  return false;
}

export function moderateText(text: string): { flagged: boolean; reasons: ModerationReason[] } {
  const reasons: ModerationReason[] = [];
  if (URL_RE.test(text) || BARE_DOMAIN_RE.test(text)) reasons.push("link");
  if (EMAIL_RE.test(text)) reasons.push("email");
  if (PHONE_RE.test(text)) reasons.push("phone");
  if (hasProfanity(text)) reasons.push("profanity");
  if (looksLikeSpam(text)) reasons.push("spam");
  return { flagged: reasons.length > 0, reasons };
}
