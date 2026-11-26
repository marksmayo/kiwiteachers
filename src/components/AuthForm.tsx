"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"), typeof window === "undefined" ? undefined : window.location.origin);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setExistingEmail(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim();
    const password = String(fd.get("password"));
    const res =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(fd.get("name")).trim() })
        : await authClient.signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      if (mode === "sign-up" && res.error.code?.startsWith("USER_ALREADY_EXISTS")) {
        setExistingEmail(email);
        setError("You already have an account with that email.");
        return;
      }
      setError(res.error.message ?? "Something went wrong — please try again.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  const other = mode === "sign-in" ? "/sign-up" : "/sign-in";
  const otherHref = next !== "/" ? `${other}?next=${encodeURIComponent(next)}` : other;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "sign-up" && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Your name</span>
          <input name="name" required autoComplete="name" className="input" placeholder="Whaea Aroha" />
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@school.nz"
          ref={(el) => {
            if (!el || el.value) return;
            try {
              const saved = sessionStorage.getItem("kt-email");
              if (saved) {
                el.value = saved;
                sessionStorage.removeItem("kt-email");
              }
            } catch {}
          }}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          className="input"
          placeholder={mode === "sign-up" ? "At least 8 characters" : ""}
        />
      </label>
      {error && (
        <p className="rounded-xl bg-pohutukawa/10 px-4 py-2.5 text-sm text-pohutukawa" role="alert">
          {error}
          {existingEmail && (
            <>
              {" "}
              <Link
                href={next !== "/" ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}
                onClick={() => {
                  try {
                    sessionStorage.setItem("kt-email", existingEmail);
                  } catch {}
                }}
                className="font-semibold underline"
              >
                Sign in instead →
              </Link>
            </>
          )}
        </p>
      )}
      {mode === "sign-up" && (
        <p className="text-xs text-muted">
          By creating an account you agree to our <Link href="/terms" className="underline hover:text-fern">terms of use</Link> and{" "}
          <Link href="/privacy" className="underline hover:text-fern">privacy policy</Link>.
        </p>
      )}
      <button disabled={loading} className="btn-primary w-full py-3">
        {loading ? "One moment…" : mode === "sign-up" ? "Create free account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "sign-in" ? "New here? " : "Already have an account? "}
        <Link href={otherHref} className="font-semibold text-fern hover:underline">
          {mode === "sign-in" ? "Create a free account" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
