import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getFavourites } from "@/lib/resources";
import { GridSkeleton, ResourceGrid } from "@/components/ResourceCard";

export const metadata: Metadata = { title: "My favourites" };

export default function FavouritesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pohutukawa/10 text-pohutukawa">
          <Heart className="h-5 w-5 fill-pohutukawa" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">My favourites</h1>
          <p className="text-muted">Your saved resources, ready for planning.</p>
        </div>
      </div>
      <Suspense fallback={<GridSkeleton count={4} />}>
        <Favourites />
      </Suspense>
    </div>
  );
}

async function Favourites() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/favourites");
  const rows = await getFavourites(user.id);
  if (!rows.length) {
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <p className="font-display text-xl font-semibold">No favourites yet</p>
        <p className="mt-2 max-w-sm text-sm text-muted">Tap the heart on any resource to save it here.</p>
        <Link href="/resources" className="btn-primary mt-5">Browse resources</Link>
      </div>
    );
  }
  return <ResourceGrid resources={rows} signedIn />;
}
