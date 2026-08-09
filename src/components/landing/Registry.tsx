"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SectionHead } from "./Mechanism";
import { compactNumber, cn } from "@/lib/utils";
import type { Extension } from "@/app/api/extensions/route";

/**
 * Pulls live from Open VSX so the number on the page is the number in the
 * registry today, not a figure someone typed in once.
 */
export function Registry() {
  const [items, setItems] = useState<Extension[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/extensions?size=12")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setState("error");
          return;
        }
        setItems(d.extensions ?? []);
        setTotal(d.total ?? null);
        setState("ok");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="registry" className="border-t border-line py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <SectionHead
          eyebrow="Extensions"
          title={
            total
              ? `${total.toLocaleString("en-US")} extensions, none of them bundled`
              : "The registry, queried live"
          }
          lede="Marque reads Open VSX — the same open registry VSCodium, Gitpod and Theia use. Nothing is vendored into this repository and nothing is scraped from a proprietary marketplace, so the catalogue below is whatever the registry holds at the moment you loaded this page."
        />

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state === "loading" &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[104px] animate-pulse rounded-[10px] border border-line bg-surface"
              />
            ))}

          {state === "error" && (
            <p className="col-span-full rounded-[10px] border border-line bg-surface p-5 text-sm text-muted">
              The registry did not answer. The workbench falls back to a cached list
              when this happens, so extension search keeps working offline.
            </p>
          )}

          {state === "ok" &&
            items.map((e, i) => (
              <motion.a
                key={e.id}
                href={e.page}
                target="_blank"
                rel="noreferrer noopener"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(i, 8) * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="edge-lit group rounded-[10px] border border-line bg-surface p-4 transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-raised"
              >
                <div className="flex items-start gap-3">
                  {e.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.icon}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      className="size-8 shrink-0 rounded-[6px] object-contain"
                    />
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded-[6px] border border-line font-mono text-[13px] text-faint">
                      {e.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-[14px] font-medium text-paper">
                        {e.displayName}
                      </h3>
                      {e.verified && (
                        <span
                          title="Verified publisher"
                          className="size-1.5 shrink-0 rounded-full bg-verdigris"
                        />
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-faint">
                      {e.namespace}
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-[12.5px] leading-[1.55] text-muted">
                  {e.description || "No description published."}
                </p>
                <p className="mt-2.5 font-mono text-[11px] tabular-nums text-faint">
                  {compactNumber(e.downloadCount)} installs · v{e.version}
                </p>
              </motion.a>
            ))}
        </div>

        <p className="mt-6 text-[12.5px] text-faint">
          Search, filter and install run inside the workbench. Extensions that need a
          Node host are marked as such rather than failing quietly.
        </p>
      </div>
    </section>
  );
}

const ROWS = [
  {
    capability: "Runs with nothing installed",
    marque: true,
    note: "Opens in a tab. No download, no licence key.",
  },
  {
    capability: "Open registry, not a walled marketplace",
    marque: true,
    note: "Open VSX. Terms permit third-party clients.",
  },
  {
    capability: "Cryptographic record of agent edits",
    marque: true,
    note: "Nothing else on this list does this at all.",
  },
  {
    capability: "Bring your own model endpoint",
    marque: true,
    note: "Any OpenAI-compatible base URL.",
  },
  {
    capability: "Signing key isolated from wallet",
    marque: true,
    note: "Session key is ed25519, generated per browser.",
  },
  {
    capability: "Native desktop build",
    marque: false,
    note: "Browser first. Desktop is not shipped.",
  },
  {
    capability: "Language servers for every language",
    marque: false,
    note: "TypeScript, JSON and CSS today.",
  },
];

export function Honest() {
  return (
    <section id="comparison" className="border-t border-line py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <SectionHead
          eyebrow="Scope"
          title="What is built, and what is not"
          lede="A hackathon project that claims parity with a decade-old editor is lying. Here is the actual line between what runs today and what does not."
        />

        <div className="mt-12 overflow-hidden rounded-[10px] border border-line">
          {ROWS.map((r, i) => (
            <motion.div
              key={r.capability}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.035 }}
              className={cn(
                "grid items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[24px_minmax(0,1fr)_minmax(0,1fr)]",
                i % 2 === 1 && "bg-surface/50",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full border",
                  r.marque
                    ? "border-verdigris/40 bg-verdigris/10 text-verdigris"
                    : "border-line-strong text-faint",
                )}
                aria-label={r.marque ? "Shipped" : "Not shipped"}
              >
                {r.marque ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <path
                      d="M1.5 5.2 L3.9 7.6 L8.5 2.6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                ) : (
                  <span className="h-px w-2.5 bg-current" />
                )}
              </span>
              <span
                className={cn(
                  "text-[14.5px]",
                  r.marque ? "text-paper" : "text-muted",
                )}
              >
                {r.capability}
              </span>
              <span className="text-[13px] text-faint">{r.note}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
