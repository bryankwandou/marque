"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sha256Hex } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * The centrepiece of the hero. Walks through the four stages a Marque edit
 * passes on its way to the chain. The digest shown is a real SHA-256 computed
 * in the browser over the diff text below — not a placeholder string.
 */

const DIFF = [
  { kind: "ctx", text: "export async function settle(order: Order) {" },
  { kind: "del", text: "  const fee = order.total * 0.03;" },
  { kind: "add", text: "  const fee = feeSchedule.resolve(order.tier);" },
  { kind: "add", text: "  assert(fee <= order.total * 0.05, 'fee ceiling');" },
  { kind: "ctx", text: "  return ledger.commit(order, fee);" },
  { kind: "ctx", text: "}" },
] as const;

const STAGES = [
  { key: "propose", label: "Agent proposes", detail: "groq · gpt-oss-120b" },
  { key: "digest", label: "Diff hashed", detail: "SHA-256 over the patch" },
  { key: "sign", label: "Signed locally", detail: "ed25519 · key never leaves the tab" },
  { key: "anchor", label: "Anchored", detail: "Solana devnet · memo instruction" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

export function SealDemo() {
  const [stage, setStage] = useState(-1);
  const [digest, setDigest] = useState<string>("");
  const [sig, setSig] = useState<string>("");
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const run = useCallback(async () => {
    clearTimers();
    setRunning(true);
    setStage(-1);
    setDigest("");
    setSig("");

    const patch = DIFF.filter((l) => l.kind !== "ctx")
      .map((l) => `${l.kind === "add" ? "+" : "-"}${l.text}`)
      .join("\n");

    const hash = await sha256Hex(patch);
    // A signature is 64 bytes; we derive a display value from the digest so the
    // demo is deterministic without shipping a private key to the landing page.
    const displaySig = (await sha256Hex(hash + ":ed25519")) + hash.slice(0, 64);

    const push = (fn: () => void, at: number) => {
      timers.current.push(setTimeout(fn, at));
    };

    push(() => setStage(0), 120);
    push(() => {
      setStage(1);
      setDigest(hash);
    }, 900);
    push(() => {
      setStage(2);
      setSig(displaySig);
    }, 1700);
    push(() => setStage(3), 2600);
    push(() => setRunning(false), 3400);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Show the finished state rather than an animation.
      void (async () => {
        const patch = DIFF.filter((l) => l.kind !== "ctx")
          .map((l) => `${l.kind === "add" ? "+" : "-"}${l.text}`)
          .join("\n");
        const hash = await sha256Hex(patch);
        setDigest(hash);
        setSig((await sha256Hex(hash + ":ed25519")) + hash.slice(0, 64));
        setStage(3);
      })();
      return;
    }
    const t = setTimeout(run, 500);
    return () => {
      clearTimeout(t);
      clearTimers();
    };
  }, [run]);

  const reached = (k: StageKey) => stage >= STAGES.findIndex((s) => s.key === k);

  return (
    <div
      className="edge-lit sheen relative overflow-hidden rounded-[10px] border border-line bg-surface"
      data-active={stage === 3 ? "true" : "false"}
    >
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
        </div>
        <span className="ml-1 font-mono text-[11.5px] text-faint">
          ledger/settle.ts
        </span>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="ml-auto rounded-[6px] border border-line-strong px-2.5 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:border-brass hover:text-brass disabled:opacity-40"
        >
          {running ? "running" : "replay"}
        </button>
      </div>

      {/* diff */}
      <div className="px-1 py-2 font-mono text-[12.5px] leading-[1.75]">
        {DIFF.map((line, i) => {
          const isChange = line.kind !== "ctx";
          const visible = !isChange || reached("propose");
          return (
            <div
              key={i}
              className={cn(
                "flex gap-2 px-2 transition-[opacity,transform,background-color] duration-300",
                line.kind === "add" && "bg-verdigris/10 text-verdigris",
                line.kind === "del" && "bg-oxide/10 text-oxide",
                line.kind === "ctx" && "text-muted",
                visible ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
              )}
              style={{ transitionDelay: isChange ? `${i * 70}ms` : "0ms" }}
            >
              <span className="w-6 shrink-0 select-none text-right text-faint">
                {i + 1}
              </span>
              <span className="w-2 shrink-0 select-none">
                {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
              </span>
              <span className="truncate">{line.text}</span>
            </div>
          );
        })}
      </div>

      {/* pipeline */}
      <div className="border-t border-line">
        {STAGES.map((s, i) => {
          const done = stage >= i;
          const active = stage === i;
          return (
            <div
              key={s.key}
              className={cn(
                "flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-b-0 transition-colors duration-300",
                active && "bg-brass/[0.04]",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-300",
                  done
                    ? i === 3
                      ? "border-verdigris bg-verdigris/15 text-verdigris"
                      : "border-brass bg-brass/15 text-brass"
                    : "border-line-strong text-faint",
                  active && i === 3 && "anim-verified",
                )}
              >
                {done ? (
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
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={cn(
                  "text-[13px] transition-colors duration-300",
                  done ? "text-paper" : "text-faint",
                )}
              >
                {s.label}
              </span>
              <span className="ml-auto truncate pl-3 font-mono text-[11px] text-faint">
                {s.detail}
              </span>
            </div>
          );
        })}
      </div>

      {/* receipt */}
      <div className="space-y-1.5 border-t border-line bg-ink/50 px-3 py-3 font-mono text-[11px]">
        <Row label="digest" value={digest} tone="brass" />
        <Row label="signature" value={sig} tone="paper" />
        <Row
          label="slot"
          value={stage >= 3 ? "devnet · confirmed" : ""}
          tone="verdigris"
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brass" | "paper" | "verdigris";
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-16 shrink-0 text-faint">{label}</span>
      <span
        className={cn(
          "truncate transition-opacity duration-500",
          value ? "opacity-100" : "opacity-0",
          tone === "brass" && "text-brass",
          tone === "paper" && "text-muted",
          tone === "verdigris" && "text-verdigris",
        )}
      >
        {value || " "}
      </span>
      {!value && <span className="anim-caret text-faint">▍</span>}
    </div>
  );
}
