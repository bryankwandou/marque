"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
  FilePlus2,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import {
  buildDocument,
  previewable,
  STARTER_HTML,
  STARTER_CSS,
  STARTER_JS,
} from "@/lib/preview";
import { cn } from "@/lib/utils";

type Width = { id: string; label: string; px: number | null; icon: typeof Monitor };

const WIDTHS: Width[] = [
  { id: "fit", label: "Fill the pane", px: null, icon: Monitor },
  { id: "tablet", label: "768px", px: 768, icon: Tablet },
  { id: "phone", label: "390px", px: 390, icon: Smartphone },
];

type LogLine = { level: string; text: string; at: number };

/**
 * A browser for the thing you are building, sitting next to the terminal.
 *
 * It redraws on a delay rather than on every keystroke: rebuilding mid-word
 * means watching a half-written tag render as garbage, and a script that runs on
 * load would run once per character typed.
 */
export function PreviewPane() {
  const files = useWorkspace((s) => s.files);
  const create = useWorkspace((s) => s.create);

  const entries = useMemo(() => previewable(files), [files]);
  const [entry, setEntry] = useState("");
  const [width, setWidth] = useState("fit");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState(files);

  const frame = useRef<HTMLIFrameElement>(null);

  // Keep a selection that still exists. Files get closed and renamed.
  useEffect(() => {
    if (entries.length === 0) {
      if (entry) setEntry("");
      return;
    }
    if (!entries.includes(entry)) setEntry(entries[0]);
  }, [entries, entry]);

  // Debounced snapshot of the workspace. Everything downstream reads this
  // rather than `files`, which is what stops the frame thrashing.
  useEffect(() => {
    const t = setTimeout(() => setSettled(files), 700);
    return () => clearTimeout(t);
  }, [files]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { __marque?: boolean; level?: string; text?: string };
      if (!data?.__marque) return;
      setLogs((prev) =>
        [...prev, { level: data.level ?? "log", text: data.text ?? "", at: Date.now() }].slice(-60),
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const built = useMemo(
    () => (entry ? buildDocument(settled, entry) : null),
    [settled, entry],
  );

  // A reload should start the log clean, otherwise old errors read as current.
  useEffect(() => setLogs([]), [built?.html, nonce]);

  const scaffold = () => {
    create("preview/index.html", STARTER_HTML);
    create("preview/style.css", STARTER_CSS);
    create("preview/main.js", STARTER_JS);
    setEntry("preview/index.html");
  };

  const chosen = WIDTHS.find((w) => w.id === width) ?? WIDTHS[0];

  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2.5">
        <select
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          aria-label="Page to preview"
          disabled={entries.length === 0}
          className="min-w-0 max-w-[220px] rounded-[4px] border border-line bg-ink px-1.5 py-0.5 font-mono text-[10.5px] text-muted outline-none hover:border-line-strong disabled:opacity-40"
        >
          {entries.length === 0 && <option>no html in the workspace</option>}
          {entries.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-0.5">
          {WIDTHS.map((w) => {
            const Icon = w.icon;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setWidth(w.id)}
                title={w.label}
                aria-label={w.label}
                aria-pressed={width === w.id}
                className={cn(
                  "grid size-6 place-items-center rounded-[4px] transition-colors duration-150",
                  width === w.id
                    ? "bg-raised text-brass"
                    : "text-faint hover:text-muted",
                )}
              >
                <Icon size={12} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          title="Reload the frame"
          aria-label="Reload the frame"
          className="grid size-6 place-items-center rounded-[4px] text-faint transition-colors duration-150 hover:text-paper"
        >
          <RefreshCw size={11} />
        </button>

        {entries.length === 0 && (
          <button
            type="button"
            onClick={scaffold}
            className="flex items-center gap-1 rounded-[4px] border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-muted transition-colors duration-150 hover:border-brass hover:text-brass"
          >
            <FilePlus2 size={10} />
            Start a page
          </button>
        )}

        <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">
          sandboxed · no access to this workspace
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="grid min-w-0 flex-1 place-items-center overflow-auto bg-surface p-2">
          {built?.html ? (
            <iframe
              key={`${entry}-${nonce}`}
              ref={frame}
              srcDoc={built.html}
              title="Preview"
              // Scripts run; same-origin is withheld, so the frame lands in an
              // opaque origin and cannot reach anything this tab holds.
              sandbox="allow-scripts allow-forms allow-popups allow-modals"
              className="h-full rounded-[4px] border border-line bg-white"
              style={{
                width: chosen.px ? `${chosen.px}px` : "100%",
                maxWidth: "100%",
              }}
            />
          ) : (
            <p className="font-mono text-[11.5px] text-faint">
              {entries.length === 0
                ? "No HTML file yet. Start a page, or open one from the explorer."
                : "Nothing to render."}
            </p>
          )}
        </div>

        {(logs.length > 0 || (built?.missing.length ?? 0) > 0) && (
          <div className="w-[260px] shrink-0 overflow-y-auto border-l border-line">
            <div className="flex items-center gap-2 border-b border-line px-2 py-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.09em] text-faint">
                Console
              </span>
              <button
                type="button"
                onClick={() => setLogs([])}
                aria-label="Clear the console"
                className="ml-auto text-faint transition-colors duration-150 hover:text-paper"
              >
                <Trash2 size={10} />
              </button>
            </div>

            {built?.missing.map((m) => (
              <p
                key={m}
                className="border-b border-line/60 px-2 py-1 font-mono text-[10.5px] leading-[1.5] text-oxide"
              >
                not in the workspace: {m}
              </p>
            ))}

            {logs.map((l, i) => (
              <p
                key={i}
                className={cn(
                  "border-b border-line/60 px-2 py-1 font-mono text-[10.5px] leading-[1.5] break-words",
                  l.level === "error" && "text-oxide",
                  l.level === "warn" && "text-brass",
                  l.level !== "error" && l.level !== "warn" && "text-muted",
                )}
              >
                {l.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
