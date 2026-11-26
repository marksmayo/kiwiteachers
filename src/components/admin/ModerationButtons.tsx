"use client";

import { useState, useTransition } from "react";
import { moderateReview } from "@/app/actions";

export function ModerationButtons({ userId, resourceId }: { userId: string; resourceId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (action: "approve" | "hide" | "delete") =>
    start(async () => {
      const res = await moderateReview(userId, resourceId, action);
      if (!res.ok) setError(res.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pending} onClick={() => act("approve")} className="btn-primary py-1.5">Approve &amp; publish</button>
      <button disabled={pending} onClick={() => act("hide")} className="btn-ghost py-1.5">Keep hidden</button>
      <button disabled={pending} onClick={() => act("delete")} className="btn py-1.5 text-pohutukawa hover:bg-pohutukawa/10">Delete text</button>
      {error && <span className="text-xs text-pohutukawa">{error}</span>}
    </div>
  );
}
