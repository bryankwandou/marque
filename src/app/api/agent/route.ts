import { NextResponse } from "next/server";
import { AGENT_SYSTEM } from "@/lib/agent-prompt";

/**
 * Agent endpoint. Streams a completion back to the workbench.
 *
 * Provider is Groq's OpenAI-compatible surface, which keeps the door open for
 * swapping in Anthropic, Gemini or a local runner without touching the client:
 * only BASE_URL, MODEL and the auth header differ between them.
 */

const BASE_URL = process.env.AGENT_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.AGENT_MODEL ?? "openai/gpt-oss-120b";

const SYSTEM = AGENT_SYSTEM;

// Streaming works on the Node runtime and the edge runtime is on its way out.
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(request: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: { messages?: ChatMessage[]; context?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages is required." }, { status: 400 });
  }

  const prelude: ChatMessage[] = [{ role: "system", content: SYSTEM }];
  if (body.context) {
    prelude.push({
      role: "system",
      content: `Open file in the editor:\n\n${body.context.slice(0, 12000)}`,
    });
  }

  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: body.model ?? MODEL,
      messages: [...prelude, ...messages],
      temperature: 0.2,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Provider returned ${upstream.status}`, detail: detail.slice(0, 400) },
      { status: 502 },
    );
  }

  // Re-emit the SSE stream as plain text chunks so the client stays simple.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta: string | undefined = json.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch {
          // Partial JSON across chunk boundaries; the next pass picks it up.
        }
      }
    },
  });

  return new Response(upstream.body.pipeThrough(stream), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-marque-model": body.model ?? MODEL,
    },
  });
}
