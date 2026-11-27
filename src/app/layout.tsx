import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "KiwiTeachers — Teaching resources for Aotearoa classrooms",
    template: "%s · KiwiTeachers",
  },
  description:
    "Quick, printable 1–4 page teaching resources for New Zealand classrooms, from New Entrants to Year 13. Search by year level, learning area and topic.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers renders every page per request, so Next.js can stamp the CSP nonce on its scripts.
  await headers();
  return (
    <html lang="en-NZ" className={`${inter.variable} ${display.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
