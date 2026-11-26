import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { UserDropdown } from "./UserDropdown";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-ink/80 hover:text-fern sm:inline">
          Sign in
        </Link>
        <Link href="/sign-up" className="btn-primary py-2">
          Join free
        </Link>
      </div>
    );
  }
  return <UserDropdown name={user.name} email={user.email} isAdmin={user.isAdmin} />;
}
