import Link from "next/link";
import { KiwiMark } from "@/components/KiwiLogo";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <KiwiMark className="mx-auto h-16 w-16" />
      <h1 className="mt-6 text-3xl font-bold">This kiwi has wandered off</h1>
      <p className="mt-2 text-muted">We couldn’t find that page. It may have been moved or removed.</p>
      <Link href="/resources" className="btn-primary mt-6">Browse resources</Link>
    </div>
  );
}
