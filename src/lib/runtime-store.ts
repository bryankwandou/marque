"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RUNTIMES, probeRuntime, type Runtime } from "./models";

/**
 * Which backend the agent panel is pointed at, kept in one place so the panel,
 * the palette and the status bar all read the same answer.
 *
 * The choice survives a reload, which matters for the offline case: someone who
 * set this to their own Ollama should not be silently pushed back onto the
 * hosted route the next time they open the tab.
 */

type RuntimeState = {
  runtimeId: string;
  /** Overrides the built-in base URL when someone runs on a different port. */
  customBaseUrl: string;
  /** Model id chosen for the local runtime; hosted models are listed separately. */
  localModel: string;
  /** Result of the last probe. Empty until one has run. */
  detected: string[];
  status: "unknown" | "checking" | "up" | "down";
  error: string | null;

  select: (id: string) => void;
  setBaseUrl: (url: string) => void;
  setLocalModel: (model: string) => void;
  check: () => Promise<void>;
};

export function runtimeFor(id: string): Runtime {
  return RUNTIMES.find((r) => r.id === id) ?? RUNTIMES[0];
}

export const useRuntime = create<RuntimeState>()(
  persist(
    (set, get) => ({
      runtimeId: "hosted",
      customBaseUrl: "",
      localModel: "",
      detected: [],
      status: "unknown",
      error: null,

      select: (id) =>
        set({
          runtimeId: id,
          detected: [],
          status: "unknown",
          error: null,
          customBaseUrl: "",
          localModel: "",
        }),

      setBaseUrl: (url) => set({ customBaseUrl: url, status: "unknown" }),
      setLocalModel: (model) => set({ localModel: model }),

      check: async () => {
        const { runtimeId, customBaseUrl } = get();
        const runtime = runtimeFor(runtimeId);
        if (runtime.kind === "hosted") {
          set({ status: "up", detected: [], error: null });
          return;
        }

        const base = (customBaseUrl || runtime.baseUrl).replace(/\/+$/, "");
        set({ status: "checking", error: null });

        // A runtime that is not running refuses instantly; one that is wedged
        // does not. Four seconds keeps a wedged host from freezing the panel.
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 4000);

        try {
          const detected = await probeRuntime(base, abort.signal);
          set((s) => ({
            detected,
            status: "up",
            error: null,
            localModel:
              detected.includes(s.localModel) ? s.localModel : (detected[0] ?? ""),
          }));
        } catch (err) {
          set({
            status: "down",
            detected: [],
            error:
              err instanceof Error && err.name === "AbortError"
                ? "The runtime did not answer within four seconds."
                : (err as Error).message,
          });
        } finally {
          clearTimeout(timer);
        }
      },
    }),
    {
      name: "marque.runtime.v1",
      partialize: (s) => ({
        runtimeId: s.runtimeId,
        customBaseUrl: s.customBaseUrl,
        localModel: s.localModel,
      }),
    },
  ),
);

/** The base URL the agent should actually call, custom override included. */
export function resolveBaseUrl(runtimeId: string, customBaseUrl: string): string {
  const runtime = runtimeFor(runtimeId);
  return (customBaseUrl || runtime.baseUrl).replace(/\/+$/, "");
}
