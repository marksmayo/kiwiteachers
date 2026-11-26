"use client";

import { useEffect } from "react";

/** Counts one view per resource per browser session. */
export function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    const key = `kt-viewed-${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch(`/api/resources/${id}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
