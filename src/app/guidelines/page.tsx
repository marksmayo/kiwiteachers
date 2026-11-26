import Link from "next/link";
import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Community guidelines" };

export default function GuidelinesPage() {
  return (
    <LegalPage
      current="/guidelines"
      title="Community guidelines"
      intro="KiwiTeachers works because teachers help each other. These guidelines keep it useful, safe and kind."
    >
      <h2>Sharing resources</h2>
      <ul>
        <li>Share your own work, or work you have permission to share. Don’t upload commercial resources, textbook pages or other people’s worksheets.</li>
        <li>Check images, clip art and fonts are free to use and share.</li>
        <li>Never include students’ names, photos, work samples with names, or other personal information.</li>
        <li>Upload a plain PDF (1–4 pages is ideal). Password-protected or interactive PDFs, such as fillable forms or scripts, will be rejected automatically.</li>
        <li>Tag it well: year levels, learning areas, keywords and Te Mātaiaho codes help others find it.</li>
        <li>Be culturally respectful. Take care with te reo Māori (including macrons), tikanga and mātauranga Māori, and Pacific cultures.</li>
      </ul>

      <h2>Writing reviews</h2>
      <ul>
        <li>Say how you used the resource and how it went: year level, what worked, what you’d change.</li>
        <li>Be respectful. Critique the resource, not the person who made it.</li>
        <li>No links, email addresses, phone numbers or advertising.</li>
        <li>No bad language, abuse or discrimination.</li>
      </ul>

      <h2>How moderation works</h2>
      <p>
        Every new resource is checked by our team before it goes live. Reviews are published straight away unless our automatic
        checks spot bad language, links, contact details or spam. Those reviews are held until a moderator approves them.
        We may hide reviews or remove resources that break these guidelines or our <Link href="/terms">terms</Link>.
      </p>

      <h2>Report a problem</h2>
      <p>See something that shouldn’t be here? Email <Contact /> with a link and we’ll take a look.</p>
    </LegalPage>
  );
}
