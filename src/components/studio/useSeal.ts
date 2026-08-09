"use client";

import { useCallback, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import {
  anchorSeal,
  digestPatch,
  loadSessionKey,
  signDigest,
  type Seal,
} from "@/lib/seal";

/**
 * Seals the active file: hash the patch, sign it locally, then ask the server
 * to anchor it. Each stage updates the ledger entry so the UI can show where a
 * seal actually is rather than a spinner that means nothing.
 */
export function useSeal() {
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const seal = useCallback(async (agent = "manual") => {
    const store = useWorkspace.getState();
    const file = store.files.find((f) => f.path === store.activePath);

    if (!file) {
      setLastError("Open a file before sealing.");
      return null;
    }

    const before = file.sealedAt ?? "";
    if (before === file.content) {
      setLastError("Nothing has changed since the last seal.");
      return null;
    }

    setPending(true);
    setLastError(null);

    try {
      const key = loadSessionKey();
      const digest = await digestPatch(file.path, before, file.content);
      const signature = signDigest(digest, key);

      const entry: Seal = {
        id: `${digest.slice(0, 12)}-${Date.now()}`,
        file: file.path,
        digest,
        signature,
        author: key.publicKey,
        agent,
        summary: summarise(before, file.content),
        createdAt: new Date().toISOString(),
        status: "anchoring",
      };

      store.addSeal(entry);
      store.markSealed(file.path, file.content);

      try {
        const res = await anchorSeal(entry);
        useWorkspace.getState().patchSeal(entry.id, {
          status: "anchored",
          txSignature: res.txSignature,
          explorerUrl: res.explorerUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Anchoring failed.";
        useWorkspace.getState().patchSeal(entry.id, {
          status: "failed",
          error: message,
        });
        setLastError(message);
      }

      return entry;
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Could not sign the patch.");
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  return { seal, pending, lastError, clearError: () => setLastError(null) };
}

function summarise(before: string, after: string): string {
  const a = before ? before.split("\n") : [];
  const b = after.split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  const added = b.filter((l) => !setA.has(l) && l.trim()).length;
  const removed = a.filter((l) => !setB.has(l) && l.trim()).length;
  if (!before) return `${b.length} lines, first seal`;
  return `${added} added, ${removed} removed`;
}
