import Link from "next/link";
import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy policy"
      intro="We collect as little personal information as we can, use it only to run KiwiTeachers, and never sell it. This policy explains what we hold and your rights under the Privacy Act 2020."
    >
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address and password (stored only as a secure hash, so we can’t read it).</li>
        <li><strong>Sign-in sessions:</strong> a session cookie, plus the IP address and browser type used to sign in, to keep your account secure.</li>
        <li><strong>Your activity:</strong> favourites, ratings, reviews, the resources you download (to apply the daily download allowance), and resources you submit.</li>
        <li><strong>Anonymous usage:</strong> view and download counts per resource. These aren’t linked to you on the public site.</li>
      </ul>
      <p>We don’t use advertising or third-party tracking cookies.</p>

      <h2>How we use it</h2>
      <ul>
        <li>to provide your account, favourites, downloads, reviews and contributions;</li>
        <li>to show your name (shortened, e.g. “Aroha T.”) on reviews and resources you share;</li>
        <li>to keep the site secure, prevent abuse and enforce our <Link href="/terms">terms</Link>;</li>
        <li>to contact you about your account or submissions.</li>
      </ul>

      <h2>Where it’s stored</h2>
      <p>
        KiwiTeachers runs on Vercel (hosting and file storage) and Neon (database). Your information may be stored or processed in
        Australia and the United States. We choose providers with comparable privacy safeguards, as required by the Privacy Act 2020.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while you have an account. When you delete your account, we delete your account details, sessions,
        favourites, ratings, reviews, download history and unpublished submissions. Published resources you contributed stay on the
        site without your name, as described in our <Link href="/terms#contributions">contributor terms</Link>. Backups are overwritten
        within a limited period.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>You can see and correct your details, and change your password, in <Link href="/account">Account settings</Link>.</li>
        <li>You can <Link href="/account#delete">delete your account</Link> at any time.</li>
        <li>You can ask for a copy of the personal information we hold about you, or ask us to correct it, by emailing <Contact />.</li>
      </ul>

      <h2>Students and children</h2>
      <p>
        KiwiTeachers is for adults. Please never include students’ names, photos or other personal information in resources or
        reviews. If we find any, we’ll remove it.
      </p>

      <h2>Security and breaches</h2>
      <p>
        We use encrypted connections, hashed passwords and access controls. If a privacy breach is likely to cause serious harm, we’ll
        notify affected people and the Office of the Privacy Commissioner as the law requires.
      </p>

      <h2>Questions and complaints</h2>
      <p>
        Contact us at <Contact />. If you’re not happy with our response, you can complain to the{" "}
        <a href="https://www.privacy.org.nz" target="_blank" rel="noopener noreferrer">Office of the Privacy Commissioner</a>.
      </p>
    </LegalPage>
  );
}
