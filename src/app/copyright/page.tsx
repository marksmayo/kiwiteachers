import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Copyright & takedown" };

export default function CopyrightPage() {
  return (
    <LegalPage
      current="/copyright"
      title="Copyright & takedown"
      intro="We respect the work of creators. If you believe something on KiwiTeachers uses your work without permission, tell us and we'll act quickly."
    >
      <h2>Who owns the resources</h2>
      <p>
        Resources are owned by KiwiTeachers or by the teachers who contributed them. Contributors keep their copyright and license
        KiwiTeachers to share their work for classroom use. Resources are protected by the Copyright Act 1994.
      </p>

      <h2>Reporting a copyright problem</h2>
      <p>Email <Contact /> with:</p>
      <ol>
        <li>your name and contact details;</li>
        <li>a link to the resource on KiwiTeachers;</li>
        <li>a description of your work, and where it was originally published if relevant;</li>
        <li>a statement that you own the copyright (or are authorised to act for the owner) and believe the use isn’t permitted.</li>
      </ol>

      <h2>What happens next</h2>
      <ul>
        <li>We’ll usually take the resource down while we look into it, normally within two working days.</li>
        <li>We’ll let the contributor know and give them a chance to respond.</li>
        <li>If the claim is upheld, the resource stays removed. Accounts that repeatedly infringe will be closed.</li>
        <li>If the contributor shows they have the rights, we may restore the resource and let you know.</li>
      </ul>

      <h2>Other concerns</h2>
      <p>
        If a resource contains personal information, is offensive, or is inaccurate, email <Contact /> and we’ll review it.
      </p>
    </LegalPage>
  );
}
