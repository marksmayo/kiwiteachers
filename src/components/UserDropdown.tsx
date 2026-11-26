"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LogOut, Upload, Search, LayoutGrid, Settings, FolderUp, HeartHandshake, Inbox, ShieldAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function UserDropdown({
  name,
  email,
  isAdmin,
  pending = 0,
  flagged = 0,
}: {
  name: string;
  email: string;
  isAdmin: boolean;
  pending?: number;
  flagged?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initial = (name || email).trim().charAt(0).toUpperCase();
  const alerts = pending + flagged;
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink/85 hover:bg-fern-light hover:text-fern";
  const badge = (n: number) => (n > 0 ? <span className="ml-auto rounded-full bg-pohutukawa px-2 py-0.5 text-[11px] font-bold text-white">{n}</span> : null);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-kiwi font-display font-bold text-white ring-2 ring-paper hover:ring-fern/30"
        aria-label={alerts ? `Account menu, ${alerts} items need attention` : "Account menu"}
        aria-expanded={open}
      >
        {initial}
        {alerts > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pohutukawa px-1 text-[10px] font-bold ring-2 ring-sand">
            {alerts}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-64 p-1.5 shadow-xl" onClick={() => setOpen(false)}>
          <div className="border-b border-line px-3 pb-2.5 pt-2">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
          </div>
          <div className="pt-1.5">
            <Link href="/resources" className={`${item} md:hidden`}><Search className="h-4 w-4" /> Browse</Link>
            <Link href="/favourites" className={item}><Heart className="h-4 w-4" /> My favourites</Link>
            <Link href="/contribute" className={item}><HeartHandshake className="h-4 w-4" /> Share a resource</Link>
            <Link href="/my-resources" className={item}><FolderUp className="h-4 w-4" /> My contributions</Link>
            <Link href="/account" className={item}><Settings className="h-4 w-4" /> Account settings</Link>
            {isAdmin && (
              <div className="mt-1 border-t border-line pt-1">
                <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Admin</div>
                <Link href="/admin/queue" className={item}><Inbox className="h-4 w-4" /> Approval queue {badge(pending)}</Link>
                <Link href="/admin/reviews" className={item}><ShieldAlert className="h-4 w-4" /> Flagged reviews {badge(flagged)}</Link>
                <Link href="/admin" className={item}><LayoutGrid className="h-4 w-4" /> Manage resources</Link>
                <Link href="/admin/new" className={item}><Upload className="h-4 w-4" /> Upload resource</Link>
              </div>
            )}
            <button
              className={`${item} mt-1 w-full border-t border-line`}
              onClick={async () => {
                await authClient.signOut();
                router.refresh();
              }}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
