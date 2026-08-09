"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    title: "The agent writes",
    body: "You ask for a change in the side panel. The model returns a patch scoped to one file, along with a one-line statement of what it altered. Nothing is applied yet.",
    code: `POST /api/agent
model  openai/gpt-oss-120b
scope  src/ledger/settle.ts
patch  6 lines, 2 added, 1 removed`,
  },
  {
    n: "02",
    title: "The patch is reduced to a digest",
    body: "Marque builds a canonical string from the file path, the text before, and the text after, then takes its SHA-256. Two people running this on the same patch get the same 64 characters, which is the whole point.",
    code: `canonical = "marque/v1\\n" + path
          + "\\n---\\n" + before
          + "\\n+++\\n" + after

digest = sha256(canonical)`,
  },
  {
    n: "03",
    title: "You sign it, in the tab",
    body: "An ed25519 session key is generated on first load and stored locally. It signs the digest. The secret half is never transmitted, never logged, and is separate from any wallet holding funds.",
    code: `sig = ed25519.sign(digest, sessionKey)
sent = { digest, sig, pubkey }
kept = { secretKey }   // stays put`,
  },
  {
    n: "04",
    title: "The seal lands on chain",
    body: "The server checks the signature before spending anything. If it verifies, a relayer submits a memo transaction carrying the digest, your public key, and the file path. You get back a transaction you can open in any explorer.",
    code: `verify(sig, digest, pubkey) || reject
memo = { p:"marque/v1", d, a, s, f, g, t }
-> devnet, confirmed
-> explorer.solana.com/tx/...`,
  },
];

export function Mechanism() {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLElement>(null);

  return (
    <section id="mechanism" ref={ref} className="relative border-t border-line py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <SectionHead
          eyebrow="Mechanism"
          title="Four steps between a suggestion and a record"
          lede="No part of this requires trusting Marque. The digest is reproducible from the patch, the signature verifies against a public key you control, and the transaction sits on a public ledger."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
          <ol className="relative">
            <span
              className="absolute left-[15px] top-2 bottom-2 w-px bg-line"
              aria-hidden
            />
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-current={active === i}
                  className="group block w-full pb-8 pl-12 text-left last:pb-0"
                >
                  <span
                    className={cn(
                      "absolute left-0 top-0 grid size-8 place-items-center rounded-full border font-mono text-[11px] transition-all duration-200",
                      active === i
                        ? "border-brass bg-brass text-ink"
                        : "border-line bg-surface text-faint group-hover:border-line-strong group-hover:text-muted",
                    )}
                  >
                    {s.n}
                  </span>
                  <h3
                    className={cn(
                      "text-[17px] font-medium transition-colors duration-200",
                      active === i ? "text-paper" : "text-muted",
                    )}
                  >
                    {s.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-2 max-w-[52ch] text-[14.5px] leading-[1.65] transition-colors duration-200",
                      active === i ? "text-muted" : "text-faint",
                    )}
                  >
                    {s.body}
                  </p>
                </button>
              </li>
            ))}
          </ol>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="edge-lit overflow-hidden rounded-[10px] border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <span className="size-1.5 rounded-full bg-brass" />
                <span className="font-mono text-[11.5px] text-faint">
                  step {STEPS[active].n}
                </span>
              </div>
              <motion.pre
                key={active}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.8] text-muted"
              >
                <code>{STEPS[active].code}</code>
              </motion.pre>
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.6] text-faint">
              Anyone holding the patch and the public key can repeat steps two and
              three offline and compare the result with what the chain says. That is
              the only claim Marque makes, and it is checkable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lede,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn("max-w-[680px]", align === "center" && "mx-auto text-center")}
    >
      <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-brass">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-[clamp(1.75rem,3.4vw,2.4rem)] font-semibold leading-[1.12] tracking-[-0.028em] text-paper">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-[15.5px] leading-[1.68] text-muted">{lede}</p>
      )}
    </motion.div>
  );
}
