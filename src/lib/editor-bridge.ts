"use client";

import type { editor } from "monaco-editor";

/**
 * A handle on the live Monaco instance, kept outside React so the command
 * palette can reach it without the editor having to pass a ref up through three
 * components.
 *
 * The payoff is that the palette lists Monaco's own actions — fold, format,
 * go to symbol, transform case, add a cursor above, and the couple of hundred
 * others it ships — instead of a short hand-written menu that happens to sit on
 * top of an editor that already knows how to do all of it.
 */

let current: editor.IStandaloneCodeEditor | null = null;

export function bindEditor(instance: editor.IStandaloneCodeEditor | null): void {
  current = instance;
}

export function activeEditor(): editor.IStandaloneCodeEditor | null {
  return current;
}

export type EditorAction = {
  id: string;
  label: string;
  run: () => void;
};

/**
 * Monaco's action list, filtered to the ones worth showing. Internal actions
 * carry no label or are prefixed with an underscore, and running them out of
 * context does nothing useful.
 */
export function editorActions(): EditorAction[] {
  const ed = current;
  if (!ed) return [];

  return ed
    .getSupportedActions()
    .filter((a) => a.label && !a.id.startsWith("_"))
    .map((a) => ({
      id: a.id,
      label: a.label,
      run: () => {
        // Monaco refuses to run an action while focus sits in the palette input,
        // so hand focus back first.
        ed.focus();
        void a.run();
      },
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
