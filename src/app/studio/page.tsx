import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Workbench",
  description:
    "The Marque workbench: editor, terminal, agent, and a seal ledger anchored to Solana devnet.",
};

export default function StudioPage() {
  return <Studio />;
}
