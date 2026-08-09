"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Seal } from "./seal";

/**
 * An in-browser workspace. Files live in memory and are persisted to
 * localStorage, so a reload lands you back where you were without any server
 * holding your code.
 */

export type FileNode = {
  path: string;
  content: string;
  language: string;
  /** Content at the last seal, used to build the next patch. */
  sealedAt?: string;
};

export const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  html: "html",
  md: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  sh: "shell",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  sql: "sql",
};

export function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXT[ext] ?? "plaintext";
}

const SEED: FileNode[] = [
  {
    path: "src/ledger/settle.ts",
    language: "typescript",
    content: `import { feeSchedule } from "./fees";
import { ledger } from "./ledger";

export type Order = {
  id: string;
  total: number;
  tier: "standard" | "priority";
};

/**
 * Settles an order against the ledger.
 *
 * Ask the agent panel to replace the hardcoded fee with a schedule lookup,
 * then seal the patch. The digest you get back is reproducible from the
 * before/after text alone.
 */
export async function settle(order: Order) {
  const fee = order.total * 0.03;
  return ledger.commit(order, fee);
}
`,
  },
  {
    path: "src/ledger/fees.ts",
    language: "typescript",
    content: `type Tier = "standard" | "priority";

const TABLE: Record<Tier, number> = {
  standard: 0.03,
  priority: 0.015,
};

export const feeSchedule = {
  resolve(tier: Tier) {
    return TABLE[tier];
  },
};
`,
  },
  {
    path: "README.md",
    language: "markdown",
    content: `# Marque workspace

Everything here lives in your browser. Nothing is uploaded.

1. Open a file from the explorer.
2. Describe a change in the agent panel.
3. Apply the patch, then press Seal.

The seal hashes the patch, signs it with a key generated in this tab, and
writes the record to Solana devnet. The transaction link is real — open it.
`,
  },
];

type WorkspaceState = {
  files: FileNode[];
  activePath: string;
  openPaths: string[];
  seals: Seal[];
  ready: boolean;

  open: (path: string) => void;
  close: (path: string) => void;
  update: (path: string, content: string) => void;
  create: (path: string, content?: string) => void;
  remove: (path: string) => void;
  markSealed: (path: string, content: string) => void;
  addSeal: (seal: Seal) => void;
  patchSeal: (id: string, patch: Partial<Seal>) => void;
  reset: () => void;
};

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      files: SEED,
      activePath: SEED[0].path,
      openPaths: [SEED[0].path],
      seals: [],
      ready: false,

      open: (path) =>
        set((s) => ({
          activePath: path,
          openPaths: s.openPaths.includes(path)
            ? s.openPaths
            : [...s.openPaths, path],
        })),

      close: (path) =>
        set((s) => {
          const openPaths = s.openPaths.filter((p) => p !== path);
          return {
            openPaths,
            activePath:
              s.activePath === path
                ? (openPaths[openPaths.length - 1] ?? "")
                : s.activePath,
          };
        }),

      update: (path, content) =>
        set((s) => ({
          files: s.files.map((f) => (f.path === path ? { ...f, content } : f)),
        })),

      create: (path, content = "") =>
        set((s) => {
          if (s.files.some((f) => f.path === path)) return s;
          return {
            files: [
              ...s.files,
              { path, content, language: languageFor(path) },
            ].sort((a, b) => a.path.localeCompare(b.path)),
            openPaths: [...s.openPaths, path],
            activePath: path,
          };
        }),

      remove: (path) =>
        set((s) => ({
          files: s.files.filter((f) => f.path !== path),
          openPaths: s.openPaths.filter((p) => p !== path),
          activePath: s.activePath === path ? "" : s.activePath,
        })),

      markSealed: (path, content) =>
        set((s) => ({
          files: s.files.map((f) =>
            f.path === path ? { ...f, sealedAt: content } : f,
          ),
        })),

      addSeal: (seal) => set((s) => ({ seals: [seal, ...s.seals].slice(0, 200) })),

      patchSeal: (id, patch) =>
        set((s) => ({
          seals: s.seals.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),

      reset: () =>
        set({
          files: SEED,
          activePath: SEED[0].path,
          openPaths: [SEED[0].path],
          seals: [],
        }),
    }),
    {
      name: "marque.workspace.v1",
      partialize: (s) => ({
        files: s.files,
        activePath: s.activePath,
        openPaths: s.openPaths,
        seals: s.seals,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.ready = true;
      },
    },
  ),
);

/** File paths grouped into a tree for the explorer. */
export type TreeNode = {
  name: string;
  path: string;
  children?: TreeNode[];
};

export function buildTree(files: FileNode[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/");
    let level = root;
    let prefix = "";

    parts.forEach((part, i) => {
      prefix = prefix ? `${prefix}/${part}` : part;
      const isLeaf = i === parts.length - 1;
      let node = level.find((n) => n.name === part);

      if (!node) {
        node = isLeaf
          ? { name: part, path: prefix }
          : { name: part, path: prefix, children: [] };
        level.push(node);
      }
      if (!isLeaf) {
        node.children ??= [];
        level = node.children;
      }
    });
  }

  // Directories before files, alphabetical within each group.
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n))
      .sort((a, b) => {
        const aDir = a.children ? 0 : 1;
        const bDir = b.children ? 0 : 1;
        return aDir - bDir || a.name.localeCompare(b.name);
      });

  return sort(root);
}
