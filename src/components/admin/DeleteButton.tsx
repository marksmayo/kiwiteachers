"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteResource } from "@/app/actions";

export function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <button
          disabled={pending}
          onClick={() => start(() => deleteResource(id))}
          className="rounded-full bg-pohutukawa px-3 py-1 text-xs font-semibold text-white"
        >
          {pending ? "Deleting…" : "Confirm delete"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-muted hover:underline">Cancel</button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="rounded-full p-2 text-muted hover:bg-pohutukawa/10 hover:text-pohutukawa" aria-label="Delete">
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
