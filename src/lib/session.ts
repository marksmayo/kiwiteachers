import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

export function isAdminEmail(email: string | undefined | null) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export async function getCurrentUser(
  reqHeaders?: Headers,
): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({
    headers: reqHeaders ?? (await headers()),
  });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    isAdmin: isAdminEmail(session.user.email),
  };
}
