"use client";

import type { FileNode } from "./workspace";

/**
 * The preview browser.
 *
 * An HTML file in the workspace is assembled into one self-contained document —
 * local stylesheets and scripts pulled in from the virtual filesystem, since
 * there is no server to fetch them from — and handed to a sandboxed iframe.
 *
 * The sandbox is `allow-scripts` without `allow-same-origin`, which is the pair
 * that matters: the page can run, and it lands in an opaque origin, so it cannot
 * read the workbench's localStorage, its session key, or any connector token.
 * Granting both together would undo the sandbox entirely.
 */

/** Resolve a relative href against the directory holding the entry file. */
export function resolvePath(fromPath: string, href: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith("//")) return href;

  const base = fromPath.split("/").slice(0, -1);
  const parts = href.replace(/^\.\//, "").split("/");

  for (const part of parts) {
    if (part === "..") base.pop();
    else if (part && part !== ".") base.push(part);
  }
  return base.join("/");
}

/**
 * Captures console output and uncaught errors from inside the frame and posts
 * them out. Without this the preview is a black box: a script that throws just
 * renders nothing and says nothing about why.
 */
const BRIDGE = `<script>(function(){
  var send = function(level, args){
    try {
      parent.postMessage({ __marque: true, level: level, text: Array.prototype.map.call(args, function(a){
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(" ") }, "*");
    } catch (e) {}
  };
  ["log","warn","error","info"].forEach(function(level){
    var original = console[level];
    console[level] = function(){ send(level, arguments); original.apply(console, arguments); };
  });
  window.addEventListener("error", function(e){ send("error", [e.message + " (" + e.lineno + ":" + e.colno + ")"]); });
  window.addEventListener("unhandledrejection", function(e){ send("error", ["Unhandled rejection: " + e.reason]); });
})();</script>`;

export type Built = { html: string; inlined: string[]; missing: string[] };

/**
 * Inline what the entry file references. Anything absolute is left alone so a
 * CDN font or image still loads; anything local that is not in the workspace is
 * reported rather than silently dropped, because a 404 inside a sandboxed frame
 * is otherwise invisible.
 */
export function buildDocument(files: FileNode[], entryPath: string): Built {
  const entry = files.find((f) => f.path === entryPath);
  if (!entry) return { html: "", inlined: [], missing: [entryPath] };

  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const inlined: string[] = [];
  const missing: string[] = [];

  const take = (href: string): string | null => {
    if (/^[a-z]+:/i.test(href) || href.startsWith("//")) return null;
    const resolved = resolvePath(entryPath, href);
    const content = byPath.get(resolved);
    if (content === undefined) {
      missing.push(resolved);
      return null;
    }
    inlined.push(resolved);
    return content;
  };

  let html = entry.content;

  // <link rel="stylesheet" href="...">
  html = html.replace(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    (tag, href: string) => {
      if (!/stylesheet/i.test(tag)) return tag;
      const css = take(href);
      return css === null ? tag : `<style>\n${css}\n</style>`;
    },
  );

  // <script src="..."></script>
  html = html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (tag, before: string, src: string, after: string) => {
      const js = take(src);
      if (js === null) return tag;
      const isModule = /type=["']module["']/i.test(before + after);
      return `<script${isModule ? ' type="module"' : ""}>\n${js}\n</script>`;
    },
  );

  // The bridge goes first so it catches errors thrown by the page's own scripts.
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => `${m}\n${BRIDGE}`)
    : `${BRIDGE}\n${html}`;

  return { html, inlined, missing };
}

/** HTML files in the workspace, which is what the entry picker offers. */
export function previewable(files: FileNode[]): string[] {
  return files.filter((f) => /\.html?$/i.test(f.path)).map((f) => f.path);
}

/** A starter page, written on first use so the pane is never an empty box. */
export const STARTER_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>It renders</h1>
    <p>Edit this file, or style.css, and the pane redraws once you stop typing.</p>
    <button id="go">Count</button>
    <p id="out">0</p>
  </main>
  <script src="main.js"></script>
</body>
</html>
`;

export const STARTER_CSS = `:root { color-scheme: dark; }

body {
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
  background: #121110;
  color: #c9c2b8;
  font: 15px/1.6 ui-sans-serif, system-ui, sans-serif;
}

main { max-width: 32rem; padding: 2rem; }
h1 { color: #e6a94e; font-size: 1.6rem; margin: 0 0 .5rem; }
button {
  border: 1px solid #3a3532;
  background: #1a1817;
  color: #c9c2b8;
  padding: .5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
}
button:hover { border-color: #e6a94e; color: #e6a94e; }
#out { font-variant-numeric: tabular-nums; color: #4fb79a; }
`;

export const STARTER_JS = `let n = 0;
const out = document.getElementById("out");

document.getElementById("go").addEventListener("click", () => {
  out.textContent = String(++n);
  console.log("clicked", n);
});

console.log("preview loaded");
`;
