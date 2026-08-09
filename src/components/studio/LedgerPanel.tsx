"use client";

import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, ShieldCheck, ShieldAlert, Copy } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { loadSessionKey, rotateSessionKey, verifySeal } from "@/lib/seal";
import { PanelHeader, IconBtn } from "./Explorer";
import { relativeTime, truncateKey, cn } from "@/lib/utils";

export function LedgerPanel() {
  const seals = useWorkspace((s) => s.seals);
  const [pubkey, setPubkey] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setPubkey(loadSessionKey().publicKey);
    } catch {
      setPubkey("");
    }
  }, []);

  const anchored = seals.filter((s) => s.status === "anchored").length;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Seals">
        <IconBtn
          label="Rotate session key"
          onClick={() => {
            if (
              window.confirm(
                "Rotate the signing key? Existing seals stay valid but new ones use a different identity.",
              )
            ) {
              setPubkey(rotateSessionKey().publicKey);
            }
          }}
        >
          <KeyRound size={13} />
        </IconBtn>
      </PanelHeader>

      {/* identity */}
      <div className="shrink-0 border-b border-line p-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.11em] text-faint">
          Session key
        </p>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(pubkey);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="mt-1 flex w-full items-center gap-1.5 text-left font-mono text-[11.5px] text-brass transition-colors duration-150 hover:text-brass-hi"
        >
          <span className="min-w-0 flex-1 truncate">{pubkey || "generating…"}</span>
          <Copy size={11} className="shrink-0" />
        </button>
        <p className="mt-1 font-mono text-[10px] text-faint">
          {copied ? "copied" : "ed25519 · never leaves this browser"}
        </p>

        <div className="mt-2.5 flex gap-4 border-t border-line pt-2.5 font-mono text-[10.5px] text-faint">
          <span>
            <span className="text-paper tabular-nums">{seals.length}</span> sealed
          </span>
          <span>
            <span className="text-verdigris tabular-nums">{anchored}</span> on chain
          </span>
          <span className="ml-auto flex items-center gap-1 text-verdigris">
            <span className="size-1.5 rounded-full bg-verdigris" />
            devnet
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {seals.length === 0 && (
          <p className="p-3 text-[12px] leading-[1.6] text-faint">
            No seals yet. Edit a file and press Seal in the status bar, or type{" "}
            <span className="font-mono text-muted">seal</span> in the terminal.
          </p>
        )}

        {seals.map((s) => {
          const valid = verifySeal(s);
          return (
            <div key={s.id} className="border-b border-line/60 p-2.5">
              <div className="flex items-center gap-1.5">
                {valid ? (
                  <ShieldCheck size={12} className="shrink-0 text-verdigris" />
                ) : (
                  <ShieldAlert size={12} className="shrink-0 text-oxide" />
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-paper">
                  {s.file}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px]",
                    s.status === "anchored" && "text-verdigris",
                    s.status === "anchoring" && "text-brass",
                    s.status === "failed" && "text-oxide",
                    s.status === "local" && "text-faint",
                  )}
                >
                  {s.status}
                </span>
              </div>

              <dl className="mt-1.5 space-y-0.5 font-mono text-[10.5px]">
                <Row label="digest" value={truncateKey(s.digest, 10, 8)} />
                <Row label="signer" value={truncateKey(s.author, 6, 6)} />
                <Row label="agent" value={s.agent} />
                <Row label="change" value={s.summary} />
                <Row label="when" value={relativeTime(s.createdAt)} />
              </dl>

              {s.explorerUrl && (
                <a
                  href={s.explorerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 flex items-center gap-1 font-mono text-[10.5px] text-azurite transition-colors duration-150 hover:text-paper"
                >
                  <ExternalLink size={10} />
                  {truncateKey(s.txSignature ?? "", 8, 8)}
                </a>
              )}

              {s.error && (
                <p className="mt-1.5 font-mono text-[10.5px] leading-[1.5] text-oxide">
                  {s.error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-12 shrink-0 text-faint">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-muted">{value}</dd>
    </div>
  );
}
