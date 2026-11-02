import type { ReactNode } from "react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <main className="bg-cream min-h-screen">{children}</main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
