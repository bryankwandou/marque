"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { record } from "@/lib/history";

/**
 * Watches the workspace and appends a version of anything that changed once
 * typing stops. The debounce is what keeps the log readable: without it every
 * keystroke would be its own row.
 *
 * The file text itself is already written to localStorage synchronously by the
 * store, so this is not what protects against a crash — it is what makes the
 * crash recoverable to a version you choose rather than only the last one.
 */
export function useAutosave(): { savedAt: number | null; pending: boolean } {
  const files = useWorkspace((s) => s.files);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  // Last text committed for each path, so an unchanged file costs nothing.
  const committed = useRef(new Map<string, string>());

  useEffect(() => {
    const dirty = files.some((f) => committed.current.get(f.path) !== f.content);
    if (!dirty) return;

    setPending(true);
    const timer = setTimeout(() => {
      void (async () => {
        let wrote = false;
        for (const file of files) {
          if (committed.current.get(file.path) === file.content) continue;
          const first = !committed.current.has(file.path);
          committed.current.set(file.path, file.content);
          try {
            const rev = await record(file.path, file.content, first ? "create" : "edit");
            if (rev) wrote = true;
          } catch {
            // A blocked IndexedDB should not take the editor down with it. The
            // History panel says so plainly when it hits the same wall.
          }
        }
        if (wrote) setSavedAt(Date.now());
        setPending(false);
      })();
    }, 1200);

    return () => clearTimeout(timer);
  }, [files]);

  return { savedAt, pending };
}
