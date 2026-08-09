import type { Metadata } from "next";
import { Verifier } from "@/components/Verifier";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Closing";

export const metadata: Metadata = {
  title: "Verify a seal",
  description:
    "Recompute a Marque digest from a patch and check the signature against the public key. Runs entirely in your browser.",
};

export default function VerifyPage() {
  return (
    <>
      <Nav />
      <main className="pt-28 pb-20">
        <Verifier />
      </main>
      <Footer />
    </>
  );
}
