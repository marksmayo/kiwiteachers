import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/session";
import { moderationCounts } from "@/lib/reviews";

export async function requireAdmin(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!user.isAdmin) forbidden();
  return user;
}

export async function AdminNav({ active }: { active: "resources" | "queue" | "reviews" }) {
  const { pending, flagged } = await moderationCounts();
  const tab = (key: typeof active, href: string, label: string, count?: number) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active === key ? "bg-fern text-white" : "bg-paper text-ink/75 ring-1 ring-line hover:text-fern"}`}
    >
      {label}
      {!!count && (
        <span className={`rounded-full px-2 py-0.5 text-xs ${active === key ? "bg-white/20" : "bg-pohutukawa text-white"}`}>{count}</span>
      )}
    </Link>
  );
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Admin sections">
      {tab("resources", "/admin", "Published")}
      {tab("queue", "/admin/queue", "Approval queue", pending)}
      {tab("reviews", "/admin/reviews", "Flagged reviews", flagged)}
    </nav>
  );
}
