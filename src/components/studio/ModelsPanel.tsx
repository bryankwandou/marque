"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Copy, Check } from "lucide-react";
import { PanelHeader } from "./Explorer";
import { RUNTIMES, SUGGESTED_LOCAL } from "@/lib/models";
import { useRuntime, runtimeFor, resolveBaseUrl } from "@/lib/runtime-store";
import { cn } from "@/lib/utils";

/**
 * Pick where the agent thinks. The hosted route needs a network; every other
 * entry is a server on the machine in front of you, which is what keeps the
 * agent working offline and lets it reach the GPU or the whole CPU.
 */
export function ModelsPanel() {
  const {
    runtimeId,
    customBaseUrl,
    localModel,
    detected,
    status,
    error,
    select,
    setBaseUrl,
    setLocalModel,
    check,
  } = useRuntime();

  const runtime = runtimeFor(runtimeId);
  const isLocal = runtime.kind === "local";

  // Probe on arrival and whenever the target changes, so the panel opens with
  // an answer rather than a button someone has to go find.
  useEffect(() => {
    void check();
  }, [runtimeId, check]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Models">
        <button
          type="button"
          onClick={() => void check()}
          title="Re-check the runtime"
          aria-label="Re-check the runtime"
          className="text-faint transition-colors duration-150 hover:text-paper"
        >
          <RefreshCw
            size={11}
            className={cn(status === "checking" && "animate-spin")}
          />
        </button>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-1 p-2.5">
          {RUNTIMES.map((r) => {
            const on = r.id === runtimeId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => select(r.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[6px] border px-2.5 py-2 text-left transition-colors duration-150",
                  on
                    ? "border-brass/50 bg-brass/10"
                    : "border-line hover:border-line-strong hover:bg-raised",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-[12.5px]",
                      on ? "text-paper" : "text-muted",
                    )}
                  >
                    {r.label}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-faint">
                    {r.baseUrl || "/api/agent"}
                  </span>
                </span>
                {on && (
                  <span
                    title={status}
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      status === "up" && "bg-verdigris",
                      status === "down" && "bg-oxide",
                      (status === "checking" || status === "unknown") &&
                        "bg-line-strong",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {isLocal && (
          <div className="space-y-3 border-t border-line p-2.5">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.09em] text-faint">
                Endpoint
              </span>
              <input
                value={customBaseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onBlur={() => void check()}
                placeholder={runtime.baseUrl}
                spellCheck={false}
                className="w-full rounded-[6px] border border-line bg-ink px-2 py-1.5 font-mono text-[11px] text-paper outline-none placeholder:text-faint focus:border-line-strong"
              />
            </label>

            {status === "up" && detected.length > 0 && (
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.09em] text-faint">
                  {detected.length} model{detected.length === 1 ? "" : "s"} on disk
                </span>
                <select
                  value={localModel}
                  onChange={(e) => setLocalModel(e.target.value)}
                  className="w-full rounded-[6px] border border-line bg-ink px-2 py-1.5 font-mono text-[11px] text-paper outline-none hover:border-line-strong"
                >
                  {detected.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {status === "up" && detected.length === 0 && (
              <p className="rounded-[6px] border border-line bg-ink px-2.5 py-2 text-[11.5px] leading-[1.6] text-muted">
                The runtime answers but holds no models yet. Pull one from the list
                below and re-check.
              </p>
            )}

            {status === "down" && (
              <div className="space-y-2 rounded-[6px] border border-oxide/30 bg-oxide/10 px-2.5 py-2">
                <p className="font-mono text-[11px] leading-[1.55] text-oxide">
                  {error ?? "No answer."}
                </p>
                <p className="text-[11.5px] leading-[1.6] text-muted">
                  {runtime.hint}
                </p>
              </div>
            )}

            {runtimeId === "ollama" && (
              <OriginHint base={resolveBaseUrl(runtimeId, customBaseUrl)} />
            )}

            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.09em] text-faint">
                Worth pulling
              </p>
              <div className="space-y-1">
                {SUGGESTED_LOCAL.map((m) => (
                  <CopyRow
                    key={m.tag}
                    label={m.tag}
                    command={`ollama pull ${m.tag}`}
                    size={m.size}
                    note={m.note}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {!isLocal && (
          <p className="border-t border-line p-2.5 text-[11.5px] leading-[1.6] text-muted">
            Requests go to this deployment, which holds the provider key. Your files
            are not stored there, but the request does leave the machine. Pick a
            local runtime above to keep every token on disk.
          </p>
        )}
      </div>

      <p className="shrink-0 border-t border-line px-2.5 py-2 font-mono text-[10px] leading-[1.5] text-faint">
        Local runtimes reach the GPU or the full CPU. A browser tab reaches
        neither, which is why the weights live outside it.
      </p>
    </div>
  );
}

/**
 * Ollama refuses cross-origin calls until the origin is allow-listed, and that
 * is far and away the most common reason the probe fails. Hand over the exact
 * command instead of describing it.
 */
function OriginHint({ base }: { base: string }) {
  // Read during render rather than through an effect. On the server there is no
  // window, and the placeholder is honest about that until hydration replaces it.
  const origin = typeof window === "undefined" ? "this page's origin" : window.location.origin;

  return (
    <div className="rounded-[6px] border border-line bg-ink px-2.5 py-2">
      <p className="mb-1.5 text-[11.5px] leading-[1.6] text-muted">
        Ollama blocks other origins until told otherwise. Start it with:
      </p>
      <CopyRow
        label={`OLLAMA_ORIGINS=${origin} ollama serve`}
        command={`OLLAMA_ORIGINS=${origin} ollama serve`}
        size=""
        note=""
      />
      <p className="mt-1.5 font-mono text-[10px] text-faint">probing {base}</p>
    </div>
  );
}

function CopyRow({
  label,
  command,
  size,
  note,
}: {
  label: string;
  command: string;
  size: string;
  note: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(command).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      title={`Copy: ${command}`}
      className="group flex w-full items-start gap-2 rounded-[5px] border border-line px-2 py-1.5 text-left transition-colors duration-150 hover:border-line-strong hover:bg-raised"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[11px] text-paper">
          {label}
        </span>
        {note && <span className="block truncate text-[11px] text-faint">{note}</span>}
      </span>
      {size && (
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-faint">
          {size}
        </span>
      )}
      <span className="shrink-0 text-faint group-hover:text-brass">
        {copied ? <Check size={11} className="text-verdigris" /> : <Copy size={11} />}
      </span>
    </button>
  );
}
