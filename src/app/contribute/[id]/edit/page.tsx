import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { requireUser } from "@/lib/require-user";
import { getResourceById } from "@/lib/resources";

export const metadata: Metadata = { title: "Edit submission" };

type Props = { params: Promise<{ id: string }> };

export default function EditSubmissionPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold">Edit submission</h1>
      <p className="mb-8 mt-1 text-muted">Saving sends it back to the approval queue.</p>
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
  const user = await requireUser(`/contribute/${id}/edit`);
  const r = await getResourceById(id);
  if (!r || r.uploaded_by !== user.id || r.status === "published") notFound();
  return (
    <ResourceForm
      userId={user.id}
      mode="contributor"
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
