import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeartHandshake } from "lucide-react";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireUser } from "@/lib/require-user";

export const metadata: Metadata = { title: "Share a resource" };

export default function ContributePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-fern-light text-fern">
          <HeartHandshake className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Share a resource</h1>
          <p className="mt-1 text-muted">
            Made something that worked well in your classroom? Share it with kaiako around Aotearoa. Every submission is checked
            before it goes live. Please read the <Link href="/guidelines" className="font-semibold text-fern hover:underline">community guidelines</Link> first.
          </p>
        </div>
      </div>
      <div className="card p-6 sm:p-8">
        <Suspense fallback={<div className="h-96" />}>
          <Gate />
        </Suspense>
      </div>
    </div>
  );
}

async function Gate() {
  const user = await requireUser("/contribute");
  return <ResourceForm userId={user.id} mode={user.isAdmin ? "admin" : "contributor"} />;
}
