import Link from "next/link";
import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/LegalPage";
import { DAILY_DOWNLOAD_LIMIT } from "@/lib/download-limit";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of use"
      intro="These terms explain how you can use KiwiTeachers and the resources on it. By creating an account or using the site you agree to them. If you don’t agree, please don’t use the site."
    >
      <h2>1. Who can use KiwiTeachers</h2>
      <p>
        KiwiTeachers is for teachers, kaiako, educators and parents supporting learning. You need to be at least 16 to create an account.
        Accounts are personal. Keep your password private and tell us if you think someone else has used your account.
      </p>

      <h2>2. Using resources</h2>
      <p>Unless a resource says otherwise, when you download it you may:</p>
      <ul>
        <li>print and copy it for the students you teach, including in your own school or kura;</li>
        <li>display it in class and share it with your students through your school’s learning platforms;</li>
        <li>adapt it for your own teaching.</li>
      </ul>
      <p>You may not:</p>
      <ul>
        <li>sell, resell or include resources in anything you charge for;</li>
        <li>upload or share resources on other websites, file-sharing services or public social media;</li>
        <li>remove watermarks, attribution or copyright notices;</li>
        <li>bulk download, scrape, or use resources to train machine-learning or AI models.</li>
      </ul>
      <p>
        Signed-in members can download up to {DAILY_DOWNLOAD_LIMIT} different resources per day (resetting at midnight NZ time).
        Downloading something you’ve already downloaded that day doesn’t count again. We may change this allowance.
      </p>

      <h2 id="contributions">3. Sharing your own resources (contributor terms)</h2>
      <p>When you submit a resource:</p>
      <ul>
        <li>
          <strong>You keep your copyright.</strong> You give KiwiTeachers a non-exclusive, worldwide, royalty-free licence to host,
          review, display watermarked previews of, make thumbnails of, and distribute your resource to members for classroom use under
          section 2 above, and to show your name as the contributor.
        </li>
        <li>
          You promise that you created the resource or have permission to share it, that it doesn’t infringe anyone else’s rights
          (including images, fonts and text taken from elsewhere), and that it contains no personal information about students
          or anyone else.
        </li>
        <li>
          Every submission is reviewed before it goes live. We may decline, edit the listing details of, or remove any resource at our
          discretion.
        </li>
        <li>
          You can withdraw a submission that hasn’t been published at any time. To remove a published resource, email <Contact />. We’ll
          remove it within a reasonable time, but copies teachers have already downloaded may continue to be used under these terms.
        </li>
      </ul>

      <h2>4. Ratings and reviews</h2>
      <p>
        Reviews must be honest, respectful and about the resource. Reviews that contain bad language, links, contact details or
        look like spam are automatically held for a moderator. We may hide or remove reviews that break our{" "}
        <Link href="/guidelines">community guidelines</Link>.
      </p>

      <h2>5. Acceptable use</h2>
      <p>Don’t use KiwiTeachers to break the law, harass people, upload malware or harmful files, or try to get around security, download limits or watermarks.</p>

      <h2>6. Our service</h2>
      <p>
        KiwiTeachers is currently free. We work hard to keep it running and the resources accurate, but we provide it “as is”. You’re
        responsible for checking that a resource suits your students. Nothing in these terms limits any rights you have under the
        Consumer Guarantees Act 1993 or Fair Trading Act 1986 where those Acts apply. To the extent permitted by law, we aren’t
        liable for any indirect or consequential loss arising from your use of the site.
      </p>

      <h2>7. Suspending or closing accounts</h2>
      <p>
        We may suspend or close accounts that break these terms. You can delete your account at any time from{" "}
        <Link href="/account#delete">Account settings</Link>.
      </p>

      <h2>8. Changes and law</h2>
      <p>
        We may update these terms. If we make significant changes we’ll let members know on the site. These terms are governed by
        New Zealand law, and New Zealand courts have jurisdiction.
      </p>

      <h2>9. Contact</h2>
      <p>Questions? Email <Contact />.</p>
    </LegalPage>
  );
}
