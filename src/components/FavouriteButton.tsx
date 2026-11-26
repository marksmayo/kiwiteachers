"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavourite } from "@/app/actions";

export function FavouriteButton({
  resourceId,
  initial,
  variant = "icon",
  signedIn,
  returnTo,
}: {
  resourceId: string;
  initial: boolean;
  variant?: "icon" | "full";
  signedIn: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fav, setFav] = useOptimistic(initial);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(returnTo ?? window.location.pathname)}`);
      return;
    }
    start(async () => {
      setFav(!fav);
      const res = await toggleFavourite(resourceId);
      if (!res.ok) router.push("/sign-in");
      router.refresh();
    });
  };

  const label = fav ? "Remove from favourites" : "Save to favourites";

  if (variant === "full") {
    return (
      <button onClick={onClick} disabled={pending} className={fav ? "btn border border-pohutukawa/30 bg-pohutukawa/10 text-pohutukawa hover:bg-pohutukawa/15" : "btn-ghost"} aria-pressed={fav}>
        <Heart className={`h-4 w-4 ${fav ? "fill-pohutukawa" : ""}`} />
        {fav ? "Favourited" : "Favourite"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={fav}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-paper/95 shadow-sm ring-1 ring-line backdrop-blur transition hover:scale-105"
    >
      <Heart className={`h-4 w-4 transition ${fav ? "fill-pohutukawa text-pohutukawa" : "text-ink/70"}`} />
    </button>
  );
}
