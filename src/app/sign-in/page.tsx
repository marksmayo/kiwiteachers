import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <AuthShell mode="sign-in" />;
}
