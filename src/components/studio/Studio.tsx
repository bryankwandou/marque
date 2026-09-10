"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Files,
  Sparkles,
  ShieldCheck,
  Blocks,
  TerminalSquare,
  PanelBottom,
  Loader2,
  Stamp,
  History,
  Cpu,
  Plug,
  MonitorPlay,
} from "lucide-react";
import { Mark } from "@/components/Logo";
import { Explorer } from "./Explorer";
import { AgentPanel } from "./AgentPanel";
import { LedgerPanel } from "./LedgerPanel";
import { ExtensionsPanel } from "./ExtensionsPanel";
import { HistoryPanel } from "./HistoryPanel";
import { ModelsPanel } from "./ModelsPanel";
import { ConnectorsPanel } from "./ConnectorsPanel";
import { ScreenPanel } from "./ScreenPanel";
import { CommandPalette, type Command } from "./CommandPalette";
import { useSeal } from "./useSeal";
import { useAutosave } from "./useAutosave";
import { useWorkspace } from "@/lib/workspace";
import { stamp, revisions, record, clear as clearHistory } from "@/lib/history";
import { cn } from "@/lib/utils";

// Monaco and xterm are both large and both browser-only.
const EditorPane = dynamic(
  () => import("./EditorPane").then((m) => m.EditorPane),
  {
    ssr: false,
    loading: () => (
      <div className="grid flex-1 place-items-center font-mono text-[12px] text-faint">
        loading editor…
      </div>
    ),
  },
);

const TerminalPane = dynamic(
  () => import("./TerminalPane").then((m) => m.TerminalPane),
  { ssr: false },
);

