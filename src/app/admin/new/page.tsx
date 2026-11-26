import type { Metadata } from "next";
import { Suspense } from "react";
import { forbidden, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ResourceForm } from "@/components/admin/ResourceForm";

export const metadata: Metadata = { title: "Upload resource" };

export default function NewResourcePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold">Upload a resource</h1>
      <p className="mb-8 mt-1 text-muted">PDFs only. Tag it well so teachers can find it.</p>
      <div className="card p-6 sm:p-8">
        <Suspense fallback={<div className="h-96" />}>
          <Gate />
        </Suspense>
      </div>
    </div>
  );
}

async function Gate() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/admin/new");
  if (!user.isAdmin) forbidden();
  return <ResourceForm />;
}
