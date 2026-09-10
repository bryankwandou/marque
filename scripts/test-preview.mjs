/**
 * Checks the preview builder against the cases that actually break it.
 *
 * The pane itself needs a browser, but the part with the bugs in it — deciding
 * what to inline, what to leave for the network, and what is simply missing —
 * is plain string work and can be checked from a terminal.
 *
 *   node scripts/test-preview.mjs
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = mkdtempSync(join(tmpdir(), "marque-preview-"));

try {
  // Call the compiler's own entry point rather than the npx shim, which behaves
  // differently on Windows and swallows the exit code in a shell wrapper.
  execFileSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "src/lib/preview.ts",
      "--rootDir",
      "src/lib",
      "--outDir",
      out,
      "--module",
      "commonjs",
      "--target",
      "es2020",
      "--esModuleInterop",
      "--skipLibCheck",
    ],
    { stdio: "pipe" },
  );
} catch {
  // preview.ts pulls in types from files with their own compiler complaints.
  // The emit still happens, which is all this needs.
}

const compiled = join(out, "preview.js");
if (!existsSync(compiled)) {
  console.error("tsc produced no output at " + compiled);
  process.exit(1);
}

const { buildDocument, resolvePath, previewable } = await import(
  pathToFileURL(compiled).href
);

const files = [
  {
    path: "preview/index.html",
    language: "html",
    content:
      '<!doctype html><html><head><link rel="stylesheet" href="style.css">' +
      '<link rel="icon" href="https://cdn.example/x.ico"></head><body><h1>hi</h1>' +
      '<script src="main.js"></script>' +
      '<script src="https://cdn.example/lib.js"></script></body></html>',
  },
  { path: "preview/style.css", language: "css", content: "body{color:red}" },
  { path: "preview/main.js", language: "javascript", content: "console.log(1)" },
  { path: "README.md", language: "markdown", content: "x" },
];

const built = buildDocument(files, "preview/index.html");
const absent = buildDocument(
  [{ path: "i.html", language: "html", content: '<link rel=stylesheet href="gone.css">' }],
  "i.html",
);

const checks = [
  ["local stylesheet inlined", built.html.includes("body{color:red}")],
  ["local script inlined", built.html.includes("console.log(1)")],
  ["remote script left for the network", built.html.includes("cdn.example/lib.js")],
  ["remote link left for the network", built.html.includes("cdn.example/x.ico")],
  ["console bridge injected", built.html.includes("__marque")],
  [
    "inlined list is exact",
    JSON.stringify(built.inlined) ===
      JSON.stringify(["preview/style.css", "preview/main.js"]),
  ],
  ["nothing falsely reported missing", built.missing.length === 0],
  ["only html offered as an entry", JSON.stringify(previewable(files)) === JSON.stringify(["preview/index.html"])],
  ["parent directory resolves", resolvePath("a/b/c.html", "../d.css") === "a/d.css"],
  ["same directory resolves", resolvePath("a/b/c.html", "./d.css") === "a/b/d.css"],
  ["absolute url untouched", resolvePath("a/b.html", "https://x/y.css") === "https://x/y.css"],
  ["absent local file reported", absent.missing.includes("gone.css")],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

rmSync(out, { recursive: true, force: true });

console.log(failed === 0 ? "\nRESULT: preview builder verified" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
