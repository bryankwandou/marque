import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Mechanism } from "@/components/landing/Mechanism";
import { Registry, Honest } from "@/components/landing/Registry";
import { Faq, Cta, Footer } from "@/components/landing/Closing";
import { Workbench } from "@/components/landing/Workbench";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Workbench />
        <Mechanism />
        <Registry />
        <Honest />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
