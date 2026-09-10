"use client";

/**
 * Model runtimes.
 *
 * Marque talks to two kinds of backend and the difference is only a base URL:
 *
 *   hosted  — /api/agent on this deployment, which holds the provider key.
 *   local   — an OpenAI-compatible server running on the user's own machine.
 *             Ollama, LM Studio and llama.cpp all expose that surface, so the
 *             same code path drives all three. The browser calls the loopback
 *             address directly, which means once the weights are on disk the
 *             agent keeps working with the network unplugged.
 *
 * Nothing here downloads a model. Weights are pulled by the runtime itself
 * (`ollama pull qwen2.5-coder:7b`), which is what lets it use the GPU or the
 * full CPU — a browser tab can reach neither.
 */

export type RuntimeKind = "hosted" | "local";

export type Runtime = {
  id: string;
  kind: RuntimeKind;
  label: string;
  /** OpenAI-compatible root. Empty for the hosted route. */
  baseUrl: string;
  /** Shown when a probe fails, so the fix is on screen rather than in a doc. */
  hint: string;
};

export const RUNTIMES: Runtime[] = [
  {
    id: "hosted",
    kind: "hosted",
    label: "Hosted (this deployment)",
    baseUrl: "",
    hint: "Runs through /api/agent. Needs a network and the deployment's key.",
  },
  {
    id: "ollama",
    kind: "local",
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    hint: "Install Ollama, run `ollama pull qwen2.5-coder:7b`, then start it with OLLAMA_ORIGINS set to this page's origin so the browser is allowed to call it.",
  },
  {
    id: "lmstudio",
    kind: "local",
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    hint: "Load a model in LM Studio and switch the local server on. Enable CORS in the server tab.",
  },
  {
    id: "llamacpp",
    kind: "local",
    label: "llama.cpp server",
    baseUrl: "http://localhost:8080/v1",
    hint: "Start llama-server with --host 127.0.0.1 --port 8080. It sends permissive CORS headers by default.",
  },
  {
    id: "jan",
    kind: "local",
    label: "Jan",
    baseUrl: "http://localhost:1337/v1",
    hint: "Turn on the local API server in Jan's settings.",
  },
];

/** Models worth pulling for code work, with the disk cost stated up front. */
export const SUGGESTED_LOCAL = [
  { tag: "qwen2.5-coder:7b", size: "4.7 GB", note: "Best all-round coder at this size." },
  { tag: "qwen2.5-coder:1.5b", size: "986 MB", note: "Runs on a laptop with no discrete GPU." },
  { tag: "deepseek-coder-v2:16b", size: "8.9 GB", note: "Stronger on multi-file reasoning." },
  { tag: "llama3.2:3b", size: "2.0 GB", note: "General chat, light on memory." },
  { tag: "gemma3:4b", size: "3.3 GB", note: "Good instruction following, small footprint." },
  { tag: "phi4-mini:3.8b", size: "2.5 GB", note: "Fast on CPU only." },
];

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

/**
 * A message that carries an image alongside its text, in the shape every
 * OpenAI-compatible server expects. Ollama and LM Studio both accept a data URI
 * here, which is what lets a screenshot taken in the tab be read by a vision
 * model on the same machine without either one touching the network.
 */
export type VisionMessage = {
  role: "user";
  content: (
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  )[];
};

/** Model ids that are known to accept images. Matched loosely, on purpose. */
const VISION_HINTS = [
  "llava",
  "vl",
  "vision",
  "moondream",
  "minicpm-v",
  "gemma3",
  "qwen2.5-vl",
  "llama3.2-vision",
  "granite3.2-vision",
];

export function looksLikeVisionModel(id: string): boolean {
  const lower = id.toLowerCase();
  return VISION_HINTS.some((h) => lower.includes(h));
}

/**
 * Ask a local runtime which models it has on disk. A failure here is expected
 * and informative — it is how the panel knows to show the install hint.
 */
export async function probeRuntime(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await fetch(`${baseUrl}/models`, { signal });
  if (!res.ok) throw new Error(`Runtime answered ${res.status}`);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id).sort();
}

/**
 * Stream a completion from an OpenAI-compatible server straight to the browser.
 * Deltas are handed back one at a time so the panel can paint as it goes.
 */
export async function streamLocal({
  baseUrl,
  model,
  messages,
  signal,
  onDelta,
}: {
  baseUrl: string;
  model: string;
  messages: (ChatMessage | VisionMessage)[];
  signal?: AbortSignal;
  onDelta: (chunk: string) => void;
}): Promise<void> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ model, messages, temperature: 0.2, stream: true }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Local runtime returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {
        // A JSON object split across two network chunks. The next pass has it.
      }
    }
  }
}
