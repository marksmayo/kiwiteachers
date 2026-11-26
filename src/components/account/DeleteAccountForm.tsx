"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export const CONFIRM_PHRASE = "delete my account";

export function DeleteAccountForm({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (phrase.trim().toLowerCase() !== CONFIRM_PHRASE) return setError(`Type “${CONFIRM_PHRASE}” to confirm.`);
    const password = String(new FormData(e.currentTarget).get("password"));
    setBusy(true);
    const res = await authClient.deleteUser({ password });
    if (res.error) {
      setBusy(false);
      setError(/invalid|incorrect/i.test(res.error.message ?? "") ? "That password is incorrect." : res.error.message ?? "Couldn’t delete your account.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-3">
      {isAdmin && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You’re an administrator. If you delete your account, make sure someone else still has admin access.
        </p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Your password</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Type “{CONFIRM_PHRASE}” to confirm</span>
        <input value={phrase} onChange={(e) => setPhrase(e.target.value)} className="input" autoComplete="off" />
      </label>
      {error && <p role="alert" className="rounded-lg bg-pohutukawa/10 px-3 py-2 text-sm text-pohutukawa">{error}</p>}
      <button disabled={busy} className="btn w-fit bg-pohutukawa text-white hover:bg-pohutukawa/90">
        {busy ? "Deleting…" : "Permanently delete my account"}
      </button>
    </form>
  );
}
