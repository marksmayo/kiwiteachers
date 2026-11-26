import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getResourceById } from "@/lib/resources";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireAdmin } from "@/components/admin/AdminNav";

export const metadata: Metadata = { title: "Edit resource" };

type Props = { params: Promise<{ id: string }> };

export default function EditResourcePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold">Edit resource</h1>
      <div className="card p-6 sm:p-8">
        <Suspense fallback={<div className="h-96" />}>
          <Gate params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Gate({ params }: Props) {
  const { id } = await params;
  const user = await requireAdmin(`/admin/${id}/edit`);
  const r = await getResourceById(id);
  if (!r) notFound();
  return (
    <ResourceForm
      userId={user.id}
      initial={{
        id: r.id,
        title: r.title,
        description: r.description,
        years: r.years,
        learningAreas: r.learning_areas,
        resourceType: r.resource_type,
        tags: r.tags,
        curriculumCodes: r.curriculum_codes,
        hasPreviews: r.preview_pathnames.length > 0,
      }}
    />
  );
}
