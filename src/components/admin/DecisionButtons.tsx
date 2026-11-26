"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { decideResource } from "@/app/actions";

export function DecisionButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "approve" | "reject") =>
    start(async () => {
      setError(null);
      const res = await decideResource(id, decision, reason);
      if (!res.ok) setError(res.error);
    });

  if (rejecting) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-80">
        <textarea
          className="input min-h-20 text-sm"
          placeholder="Reason for the contributor (e.g. copyright concerns, missing pages)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          aria-label="Rejection reason"
        />
        <div className="flex gap-2">
          <button disabled={pending || !reason.trim()} onClick={() => decide("reject")} className="btn bg-pohutukawa py-1.5 text-white hover:bg-pohutukawa/90">
            {pending ? "Rejecting…" : "Reject"}
          </button>
          <button onClick={() => setRejecting(false)} className="text-sm text-muted hover:underline">Cancel</button>
        </div>
        {error && <p className="text-xs text-pohutukawa">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pending} onClick={() => decide("approve")} className="btn-primary py-1.5">
        <Check className="h-4 w-4" /> {pending ? "Publishing…" : "Approve & publish"}
      </button>
      <button disabled={pending} onClick={() => setRejecting(true)} className="btn-ghost py-1.5">
        <X className="h-4 w-4" /> Reject
      </button>
      {error && <p className="w-full text-xs text-pohutukawa">{error}</p>}
    </div>
  );
}
