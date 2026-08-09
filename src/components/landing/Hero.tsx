"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SealDemo } from "./SealDemo";

const FACTS = [
  { value: "16,371", label: "extensions reachable" },
  { value: "0", label: "keys leave the tab" },
  { value: "~400ms", label: "to anchor a seal" },
];

export function Hero() {
  const reduce = useReducedMotion();

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="field-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.09] blur-[120px]"
        style={{ background: "radial-gradient(circle, #E6A94E 0%, transparent 68%)" }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <motion.a
            {...rise(0)}
            href="#mechanism"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:border-line-strong hover:text-paper"
          >
            <span className="size-1.5 rounded-full bg-verdigris" />
            Running on Solana devnet
            <span className="text-faint">·</span>
            <span className="text-faint">read the mechanism</span>
          </motion.a>

          <motion.h1
            {...rise(0.06)}
            className="mt-6 text-[clamp(2.6rem,6.2vw,4.1rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-paper"
          >
            A code workspace that
            <br />
            <span className="brass-text">signs its own work.</span>
          </motion.h1>

          <motion.p
            {...rise(0.12)}
            className="mt-6 max-w-[560px] text-[16.5px] leading-[1.65] text-muted"
          >
            Agents now write a large share of the code that ships, and almost none of
            it carries a record of who wrote it or under what instruction. Marque is a
            browser IDE that closes that gap: every patch an agent produces is hashed,
            signed with a key that never leaves your tab, and anchored on Solana. The
            history of a file becomes something you can check instead of something you
            take on faith.
          </motion.p>

          <motion.div {...rise(0.18)} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/studio"
              className="rounded-[6px] bg-brass px-4 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-brass-hi active:scale-[0.985]"
            >
              Open the workbench
            </Link>
            <a
              href="#mechanism"
              className="rounded-[6px] border border-line-strong px-4 py-2.5 text-sm text-muted transition-colors duration-150 hover:border-brass hover:text-paper"
            >
              How the seal works
            </a>
          </motion.div>

          <motion.dl
            {...rise(0.24)}
            className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6"
          >
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt className="font-mono text-[19px] tabular-nums text-paper">
                  {f.value}
                </dt>
                <dd className="mt-0.5 text-[12.5px] text-faint">{f.label}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="lg:pl-4"
        >
          <SealDemo />
          <p className="mt-3 text-center text-[12px] text-faint">
            The digest above is computed live in your browser from the patch shown.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
