import type { Metadata } from "next";
import { Deck } from "@/components/deck/Deck";

export const metadata: Metadata = {
  title: "Deck",
  description:
    "Marque in eleven slides: the provenance gap in agent-written code, and what a signed patch ledger does about it.",
};

export default function DeckPage() {
  return <Deck />;
}
