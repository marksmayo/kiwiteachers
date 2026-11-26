import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Kāo — admins only</h1>
      <p className="mt-2 text-muted">This area is for site administrators.</p>
      <Link href="/" className="btn-primary mt-6">Back home</Link>
    </div>
  );
}
