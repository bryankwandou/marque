"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square, Check } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PanelHeader } from "./Explorer";
import { cn } from "@/lib/utils";
import { streamLocal } from "@/lib/models";
import { AGENT_SYSTEM } from "@/lib/agent-prompt";
import { useRuntime, runtimeFor, resolveBaseUrl } from "@/lib/runtime-store";

type Msg = { role: "user" | "assistant"; content: string };

const MODELS = [
  { id: "openai/gpt-oss-120b", label: "gpt-oss-120b" },
  { id: "llama-3.3-70b-versatile", label: "llama-3.3-70b" },
  { id: "qwen/qwen3.6-27b", label: "qwen3.6-27b" },
  { id: "openai/gpt-oss-20b", label: "gpt-oss-20b" },
];

/**
 * Fenced blocks whose info string carries a path — ```ts:src/lib/fees.ts —
 * become applicable patches. Anything else is just prose.
 */
function extractPatches(text: string) {
  const out: { path: string; code: string }[] = [];
  const re = /```[a-zA-Z]*:([^\s`]+)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ path: m[1], code: m[2] });
  return out;
}

export function AgentPanel() {
  const files = useWorkspace((s) => s.files);
  const activePath = useWorkspace((s) => s.activePath);
  const update = useWorkspace((s) => s.update);
  const create = useWorkspace((s) => s.create);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);

  const runtimeId = useRuntime((s) => s.runtimeId);
  const customBaseUrl = useRuntime((s) => s.customBaseUrl);
  const localModel = useRuntime((s) => s.localModel);
  const runtime = runtimeFor(runtimeId);
  const isLocal = runtime.kind === "local";
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const active = files.find((f) => f.path === activePath);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);

    const controller = new AbortController();
    abort.current = controller;

    const contextNote = active
      ? `Open file in the editor:

${`${active.path}

${active.content}`.slice(0, 12000)}`
      : null;

    try {
      // A local runtime is called straight from the tab. That is the whole point
      // of it: with the weights on disk and the model chosen here, no part of
      // this request touches the network.
      if (isLocal) {
        if (!localModel) {
          throw new Error(
            "No local model selected. Open the Models panel and pick one.",
          );
        }
        let acc = "";
        await streamLocal({
          baseUrl: resolveBaseUrl(runtimeId, customBaseUrl),
          model: localModel,
          signal: controller.signal,
          messages: [
            { role: "system", content: AGENT_SYSTEM },
            ...(contextNote
              ? [{ role: "system" as const, content: contextNote }]
              : []),
            ...next,
          ],
          onDelta: (delta) => {
            acc += delta;
            setMessages([...next, { role: "assistant", content: acc }]);
          },
        });
        return;
      }

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: next,
          model,
          context: active ? `${active.path}\n\n${active.content}` : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `Agent returned ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("Stopped.");
      } else {
        setError(err instanceof Error ? err.message : "Request failed.");
        setMessages(next);
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const apply = (path: string, code: string, key: string) => {
    if (files.some((f) => f.path === path)) update(path, code);
    else create(path, code);
    setApplied((s) => new Set(s).add(key));
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Agent">
        {isLocal ? (
          <span
            title={`${runtime.label} at ${resolveBaseUrl(runtimeId, customBaseUrl)}`}
            className="flex items-center gap-1.5 font-mono text-[10.5px] text-verdigris"
          >
            <span className="size-1.5 rounded-full bg-verdigris" />
            {localModel || "no model"}
          </span>
        ) : (
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-[4px] border border-line bg-ink px-1.5 py-0.5 font-mono text-[10.5px] text-muted outline-none hover:border-line-strong"
            aria-label="Model"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        )}
      </PanelHeader>

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-[12.5px] leading-[1.6] text-faint">
              The agent sees the file you have open. Ask for a change and it returns
              a patch you can apply, then seal.
            </p>
            <div className="space-y-1.5">
              {[
                "Replace the hardcoded fee with the schedule lookup",
                "Add a guard so the fee cannot exceed 5 percent",
                "Write a test for settle() covering both tiers",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="block w-full rounded-[6px] border border-line px-2.5 py-2 text-left text-[12px] text-muted transition-colors duration-150 hover:border-line-strong hover:text-paper"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i}>
            <p
              className={cn(
                "mb-1.5 font-mono text-[10px] uppercase tracking-[0.1em]",
                m.role === "user" ? "text-faint" : "text-brass",
              )}
            >
              {m.role === "user" ? "you" : "agent"}
            </p>
            <div className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.65] text-muted">
              {m.role === "assistant" ? stripFences(m.content) : m.content}
              {busy && i === messages.length - 1 && (
                <span className="anim-caret ml-0.5 text-brass">▍</span>
              )}
            </div>

            {m.role === "assistant" &&
              extractPatches(m.content).map((p, j) => {
                const key = `${i}-${j}`;
                const done = applied.has(key);
                return (
                  <div
                    key={key}
                    className="mt-2.5 overflow-hidden rounded-[6px] border border-line"
                  >
                    <div className="flex items-center gap-2 border-b border-line bg-raised px-2.5 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-brass">
                        {p.path}
                      </span>
                      <button
                        type="button"
                        onClick={() => apply(p.path, p.code, key)}
                        disabled={done}
                        className={cn(
                          "flex items-center gap-1 rounded-[4px] px-2 py-0.5 font-mono text-[10.5px] transition-colors duration-150",
                          done
                            ? "text-verdigris"
                            : "border border-line-strong text-muted hover:border-brass hover:text-brass",
                        )}
                      >
                        {done ? <Check size={10} /> : null}
                        {done ? "applied" : "apply"}
                      </button>
                    </div>
                    <pre className="max-h-52 overflow-auto p-2.5 font-mono text-[11px] leading-[1.6] text-muted">
                      <code>{p.code}</code>
                    </pre>
                  </div>
                );
              })}
          </div>
        ))}

        {error && (
          <p className="rounded-[6px] border border-oxide/30 bg-oxide/10 px-2.5 py-2 font-mono text-[11.5px] text-oxide">
            {error}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-2.5">
        <div className="flex items-end gap-1.5 rounded-[6px] border border-line bg-ink px-2.5 py-2 focus-within:border-line-strong">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={
              active ? `Ask about ${active.path.split("/").pop()}…` : "Ask anything…"
            }
            className="min-h-0 flex-1 resize-none bg-transparent text-[12.5px] leading-[1.55] text-paper outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => (busy ? abort.current?.abort() : void send())}
            disabled={!busy && !input.trim()}
            aria-label={busy ? "Stop" : "Send"}
            className="grid size-6 shrink-0 place-items-center rounded-[4px] bg-brass text-ink transition-opacity duration-150 disabled:opacity-25"
          >
            {busy ? <Square size={11} fill="currentColor" /> : <ArrowUp size={13} />}
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-faint">
          {isLocal
            ? "Enter sends · running on this machine, nothing leaves it"
            : "Enter sends · Shift Enter for a newline"}
        </p>
      </div>
    </div>
  );
}

/** Patches render as their own cards, so drop them from the prose stream. */
function stripFences(text: string) {
  return text.replace(/```[a-zA-Z]*:[^\s`]+\n[\s\S]*?```/g, "").trim();
}
