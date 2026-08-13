"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import { X } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/** Marque's editor theme. Warm-black surfaces, brass for what the agent touched. */
function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("marque", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "C9C2B8", background: "121110" },
      { token: "comment", foreground: "6B655D", fontStyle: "italic" },
      { token: "keyword", foreground: "E6A94E" },
      { token: "string", foreground: "4FB79A" },
      { token: "number", foreground: "D2603F" },
      { token: "type", foreground: "F4CE8C" },
      { token: "type.identifier", foreground: "F4CE8C" },
      { token: "function", foreground: "FAF7F2" },
      { token: "variable", foreground: "C9C2B8" },
      { token: "delimiter", foreground: "8A8378" },
      { token: "tag", foreground: "E6A94E" },
      { token: "attribute.name", foreground: "5B8DEF" },
    ],
    colors: {
      "editor.background": "#121110",
      "editor.foreground": "#C9C2B8",
      "editorLineNumber.foreground": "#4A443E",
      "editorLineNumber.activeForeground": "#A39C92",
      "editor.selectionBackground": "#E6A94E2E",
      "editor.inactiveSelectionBackground": "#E6A94E18",
      "editor.lineHighlightBackground": "#1A181780",
      "editorCursor.foreground": "#E6A94E",
      "editorWhitespace.foreground": "#2A2724",
      "editorIndentGuide.background1": "#262321",
      "editorIndentGuide.activeBackground1": "#3A3532",
      "editorWidget.background": "#1A1817",
      "editorWidget.border": "#262321",
      "editorSuggestWidget.background": "#1A1817",
      "editorSuggestWidget.selectedBackground": "#262321",
      "editorHoverWidget.background": "#1A1817",
      "editorGutter.modifiedBackground": "#E6A94E",
      "editorGutter.addedBackground": "#4FB79A",
      "editorGutter.deletedBackground": "#D2603F",
      "scrollbarSlider.background": "#3A353280",
      "scrollbarSlider.hoverBackground": "#4B453F",
      "scrollbarSlider.activeBackground": "#4B453F",
      "editorBracketMatch.background": "#E6A94E22",
      "editorBracketMatch.border": "#E6A94E55",
    },
  });
}

/**
 * By default @monaco-editor/react pulls Monaco from a CDN. We serve it from our
 * own origin instead — `scripts/copy-monaco.mjs` drops the AMD build into
 * public/monaco during prebuild — so the workbench keeps working with no
 * network, which is the whole promise of an offline-capable editor.
 *
 * The AMD loader spawns its own language workers from that same directory, so
 * nothing has to be threaded through the bundler.
 */
function useLocalMonaco() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loader.config({ paths: { vs: "/monaco/vs" } });
    loader
      .init()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setReady(true));

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

export function EditorPane() {
  const monacoReady = useLocalMonaco();
  const files = useWorkspace((s) => s.files);
  const activePath = useWorkspace((s) => s.activePath);
  const openPaths = useWorkspace((s) => s.openPaths);
  const open = useWorkspace((s) => s.open);
  const close = useWorkspace((s) => s.close);
  const update = useWorkspace((s) => s.update);

  const file = files.find((f) => f.path === activePath);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const onMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor;
    defineTheme(monaco);
    monaco.editor.setTheme("marque");
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* tab strip */}
      <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-line">
        {openPaths.map((p) => {
          const on = p === activePath;
          const name = p.split("/").pop();
          return (
            <div
              key={p}
              className={cn(
                "group flex shrink-0 items-center gap-2 border-r border-line px-3 transition-colors duration-150",
                on
                  ? "bg-surface text-paper"
                  : "bg-ink text-faint hover:text-muted",
              )}
            >
              {on && <span className="absolute mt-[-30px] h-[2px] w-0 bg-brass" />}
              <button
                type="button"
                onClick={() => open(p)}
                className="font-mono text-[12px]"
                title={p}
              >
                {name}
              </button>
              <button
                type="button"
                aria-label={`Close ${name}`}
                onClick={() => close(p)}
                className="rounded-[3px] p-0.5 opacity-0 transition-opacity duration-150 hover:bg-line-strong group-hover:opacity-100"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1">
        {!monacoReady ? (
          <div className="grid h-full place-items-center font-mono text-[12px] text-faint">
            preparing editor…
          </div>
        ) : file ? (
          <Editor
            key={file.path}
            height="100%"
            path={file.path}
            language={file.language}
            value={file.content}
            onChange={(v) => update(file.path, v ?? "")}
            onMount={onMount}
            loading={
              <span className="font-mono text-[12px] text-faint">
                loading editor…
              </span>
            }
            options={{
              fontFamily:
                "var(--font-mono-jb), ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: 13,
              lineHeight: 1.7,
              fontLigatures: true,
              minimap: { enabled: true, renderCharacters: false, maxColumn: 70 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              renderLineHighlight: "line",
              scrollBeyondLastLine: false,
              padding: { top: 14, bottom: 60 },
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              tabSize: 2,
              wordWrap: "on",
              automaticLayout: true,
              scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            }}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <p className="font-mono text-[12.5px] text-faint">No file open</p>
        <p className="mt-2 text-[12.5px] text-faint">
          Pick one from the explorer, or press{" "}
          <kbd className="rounded-[4px] border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-muted">
            Ctrl K
          </kbd>
        </p>
      </div>
    </div>
  );
}
