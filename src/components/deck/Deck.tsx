"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mark, Wordmark } from "@/components/Logo";
import { cn } from "@/lib/utils";

/**
 * Eleven slides, keyboard driven. Arrow keys or the rail on the right; the URL
 * hash tracks position so a slide can be linked to directly.
 */

type Slide = {
  id: string;
  kicker: string;
  render: () => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    id: "title",
    kicker: "Marque",
    render: () => (
      <div className="text-center">
        <Mark size={64} id="d0" className="mx-auto" />
        <h1 className="mt-8 text-[clamp(2.6rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-paper">
          Code that carries
          <br />
          <span className="brass-text">its own receipt.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-[1.6] text-muted">
          A browser IDE where every patch an agent writes is hashed, signed, and
          anchored on Solana.
        </p>
        <p className="mt-8 font-mono text-[12px] text-faint">
          marque-ide.vercel.app · devnet
        </p>
      </div>
    ),
  },
  {
    id: "shift",
    kicker: "The shift",
    render: () => (
      <Split
        title="Authorship stopped meaning what it used to mean"
        body={[
          "Two years ago a commit was a person's work. Now a large fraction of what lands in a repository was drafted by a model, reviewed in a hurry, and committed under a human name.",
          "Git faithfully records the second half of that story and none of the first. The author field says who pressed the button. It does not say what wrote the diff, which model, or under what instruction.",
        ]}
        aside={
          <Stat
            rows={[
              ["Commit records", "who pushed"],
              ["Commit omits", "what authored"],
              ["Commit omits", "which model"],
              ["Commit omits", "what was asked"],
            ]}
          />
        }
      />
    ),
  },
  {
    id: "cost",
    kicker: "Why it costs something",
    render: () => (
      <Split
        title="The gap only shows up when something breaks"
        body={[
          "A regression traces back to a patch nobody remembers approving. Nobody can say whether it was written by a person, by a model prompted carelessly, or by an agent running unattended overnight.",
          "The same question is now arriving from outside: procurement asking what portion of a codebase is machine-written, auditors asking for a chain of accountability, licence reviews asking where a block of code came from.",
          "There is no artefact to hand over. That is the whole problem.",
        ]}
        aside={
          <Quote text="Provenance already exists for container images and for packages. It stops precisely at the layer where the change actually happens: the patch." />
        }
      />
    ),
  },
  {
    id: "product",
    kicker: "The product",
    render: () => (
      <Split
        title="An IDE that signs its output as it produces it"
        body={[
          "Marque is a code workspace that opens in a tab. Editor, terminal, extension registry, agent panel — the layout every editor converged on, so nothing has to be relearned.",
          "The addition is one panel. Every patch an agent produces gets reduced to a digest, signed with a key that lives only in your browser, and written to Solana. The record is produced at the moment of authorship rather than reconstructed afterwards.",
        ]}
        aside={
          <Stat
            rows={[
              ["Editor", "Monaco"],
              ["Terminal", "xterm.js"],
              ["Extensions", "Open VSX, live"],
              ["Agent", "any OpenAI-compatible"],
              ["Ledger", "Solana devnet"],
            ]}
          />
        }
      />
    ),
  },
  {
    id: "mechanism",
    kicker: "Mechanism",
    render: () => (
      <div className="w-full">
        <h2 className={H2}>Four steps, none of which require trusting us</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Agent writes", "A patch scoped to one file, plus a statement of what changed."],
            ["02", "Patch hashed", "Canonical string of path, before and after. SHA-256."],
            ["03", "Signed in-tab", "ed25519. The secret half never crosses the network."],
            ["04", "Anchored", "Server verifies first, then writes a memo transaction."],
          ].map(([n, t, d]) => (
            <div
              key={n}
              className="edge-lit rounded-[10px] border border-line bg-surface p-5"
            >
              <span className="font-mono text-[11px] text-brass">{n}</span>
              <h3 className="mt-3 text-[15px] font-medium text-paper">{t}</h3>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-[70ch] text-[14.5px] leading-[1.65] text-muted">
          Anyone holding the patch and the public key can repeat steps two and three
          offline and compare the result against the chain. Marque is a convenience
          in that loop, not an authority.
        </p>
      </div>
    ),
  },
  {
    id: "why-chain",
    kicker: "Why a chain",
    render: () => (
      <Split
        title="Because the log has to survive the party being audited"
        body={[
          "The obvious objection is that a database would do. It would not. If the tool vendor can edit history, the record proves nothing about the tool vendor, which is exactly the claim being made.",
          "Solana specifically for cost and finality. A memo transaction confirms in well under a second for a fraction of a cent. That is the difference between sealing every patch and sealing the handful somebody remembered.",
        ]}
        aside={
          <Stat
            rows={[
              ["Confirmation", "sub-second"],
              ["Cost per seal", "~0.000005 SOL"],
              ["Ceiling", "every patch"],
              ["Status", "devnet only"],
            ]}
          />
        }
      />
    ),
  },
  {
    id: "moat",
    kicker: "Defensibility",
    render: () => (
      <Split
        title="The ledger compounds; the editor does not"
        body={[
          "An editor is copyable in a quarter. A signed history of who authored what, accumulated across repositories and teams, is not — it gets more valuable with every seal and cannot be backfilled by a competitor starting later.",
          "The eventual product is not the IDE. It is the verification layer that CI, code review, and procurement query. The IDE is how seals get created in the first place, which is why it has to be the thing people actually work in.",
        ]}
        aside={
          <Quote text="Whoever holds the earliest continuous record of machine authorship holds the reference other tools have to check against." />
        }
      />
    ),
  },
  {
    id: "market",
    kicker: "Who pays",
    render: () => (
      <Split
        title="Three buyers, arriving in order"
        body={[
          "Individual developers pay nothing and generate the seal volume. Teams pay for a shared verification endpoint their CI can call and a dashboard showing machine-authored share by repository.",
          "Regulated buyers — finance, health, defence contractors — pay materially more for an exportable audit trail, because their alternative is a manual attestation process that already costs them more.",
        ]}
        aside={
          <Stat
            rows={[
              ["Individual", "free, always"],
              ["Team", "per seat, verify API"],
              ["Regulated", "audit export, SSO"],
              ["Today", "none of it billed"],
            ]}
          />
        }
      />
    ),
  },
  {
    id: "risks",
    kicker: "What could kill it",
    render: () => (
      <div className="w-full">
        <h2 className={H2}>The three honest failure modes</h2>
        <div className="mt-10 space-y-4">
          {[
            [
              "Nobody is required to care",
              "Provenance is a compliance purchase, and compliance purchases arrive on a regulator's timetable rather than ours. If that demand is five years out, the ledger has no buyer. Mitigation is making the IDE worth using on its own terms.",
            ],
            [
              "A platform ships it as a feature",
              "GitHub could add signed authorship metadata and reach every repository on day one. The counter is that a vendor-owned log is exactly what an auditor discounts, and that the seal has to be created at authorship time, inside the editor.",
            ],
            [
              "The signature proves less than it appears to",
              "A seal attests that a keyholder vouched for a patch, not that they wrote it. That is a real limit and it is stated everywhere in the product. The value is accountability, not surveillance.",
            ],
          ].map(([t, d]) => (
            <div
              key={t}
              className="rounded-[10px] border border-line bg-surface p-5"
            >
              <h3 className="text-[15.5px] font-medium text-oxide">{t}</h3>
              <p className="mt-2 max-w-[80ch] text-[13.5px] leading-[1.65] text-muted">
                {d}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "built",
    kicker: "Built",
    render: () => (
      <Split
        title="What runs right now, and what does not"
        body={[
          "Running: Monaco editor with a custom theme, a working shell over the virtual workspace, live search across the whole Open VSX registry with the top 2,000 pinned so the marketplace still works offline, a streaming agent panel that applies patches per file, and end-to-end sealing against devnet with a transaction you can open in any explorer.",
          "Not running: desktop and mobile builds, language servers beyond what Monaco carries in-browser, extensions that need a Node host, and mainnet. Every on-chain claim in the product names the cluster.",
        ]}
        aside={
          <Stat
            rows={[
              ["Editor + terminal", "shipped"],
              ["Extension search", "shipped"],
              ["Agent + patches", "shipped"],
              ["Devnet seals", "shipped"],
              ["Desktop build", "not built"],
              ["Mainnet", "not built"],
            ]}
          />
        }
      />
    ),
  },
  {
    id: "close",
    kicker: "Close",
    render: () => (
      <div className="text-center">
        <h2 className="text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-paper">
          Open a file. Ask for a change.
          <br />
          <span className="brass-text">Watch it get sealed.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-[48ch] text-[16px] leading-[1.6] text-muted">
          No account, no wallet extension, no install. The workbench mints a signing
          key on first load and writes to devnet at no cost to you.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/studio"
            className="rounded-[6px] bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-brass-hi"
          >
            Open the workbench
          </Link>
          <a
            href="https://github.com/bryankwandou/marque"
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-[6px] border border-line-strong px-5 py-2.5 text-sm text-muted transition-colors duration-150 hover:border-brass hover:text-paper"
          >
            Read the source
          </a>
        </div>
      </div>
    ),
  },
];

const H2 =
  "text-[clamp(1.7rem,3.6vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-paper max-w-[22ch]";

export function Deck() {
  const [i, setI] = useState(0);
  const touchStart = useRef(0);

  const go = useCallback((next: number) => {
    setI((cur) => {
      const clamped = Math.max(0, Math.min(next, SLIDES.length - 1));
      if (clamped !== cur && typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${SLIDES[clamped].id}`);
      }
      return clamped;
    });
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const found = SLIDES.findIndex((s) => s.id === hash);
    if (found >= 0) setI(found);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) {
        e.preventDefault();
        go(i + 1);
      }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(i - 1);
      }
      if (e.key === "Home") go(0);
      if (e.key === "End") go(SLIDES.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  const slide = SLIDES[i];

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-ink"
      onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(dx) > 60) go(dx < 0 ? i + 1 : i - 1);
      }}
    >
      <div className="field-grid pointer-events-none absolute inset-0" aria-hidden />

      <header className="relative z-10 flex h-16 shrink-0 items-center px-6 sm:px-10">
        <Link href="/" aria-label="Marque home">
          <Wordmark size={22} id="deck" />
        </Link>
        <span className="ml-auto font-mono text-[11.5px] uppercase tracking-[0.12em] text-brass">
          {slide.kicker}
        </span>
      </header>

      <main className="relative z-10 grid min-h-0 flex-1 place-items-center px-6 pb-20 sm:px-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-full w-full max-w-[1100px] overflow-y-auto"
          >
            {slide.render()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* rail */}
      <nav
        aria-label="Slides"
        className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 sm:flex"
      >
        {SLIDES.map((s, n) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.kicker}
            aria-current={n === i}
            onClick={() => go(n)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              n === i ? "w-6 bg-brass" : "w-1.5 bg-line-strong hover:bg-muted",
            )}
          />
        ))}
      </nav>

      <footer className="relative z-10 flex h-14 shrink-0 items-center gap-4 border-t border-line px-6 font-mono text-[11.5px] text-faint sm:px-10">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          className="rounded-[4px] px-2 py-1 transition-colors duration-150 hover:text-paper disabled:opacity-30"
        >
          ← prev
        </button>
        <button
          type="button"
          onClick={() => go(i + 1)}
          disabled={i === SLIDES.length - 1}
          className="rounded-[4px] px-2 py-1 transition-colors duration-150 hover:text-paper disabled:opacity-30"
        >
          next →
        </button>
        <span className="ml-auto tabular-nums">
          {String(i + 1).padStart(2, "0")} / {SLIDES.length}
        </span>
      </footer>
    </div>
  );
}

function Split({
  title,
  body,
  aside,
}: {
  title: string;
  body: string[];
  aside: React.ReactNode;
}) {
  return (
    <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
      <div>
        <h2 className={H2}>{title}</h2>
        <div className="mt-6 space-y-4">
          {body.map((p) => (
            <p key={p} className="max-w-[62ch] text-[15px] leading-[1.68] text-muted">
              {p}
            </p>
          ))}
        </div>
      </div>
      <div className="lg:pt-2">{aside}</div>
    </div>
  );
}

function Stat({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="edge-lit overflow-hidden rounded-[10px] border border-line bg-surface">
      {rows.map(([k, v]) => (
        <div
          key={k + v}
          className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0"
        >
          <dt className="text-[13px] text-faint">{k}</dt>
          <dd className="font-mono text-[12.5px] text-paper">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <blockquote className="border-l-2 border-brass pl-5">
      <p className="font-display text-[19px] leading-[1.45] text-paper">{text}</p>
    </blockquote>
  );
}
