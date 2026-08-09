"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Files,
  TerminalSquare,
  Blocks,
  Sparkles,
  ShieldCheck,
  GitBranch,
} from "lucide-react";
import { SectionHead } from "./Mechanism";
import { cn } from "@/lib/utils";

/**
 * A light-weight illustration of the real workbench. Monaco is deliberately not
 * loaded here — this section exists to show the layout, not to be the editor.
 */

const VIEWS = [
  { key: "explorer", label: "Explorer", icon: Files },
  { key: "agent", label: "Agent", icon: Sparkles },
  { key: "ledger", label: "Seals", icon: ShieldCheck },
  { key: "extensions", label: "Extensions", icon: Blocks },
  { key: "terminal", label: "Terminal", icon: TerminalSquare },
  { key: "source", label: "Source control", icon: GitBranch },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

const PANELS: Record<ViewKey, { title: string; rows: [string, string][] }> = {
  explorer: {
    title: "marque-workspace",
    rows: [
      ["src/ledger/settle.ts", "modified"],
      ["src/ledger/fees.ts", ""],
      ["src/lib/seal.ts", "sealed"],
      ["src/app/page.tsx", ""],
      ["package.json", ""],
      ["README.md", ""],
    ],
  },
  agent: {
    title: "openai/gpt-oss-120b",
    rows: [
      ["Replace the hardcoded fee with the schedule lookup", "you"],
      ["Patch scoped to settle.ts, 2 added, 1 removed", "agent"],
      ["Digest 9f3c…a41e computed over the patch", "marque"],
      ["Awaiting your signature", "marque"],
    ],
  },
  ledger: {
    title: "Seals in this workspace",
    rows: [
      ["settle.ts · 9f3c…a41e", "anchored"],
      ["fees.ts · 2b07…cc19", "anchored"],
      ["seal.ts · 74de…0f83", "anchored"],
      ["page.tsx · e105…7ab2", "local"],
    ],
  },
  extensions: {
    title: "open-vsx.org",
    rows: [
      ["Pyrefly — Python tooling", "77.5M"],
      ["ESLint", "41.2M"],
      ["Prettier", "38.9M"],
      ["Docker", "22.4M"],
      ["GitLens", "19.8M"],
      ["Rust Analyzer", "11.3M"],
    ],
  },
  terminal: {
    title: "bash — marque-workspace",
    rows: [
      ["$ marque seal --file src/ledger/settle.ts", ""],
      ["digest   9f3c8b21…a41e", ""],
      ["signed   by 7Kq2…mNx4", ""],
      ["anchored slot 482036511", "ok"],
      ["$ ", ""],
    ],
  },
  source: {
    title: "main · 2 changes",
    rows: [
      ["src/ledger/settle.ts", "M"],
      ["src/ledger/fees.ts", "A"],
    ],
  },
};

export function Workbench() {
  const [view, setView] = useState<ViewKey>("agent");

  return (
    <section id="workbench" className="border-t border-line py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <SectionHead
          eyebrow="Workbench"
          title="The layout every editor converged on, and one panel none of them have"
          lede="Activity bar, side panel, editor, terminal. The muscle memory carries over intact. The addition is a seal ledger that records every patch an agent produced in this workspace and whether it made it on chain."
        />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="edge-lit mt-12 overflow-hidden rounded-[10px] border border-line bg-surface shadow-[0_16px_48px_-12px_rgb(10_9_8_/_0.65)]"
        >
          {/* title bar */}
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <div className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
            </div>
            <span className="mx-auto font-mono text-[11.5px] text-faint">
              settle.ts — marque-workspace
            </span>
          </div>

          <div className="flex min-h-[340px]">
            {/* activity bar */}
            <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line py-2">
              {VIEWS.map((v) => {
                const Icon = v.icon;
                const on = view === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setView(v.key)}
                    title={v.label}
                    aria-label={v.label}
                    aria-pressed={on}
                    className={cn(
                      "relative grid size-9 place-items-center rounded-[6px] transition-colors duration-150",
                      on
                        ? "text-brass"
                        : "text-faint hover:bg-raised hover:text-muted",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId="wb-rail"
                        className="absolute -left-[5px] h-5 w-[2px] rounded-full bg-brass"
                      />
                    )}
                    <Icon size={17} strokeWidth={1.6} />
                  </button>
                );
              })}
            </div>

            {/* side panel */}
            <div className="w-[260px] shrink-0 border-r border-line">
              <div className="border-b border-line px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
                {VIEWS.find((v) => v.key === view)?.label}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.2 }}
                  className="p-2"
                >
                  <p className="px-2 pb-2 font-mono text-[11px] text-faint">
                    {PANELS[view].title}
                  </p>
                  <ul className="space-y-0.5">
                    {PANELS[view].rows.map(([label, tag], i) => (
                      <li
                        key={label + i}
                        className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-[12px] text-muted transition-colors duration-150 hover:bg-raised"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">
                          {label}
                        </span>
                        {tag && (
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[10px]",
                              tag === "anchored" || tag === "ok"
                                ? "text-verdigris"
                                : tag === "modified" || tag === "M"
                                  ? "text-brass"
                                  : "text-faint",
                            )}
                          >
                            {tag}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* editor */}
            <div className="min-w-0 flex-1">
              <div className="flex border-b border-line">
                <span className="border-r border-line bg-raised px-3 py-2 font-mono text-[11.5px] text-paper">
                  settle.ts
                </span>
                <span className="border-r border-line px-3 py-2 font-mono text-[11.5px] text-faint">
                  fees.ts
                </span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.85] text-muted">
                <code>{`import { feeSchedule } from "./fees";
import { ledger } from "./ledger";

export async function settle(order: Order) {
`}
                  <span className="text-verdigris">{`  const fee = feeSchedule.resolve(order.tier);
  assert(fee <= order.total * 0.05, "fee ceiling");
`}</span>
                  {`  return ledger.commit(order, fee);
}`}
                </code>
              </pre>
            </div>
          </div>

          {/* status bar */}
          <div className="flex items-center gap-4 border-t border-line bg-raised px-3 py-1.5 font-mono text-[11px] text-faint">
            <span className="text-brass">main</span>
            <span>TypeScript</span>
            <span>UTF-8</span>
            <span className="ml-auto flex items-center gap-1.5 text-verdigris">
              <span className="size-1.5 rounded-full bg-verdigris" />
              devnet
            </span>
            <span>4 seals</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