const VIEWS = [
  { key: "explorer", label: "Explorer", icon: Files, node: <Explorer /> },
  { key: "agent", label: "Agent", icon: Sparkles, node: <AgentPanel /> },
  { key: "seals", label: "Seals", icon: ShieldCheck, node: <LedgerPanel /> },
  { key: "history", label: "History", icon: History, node: <HistoryPanel /> },
  { key: "models", label: "Models", icon: Cpu, node: <ModelsPanel /> },
  {
    key: "extensions",
    label: "Extensions",
    icon: Blocks,
    node: <ExtensionsPanel />,
  },
  {
    key: "connectors",
    label: "Connectors",
    icon: Plug,
    node: <ConnectorsPanel />,
  },
  { key: "screen", label: "Screen", icon: MonitorPlay, node: <ScreenPanel /> },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export function Studio() {
  const [view, setView] = useState<ViewKey>("explorer");
  const [sidebar, setSidebar] = useState(true);
  const [panel, setPanel] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activePath = useWorkspace((s) => s.activePath);
  const seals = useWorkspace((s) => s.seals);
  const { seal, pending, lastError, clearError } = useSeal();
  const { savedAt, pending: saving } = useAutosave();

  const anchored = seals.filter((s) => s.status === "anchored").length;

  const create = useWorkspace((s) => s.create);
  const close = useWorkspace((s) => s.close);
  const update = useWorkspace((s) => s.update);

  /**
   * Step back one saved version. The current text is row zero, so the one to
   * restore is row one; putting it back is itself appended, which means this is
   * reversible in the same panel rather than destructive.
   */
  const rollback = useCallback(async () => {
    if (!activePath) return;
    const rows = await revisions(activePath, 2);
    const previous = rows[1];
    if (!previous) {
      setToast("No earlier version of this file yet");
      setTimeout(() => setToast(null), 2600);
      return;
    }
    update(activePath, previous.content);
    await record(activePath, previous.content, "restore");
    setToast(`Rolled back to ${stamp(previous.at)}`);
    setTimeout(() => setToast(null), 2600);
  }, [activePath, update]);

  const doSeal = useCallback(async () => {
    const result = await seal("manual");
    if (result) {
      setView("seals");
      setToast(`Sealed ${result.file}`);
      setTimeout(() => setToast(null), 2600);
    }
  }, [seal]);

  useEffect(() => {
    if (!lastError) return;
    setToast(lastError);
    const t = setTimeout(() => {
      setToast(null);
      clearError();
    }, 3600);
    return () => clearTimeout(t);
  }, [lastError, clearError]);

  const commands = useMemo<Command[]>(
    () => [
      { id: "seal", label: "Seal the active file", hint: "⌘S", run: () => void doSeal() },
      ...VIEWS.map((v) => ({
        id: `view:${v.key}`,
        label: `View: ${v.label}`,
        hint: "panel",
        run: () => {
          setView(v.key);
          setSidebar(true);
        },
      })),
      {
        id: "panel",
        label: "Toggle the terminal panel",
        hint: "⌘J",
        run: () => setPanel((v) => !v),
      },
      {
        id: "sidebar",
        label: "Toggle the side bar",
        hint: "⌘B",
        run: () => setSidebar((v) => !v),
      },
      {
        id: "file:new",
        label: "New file",
        hint: "workspace",
        run: () => {
          const path = window.prompt("Path for the new file", "src/untitled.ts");
          if (path?.trim()) create(path.trim());
        },
      },
      {
        id: "file:close",
        label: "Close the active file",
        hint: "workspace",
        run: () => activePath && close(activePath),
      },
      {
        id: "file:copy-path",
        label: "Copy the path of the active file",
        hint: "workspace",
        run: () => {
          if (activePath) void navigator.clipboard.writeText(activePath);
        },
      },
      {
        id: "history:undo-save",
        label: "Roll back to the previous saved version",
        hint: "history",
        run: () => void rollback(),
      },
      {
        id: "history:clear",
        label: "Erase the revision log",
        hint: "history",
        run: () => {
          if (window.confirm("Delete every saved version? This cannot be undone.")) {
            void clearHistory().then(() => setToast("Revision log erased"));
          }
        },
      },
    ],
    [doSeal, create, close, activePath, rollback],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        setPanel((v) => !v);
      }
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebar((v) => !v);
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        void doSeal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSeal]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink">
      {/* title bar */}
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-line px-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Marque home">
          <Mark size={18} id="studio" />
          <span className="text-[13px] font-medium tracking-[-0.02em] text-paper">
            Marque
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mx-auto flex w-full max-w-[380px] items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-1 text-[12px] text-faint transition-colors duration-150 hover:border-line-strong"
        >
          <span className="truncate">
            {activePath || "marque-workspace"}
          </span>
          <kbd className="ml-auto shrink-0 rounded-[3px] border border-line-strong px-1 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>
        <button
          type="button"
          onClick={() => void doSeal()}
          disabled={pending}
          className="flex shrink-0 items-center gap-1.5 rounded-[6px] bg-brass px-2.5 py-1 text-[12px] font-medium text-ink transition-[background-color,opacity] duration-150 hover:bg-brass-hi disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Stamp size={12} />
          )}
          {pending ? "Sealing" : "Seal"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* activity bar */}
        <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line py-2">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const on = sidebar && view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                title={v.label}
                aria-label={v.label}
                aria-pressed={on}
                onClick={() => {
                  if (view === v.key) setSidebar((s) => !s);
                  else {
                    setView(v.key);
                    setSidebar(true);
                  }
                }}
                className={cn(
                  "relative grid size-9 place-items-center rounded-[6px] transition-colors duration-150",
                  on ? "text-brass" : "text-faint hover:bg-raised hover:text-muted",
                )}
              >
                {on && (
                  <span className="absolute left-[-6px] h-5 w-[2px] rounded-full bg-brass" />
                )}
                <Icon size={17} strokeWidth={1.6} />
              </button>
            );
          })}
          <button
            type="button"
            title="Toggle terminal"
            aria-label="Toggle terminal"
            onClick={() => setPanel((v) => !v)}
            className={cn(
              "mt-auto grid size-9 place-items-center rounded-[6px] transition-colors duration-150",
              panel ? "text-brass" : "text-faint hover:bg-raised hover:text-muted",
            )}
          >
            <PanelBottom size={17} strokeWidth={1.6} />
          </button>
        </nav>

        {/* side panel */}
        {sidebar && (
          <aside className="w-[290px] shrink-0 border-r border-line bg-surface">
            {VIEWS.find((v) => v.key === view)?.node}
          </aside>
        )}

        {/* editor + terminal */}
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
          <EditorPane />
          {panel && (
            <div className="h-[240px] shrink-0 border-t border-line bg-ink">
              <div className="flex h-8 items-center gap-3 border-b border-line px-3">
                <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.11em] text-brass">
                  <TerminalSquare size={12} />
                  Terminal
                </span>
                <span className="ml-auto font-mono text-[10px] text-faint">
                  Ctrl J to hide
                </span>
              </div>
              <div className="h-[calc(100%-2rem)]">
                <TerminalPane onSeal={() => void doSeal()} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* status bar */}
      <div className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-raised px-3 font-mono text-[11px] text-faint">
        <span className="text-brass">main</span>
        <span className="truncate">{activePath || "no file"}</span>
        <span
          className={cn(saving ? "text-brass" : "text-faint")}
          title="Every version is appended to the local revision log"
        >
          {saving ? "saving" : savedAt ? `saved ${stamp(savedAt)}` : "autosave on"}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-verdigris">
          <span className="size-1.5 rounded-full bg-verdigris" />
          devnet
        </span>
        <span className="tabular-nums">
          {anchored}/{seals.length} anchored
        </span>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      {toast && (
        <div
          role="status"
          className="anim-rise fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-[6px] border border-line-strong bg-raised px-3.5 py-2 font-mono text-[12px] text-paper shadow-[0_16px_48px_-12px_rgb(10_9_8_/_0.8)]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
