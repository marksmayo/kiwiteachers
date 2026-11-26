"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LogOut, Upload, Search, LayoutGrid } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function UserDropdown({ name, email, isAdmin }: { name: string; email: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const initial = (name || email).trim().charAt(0).toUpperCase();
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink/85 hover:bg-fern-light hover:text-fern";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-kiwi font-display font-bold text-white ring-2 ring-paper hover:ring-fern/30"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-60 p-1.5 shadow-xl" onClick={() => setOpen(false)}>
          <div className="border-b border-line px-3 pb-2.5 pt-2">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
          </div>
          <div className="pt-1.5">
            <Link href="/resources" className={`${item} md:hidden`}>
              <Search className="h-4 w-4" /> Browse
            </Link>
            <Link href="/favourites" className={item}>
              <Heart className="h-4 w-4" /> My favourites
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin" className={item}>
                  <LayoutGrid className="h-4 w-4" /> Manage resources
                </Link>
                <Link href="/admin/new" className={item}>
                  <Upload className="h-4 w-4" /> Upload resource
                </Link>
              </>
            )}
            <button
              className={`${item} w-full`}
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
