"use client";

import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";
import { useWorkspace } from "@/lib/workspace";
import { loadSessionKey } from "@/lib/seal";

/**
 * A real shell over the virtual workspace. It is not bash and does not pretend
 * to be — it is a small command set that operates on the files actually in the
 * store, so what you type has an effect you can see in the editor.
 */

const BANNER = [
  "\x1b[38;5;180mMarque shell\x1b[0m — type \x1b[38;5;180mhelp\x1b[0m for commands",
  "",
];

export function TerminalPane({ onSeal }: { onSeal?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current || !host.current) return;
    booted.current = true;

    let disposed = false;

    void (async () => {
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
      ]);
      if (disposed || !host.current) return;

      const term = new Terminal({
        fontFamily:
          "var(--font-mono-jb), ui-monospace, 'SF Mono', Menlo, monospace",
        fontSize: 12.5,
        lineHeight: 1.45,
        cursorBlink: true,
        cursorStyle: "bar",
        convertEol: true,
        allowTransparency: true,
        theme: {
          background: "#0a0908",
          foreground: "#a39c92",
          cursor: "#e6a94e",
          selectionBackground: "#e6a94e33",
          black: "#0a0908",
          red: "#d2603f",
          green: "#4fb79a",
          yellow: "#e6a94e",
          blue: "#5b8def",
          magenta: "#c58fd4",
          cyan: "#4fb79a",
          white: "#faf7f2",
          brightBlack: "#6b655d",
          brightYellow: "#f4ce8c",
          brightWhite: "#faf7f2",
        },
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.open(host.current);
      fit.fit();

      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          /* element detached mid-resize */
        }
      });
      ro.observe(host.current);

      BANNER.forEach((l) => term.writeln(l));

      const prompt = () => term.write("\x1b[38;5;180m$\x1b[0m ");
      let line = "";
      const history: string[] = [];
      let cursor = -1;

      const run = (input: string) => {
        const [cmd, ...args] = input.trim().split(/\s+/);
        const store = useWorkspace.getState();

        switch (cmd) {
          case "":
            break;

          case "help":
            term.writeln("  ls                list files");
            term.writeln("  cat <path>        print a file");
            term.writeln("  open <path>       open a file in the editor");
            term.writeln("  touch <path>      create an empty file");
            term.writeln("  rm <path>         delete a file");
            term.writeln("  seal              seal the active file");
            term.writeln("  seals             list seals in this workspace");
            term.writeln("  whoami            show the session public key");
            term.writeln("  clear             clear the screen");
            break;

          case "ls":
            store.files.forEach((f) => {
              const mark = f.sealedAt === f.content ? "\x1b[38;5;72m·\x1b[0m" : " ";
              term.writeln(` ${mark} ${f.path}`);
            });
            break;

          case "cat": {
            const f = store.files.find((x) => x.path === args[0]);
            if (!f) term.writeln(`\x1b[38;5;167mno such file: ${args[0] ?? ""}\x1b[0m`);
            else f.content.split("\n").forEach((l) => term.writeln(l));
            break;
          }

          case "open": {
            const f = store.files.find((x) => x.path === args[0]);
            if (!f) term.writeln(`\x1b[38;5;167mno such file: ${args[0] ?? ""}\x1b[0m`);
            else {
              store.open(f.path);
              term.writeln(`opened ${f.path}`);
            }
            break;
          }

          case "touch":
            if (!args[0]) term.writeln("usage: touch <path>");
            else {
              store.create(args[0]);
              term.writeln(`created ${args[0]}`);
            }
            break;

          case "rm":
            if (!args[0]) term.writeln("usage: rm <path>");
            else {
              store.remove(args[0]);
              term.writeln(`removed ${args[0]}`);
            }
            break;

          case "whoami":
            try {
              term.writeln(`\x1b[38;5;180m${loadSessionKey().publicKey}\x1b[0m`);
              term.writeln("\x1b[38;5;242med25519 session key, this browser only\x1b[0m");
            } catch {
              term.writeln("session key unavailable");
            }
            break;

          case "seals":
            if (store.seals.length === 0) term.writeln("no seals yet");
            store.seals.forEach((s) => {
              const colour = s.status === "anchored" ? "72" : "180";
              term.writeln(
                ` \x1b[38;5;${colour}m${s.status.padEnd(9)}\x1b[0m ${s.digest.slice(0, 12)}…  ${s.file}`,
              );
            });
            break;

          case "seal":
            if (!onSeal) term.writeln("sealing is unavailable here");
            else {
              term.writeln("\x1b[38;5;180mrequesting seal for the active file…\x1b[0m");
              onSeal();
            }
            break;

          case "clear":
            term.clear();
            break;

          default:
            term.writeln(
              `\x1b[38;5;167m${cmd}: not a command. try \x1b[0mhelp`,
            );
        }
      };

      prompt();

      term.onData((data) => {
        switch (data) {
          case "\r":
            term.write("\r\n");
            if (line.trim()) history.unshift(line);
            cursor = -1;
            run(line);
            line = "";
            prompt();
            break;
          case "": // backspace
            if (line.length > 0) {
              line = line.slice(0, -1);
              term.write("\b \b");
            }
            break;
          case "": // ctrl-c
            term.write("^C\r\n");
            line = "";
            prompt();
            break;
          case "[A": // up
            if (history.length && cursor < history.length - 1) {
              cursor += 1;
              term.write("\r\x1b[K");
              prompt();
              line = history[cursor];
              term.write(line);
            }
            break;
          case "[B": // down
            term.write("\r\x1b[K");
            prompt();
            cursor = Math.max(cursor - 1, -1);
            line = cursor >= 0 ? history[cursor] : "";
            term.write(line);
            break;
          default:
            if (data >= " " || data === "\t") {
              line += data;
              term.write(data);
            }
        }
      });

      return () => {
        ro.disconnect();
        term.dispose();
      };
    })();

    return () => {
      disposed = true;
    };
  }, [onSeal]);

  return <div ref={host} className="h-full w-full px-2 py-1.5" />;
}
