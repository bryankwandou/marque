import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copies Monaco's AMD build into public/ so the editor is served from our own
 * origin rather than a CDN. This is what makes the workbench usable with no
 * network, and it keeps the loader's own worker handling intact — bundling
 * Monaco's workers through webpack is considerably more fragile.
 *
 * Runs from the `prebuild` and `predev` scripts.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "monaco-editor", "min", "vs");
const to = join(root, "public", "monaco", "vs");

try {
  await stat(from);
} catch {
  console.warn("[monaco] node_modules/monaco-editor/min/vs not found; skipping.");
  process.exit(0);
}

await rm(to, { recursive: true, force: true });
await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });

console.log("[monaco] copied min/vs -> public/monaco/vs");
