import { timingSafeEqual } from "node:crypto";

/** True only for `Authorization: Bearer <CRON_SECRET>`, and never when the secret is unset or short. */
export function isAuthorisedCron(authorization: string | null, secret = process.env.CRON_SECRET) {
  if (!secret || secret.length < 16 || !authorization) return false;
  const a = Buffer.from(authorization);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
