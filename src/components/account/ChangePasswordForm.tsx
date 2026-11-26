"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const currentPassword = String(fd.get("current"));
    const newPassword = String(fd.get("new"));
    if (newPassword !== String(fd.get("confirm"))) return setMsg({ ok: false, text: "The new passwords don’t match." });
    if (newPassword.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (newPassword === currentPassword) return setMsg({ ok: false, text: "Choose a different password from your current one." });
    setBusy(true);
    setMsg(null);
    const res = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setBusy(false);
    if (res.error) {
      setMsg({ ok: false, text: /invalid|incorrect/i.test(res.error.message ?? "") ? "Your current password is incorrect." : res.error.message ?? "Couldn’t change password." });
      return;
    }
    form.reset();
    setMsg({ ok: true, text: "Password changed." });
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Current password</span>
        <input name="current" type="password" required autoComplete="current-password" className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">New password</span>
        <input name="new" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Confirm new password</span>
        <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="input" />
      </label>
      {msg && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-fern-light text-fern" : "bg-pohutukawa/10 text-pohutukawa"}`}>{msg.text}</p>
      )}
      <button disabled={busy} className="btn-primary w-fit">{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}
