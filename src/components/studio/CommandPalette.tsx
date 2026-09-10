"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { editorActions } from "@/lib/editor-bridge";
import { cn } from "@/lib/utils";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const files = useWorkspace((s) => s.files);
  const openFile = useWorkspace((s) => s.open);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Monaco is read once per open rather than on every keystroke: the action
  // list is a few hundred entries and does not change while the palette is up.
  const [actions, setActions] = useState<Command[]>([]);

  useEffect(() => {
    if (!open) return;
    setActions(
      editorActions().map((a) => ({
        id: `editor:${a.id}`,
        label: a.label,
        hint: "editor",
        run: a.run,
      })),
    );
  }, [open]);

  const all = useMemo<Command[]>(
    () => [
      ...commands,
      ...files.map((f) => ({
        id: `open:${f.path}`,
        label: f.path,
        hint: "file",
        run: () => openFile(f.path),
      })),
      ...actions,
    ],
    [commands, files, openFile, actions],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // With nothing typed, workbench commands and files are what you want —
    // burying them under the editor action list would be useless.
    if (!q) return all.filter((c) => c.hint !== "editor").slice(0, 14);

    const hits = all.filter((c) => c.label.toLowerCase().includes(q));
    // A label that starts with the query is almost always the intended one.
    hits.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.label.length - b.label.length;
    });
    return hits.slice(0, 40);
  }, [all, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const choose = (c: Command | undefined) => {
    if (!c) return;
    c.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/60 pt-[14vh] backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="anim-rise w-full max-w-[560px] overflow-hidden rounded-[10px] border border-line-strong bg-raised shadow-[0_16px_48px_-12px_rgb(10_9_8_/_0.8)]"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              choose(results[index]);
            }
          }}
          placeholder="Type a command or a file name"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[14px] text-paper outline-none placeholder:text-faint"
        />
        <ul className="max-h-[340px] overflow-y-auto py-1">
          {results.length === 0 && (
            <li className="px-4 py-3 text-[12.5px] text-faint">No matches.</li>
          )}
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(c)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors duration-100",
                  i === index ? "bg-brass/10 text-paper" : "text-muted",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-mono">{c.label}</span>
                {c.hint && (
                  <span className="shrink-0 font-mono text-[10.5px] text-faint">
                    {c.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-2 font-mono text-[10px] text-faint">
          {all.length} commands · {actions.length} from the editor itself
        </p>
      </div>
    </div>
  );
}
