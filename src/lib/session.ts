import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

/** ADMIN_EMAILS only grants admin to *verified* emails, so nobody can claim admin by registering an address first. */
export function isAdminEmail(email: string | undefined | null) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export function resolveIsAdmin(user: { role?: string | null; email: string; emailVerified?: boolean | null }) {
  return user.role === "admin" || (!!user.emailVerified && isAdminEmail(user.email));
}

export async function getCurrentUser(reqHeaders?: Headers): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({
    headers: reqHeaders ?? (await headers()),
  });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: resolveIsAdmin(u),
  };
}
