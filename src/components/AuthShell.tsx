import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { KiwiMark, Koru } from "./KiwiLogo";
import { AuthForm } from "./AuthForm";

export function AuthShell({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-20">
      <div className="relative hidden overflow-hidden rounded-3xl bg-fern p-10 text-white md:block">
        <Koru className="absolute -bottom-16 -right-16 h-80 w-80 text-white/[0.07]" />
        <KiwiMark className="h-12 w-12 ring-2 ring-white/20 rounded-full" />
        <h2 className="mt-8 text-3xl font-bold leading-tight">
          {mode === "sign-up" ? "Join the whānau." : "Nau mai, hoki mai."}
        </h2>
        <p className="mt-2 text-white/75">{mode === "sign-up" ? "It’s free — no card, no catch." : "Welcome back."}</p>
        <ul className="mt-8 space-y-3 text-sm">
          {["Download clean, watermark-free PDFs", "Save favourites for your planning", "New resources added regularly"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-kiwifruit" /> {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-6 sm:p-10">
        <h1 className="text-3xl font-bold">{mode === "sign-up" ? "Create your free account" : "Sign in"}</h1>
        <p className="mb-8 mt-1 text-muted">
          {mode === "sign-up" ? "Takes about 20 seconds." : "Good to see you again."}
        </p>
        <Suspense fallback={<div className="h-64" />}>
          <AuthForm mode={mode} />
        </Suspense>
      </div>
    </div>
  );
}
