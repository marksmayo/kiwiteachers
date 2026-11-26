import type { Metadata } from "next";
import { Suspense } from "react";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireAdmin } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Upload resource" };

export default function NewResourcePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold">Upload a resource</h1>
      <p className="mb-8 mt-1 text-muted">PDFs only. Admin uploads are published straight away.</p>
      <div className="card p-6 sm:p-8">
        <Suspense fallback={<div className="h-96" />}>
          <Gate />
        </Suspense>
      </div>
    </div>
  );
}

async function Gate() {
  const user = await requireAdmin("/admin/new");
  return <ResourceForm userId={user.id} />;
}
