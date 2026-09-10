"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Eye, RefreshCw } from "lucide-react";
import { PanelHeader } from "./Explorer";
import { useWorkspace } from "@/lib/workspace";
import { revisions, record, stamp, type Revision } from "@/lib/history";
import { cn } from "@/lib/utils";

const ORIGIN_LABEL: Record<Revision["origin"], string> = {
  edit: "typed",
  agent: "agent",
  restore: "restored",
  create: "created",
  seal: "sealed",
};

/**
 * Every saved version of the open file, newest first, with a way back to any of
 * them. Restoring does not erase anything — it appends the old text as a new
 * version, so the thing you rolled back from is still one row up.
 */
export function HistoryPanel() {
  const activePath = useWorkspace((s) => s.activePath);
  const files = useWorkspace((s) => s.files);
  const update = useWorkspace((s) => s.update);

  const [rows, setRows] = useState<Revision[]>([]);
  const [preview, setPreview] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const current = files.find((f) => f.path === activePath)?.content ?? "";

  const load = useCallback(async () => {
    if (!activePath) {
      setRows([]);
      setState("ok");
      return;
    }
    setState("loading");
    try {
      setRows(await revisions(activePath, 400));
      setState("ok");
    } catch {
      setState("error");
    }
  }, [activePath]);

  useEffect(() => {
    void load();
  }, [load, current]);

  const restore = async (rev: Revision) => {
    update(rev.path, rev.content);
    await record(rev.path, rev.content, "restore");
    setPreview(null);
    await load();
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="History">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] tabular-nums text-faint">
            {rows.length || "—"}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            title="Reload the log"
            aria-label="Reload the log"
            className="text-faint transition-colors duration-150 hover:text-paper"
          >
            <RefreshCw size={11} className={cn(state === "loading" && "animate-spin")} />
          </button>
        </span>
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {state === "error" && (
          <p className="p-3 text-[12px] leading-[1.6] text-muted">
            The revision log could not be opened. Private browsing windows often
            block IndexedDB, which is where it lives.
          </p>
        )}

        {state === "ok" && !activePath && (
          <p className="p-3 text-[12px] text-faint">Open a file to see its versions.</p>
        )}

        {state === "ok" && activePath && rows.length === 0 && (
          <p className="p-3 text-[12px] leading-[1.6] text-faint">
            No versions yet. The first one is written a moment after you stop
            typing.
          </p>
        )}

        {rows.map((rev, i) => {
          const delta = rev.content.length - rev.from;
          const isCurrent = rev.content === current && i === 0;
          const open = preview === rev.id;

          return (
            <div key={rev.id} className="border-b border-line/60">
              <div
                className={cn(
                  "group flex items-center gap-2 px-2.5 py-2 transition-colors duration-150 hover:bg-raised",
                  isCurrent && "bg-brass/5",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-[11.5px] tabular-nums text-paper">
                      {stamp(rev.at)}
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-brass">
                        current
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-faint tabular-nums">
                    <span>{ORIGIN_LABEL[rev.origin]}</span>
                    <span>·</span>
                    <span>{rev.content.length} ch</span>
                    {rev.from > 0 && delta !== 0 && (
                      <span className={delta > 0 ? "text-verdigris" : "text-oxide"}>
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    )}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setPreview(open ? null : (rev.id ?? null))}
                  title="Show this version"
                  aria-label="Show this version"
                  className={cn(
                    "shrink-0 rounded-[4px] p-1 transition-colors duration-150",
                    open ? "text-brass" : "text-faint hover:text-paper",
                  )}
                >
                  <Eye size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => void restore(rev)}
                  disabled={isCurrent}
                  title="Put this version back in the editor"
                  aria-label="Restore this version"
                  className="shrink-0 rounded-[4px] p-1 text-faint transition-colors duration-150 hover:text-brass disabled:opacity-25 disabled:hover:text-faint"
                >
                  <RotateCcw size={11} />
                </button>
              </div>

              {open && (
                <pre className="max-h-56 overflow-auto border-t border-line/60 bg-ink p-2.5 font-mono text-[10.5px] leading-[1.6] text-muted">
                  <code>{rev.content}</code>
                </pre>
              )}
            </div>
          );
        })}
      </div>

      <p className="shrink-0 border-t border-line px-2.5 py-2 font-mono text-[10px] leading-[1.5] text-faint">
        Written automatically. Restoring appends rather than deletes, so nothing
        here is ever lost.
      </p>
    </div>
  );
}
