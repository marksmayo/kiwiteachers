import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Create a free account" };

export default function SignUpPage() {
  return <AuthShell mode="sign-up" />;
}
