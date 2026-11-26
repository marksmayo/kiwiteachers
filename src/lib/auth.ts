import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

export function baseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Only this project's own deployments. `*.vercel.app` alone would trust every Vercel customer's site.
 * Preview and branch URLs look like kiwiteachers-<hash>-<team>.vercel.app / kiwiteachers-git-<branch>-<team>.vercel.app.
 */
export function trustedOrigins() {
  const origins = ["https://kiwiteachers.vercel.app"];
  const team = process.env.VERCEL_TEAM_SLUG ?? "marks-projects-61167feb";
  origins.push(`https://kiwiteachers-*-${team}.vercel.app`);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return origins;
}

/** Account deletion must always re-confirm the password (Better Auth otherwise allows it for "fresh" sessions). */
export function assertDeletePassword(path: string, body: unknown) {
  if (path !== "/delete-user") return;
  const password = (body as { password?: unknown } | undefined)?.password;
  if (typeof password !== "string" || !password) {
    throw new APIError("BAD_REQUEST", { message: "Please enter your password to delete your account" });
  }
}

export const requirePasswordForDelete = createAuthMiddleware(async (ctx) => assertDeletePassword(ctx.path, ctx.body));

export const auth = betterAuth({
  baseURL: baseURL(),
  database: new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // Never settable by the user (input: false); changed only via the DB/admin tooling.
      role: { type: "string", defaultValue: "user", input: false },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const { cleanupUserData } = await import("./resource-service");
        await cleanupUserData(user.id);
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    // Short cache so revoked sessions and role changes take effect within a minute.
    cookieCache: { enabled: true, maxAge: 60 },
  },
  hooks: { before: requirePasswordForDelete },
  rateLimit: { enabled: true, storage: "database" },
  trustedOrigins: trustedOrigins(),
  plugins: [nextCookies()],
});
