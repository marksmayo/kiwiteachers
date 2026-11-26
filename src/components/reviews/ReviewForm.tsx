"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeReviewText, submitReview } from "@/app/actions";
import { StarPicker } from "../StarPicker";

const MIN = 10;
const MAX = 2000;

export function ReviewForm({
  resourceId,
  initialScore,
  initialBody,
}: {
  resourceId: string;
  initialScore: number | null;
  initialBody: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [score, setScore] = useState<number | null>(initialScore);
  const [body, setBody] = useState(initialBody ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [open, setOpen] = useState(!initialBody);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!score) return setMessage({ tone: "error", text: "Choose a star rating first." });
    if (body.trim().length < MIN) return setMessage({ tone: "error", text: `Reviews need at least ${MIN} characters.` });
    start(async () => {
      const res = await submitReview(resourceId, score, body);
      if (!res.ok) {
        setMessage({ tone: "error", text: res.error === "signin" ? "Please sign in again." : res.error });
        return;
      }
      setOpen(false);
      setMessage(
        res.status === "flagged"
          ? { tone: "warn", text: "Thanks! Your review will appear once a moderator has checked it." }
          : { tone: "ok", text: "Thanks — your review is live." },
      );
      router.refresh();
    });
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setOpen(true)} className="btn-ghost">
          {initialBody ? "Edit your review" : "Write a review"}
        </button>
        {initialBody && (
          <button
            onClick={() =>
              start(async () => {
                await removeReviewText(resourceId);
                setBody("");
                setMessage({ tone: "ok", text: "Review removed (your star rating is kept)." });
              })
            }
            className="text-xs text-muted hover:text-pohutukawa hover:underline"
          >
            Delete review
          </button>
        )}
        {message && <Note {...message} />}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-4">
      <div className="text-sm font-semibold">{initialBody ? "Edit your review" : "Write a review"}</div>
      <StarPicker value={score} onChange={setScore} size={24} disabled={pending} label="Review rating" />
      <label className="block">
        <span className="sr-only">Your review</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX))}
          className="input min-h-28"
          placeholder="How did it go with your class? What year level did you use it with?"
          maxLength={MAX}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Posting…" : "Post review"}</button>
        {initialBody && (
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:underline">Cancel</button>
        )}
        <span className="ml-auto text-xs text-muted">{body.trim().length}/{MAX}</span>
      </div>
      <p className="text-xs text-muted">Please keep it kind and useful. Links and contact details aren’t allowed.</p>
      {message && <Note {...message} />}
    </form>
  );
}

function Note({ tone, text }: { tone: "ok" | "warn" | "error"; text: string }) {
  const cls = tone === "ok" ? "bg-fern-light text-fern" : tone === "warn" ? "bg-amber-50 text-amber-800" : "bg-pohutukawa/10 text-pohutukawa";
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${cls}`} role="status">
      {text}
    </p>
  );
}
