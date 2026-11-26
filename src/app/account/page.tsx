import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyRound, Trash2, UserRound, FolderUp, Heart } from "lucide-react";
import { requireUser } from "@/lib/require-user";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";

export const metadata: Metadata = { title: "Account settings" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold">Account settings</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-line/40" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const user = await requireUser("/account");
  return (
    <div className="space-y-6">
      <section className="card p-6" aria-labelledby="profile-h">
        <h2 id="profile-h" className="flex items-center gap-2 text-lg font-semibold"><UserRound className="h-5 w-5 text-fern" /> Profile</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[120px_1fr]">
          <dt className="text-muted">Name</dt><dd className="font-medium">{user.name}</dd>
          <dt className="text-muted">Email</dt><dd className="font-medium">{user.email}</dd>
          {user.isAdmin && (<><dt className="text-muted">Role</dt><dd className="font-medium">Administrator</dd></>)}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/favourites" className="btn-ghost py-1.5"><Heart className="h-4 w-4" /> My favourites</Link>
          <Link href="/my-resources" className="btn-ghost py-1.5"><FolderUp className="h-4 w-4" /> My contributions</Link>
        </div>
      </section>

      <section id="password" className="card p-6" aria-labelledby="pw-h">
        <h2 id="pw-h" className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5 text-fern" /> Change password</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Changing your password signs you out on your other devices.</p>
        <ChangePasswordForm />
      </section>

      <section id="delete" className="card border-pohutukawa/30 p-6" aria-labelledby="del-h">
        <h2 id="del-h" className="flex items-center gap-2 text-lg font-semibold text-pohutukawa"><Trash2 className="h-5 w-5" /> Delete my account</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          This permanently deletes your account, favourites, ratings, reviews, download history and any submissions that
          haven’t been published. Resources you shared that are already live stay on the site without your name.
          This can’t be undone.
        </p>
        <DeleteAccountForm isAdmin={user.isAdmin} />
      </section>
    </div>
  );
}
