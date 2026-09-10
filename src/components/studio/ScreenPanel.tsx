"use client";

import { useRef, useState } from "react";
import { Camera, Circle, Square, Download, Eye, Trash2 } from "lucide-react";
import { PanelHeader } from "./Explorer";
import {
  captureFrame,
  startRecording,
  screenCaptureSupported,
  bytes,
  type Frame,
  type Recorder,
} from "@/lib/screen";
import { streamLocal, looksLikeVisionModel } from "@/lib/models";
import { useRuntime, runtimeFor, resolveBaseUrl } from "@/lib/runtime-store";
import { cn } from "@/lib/utils";

/**
 * Take a shot of the screen, record it, or hand a frame to a vision model and
 * ask what is on it. The reading step deliberately runs on the local runtime
 * only: shipping a picture of somebody's desktop to a hosted provider is not a
 * thing to do quietly, and if it were offered here it would happen by accident.
 */
export function ScreenPanel() {
  const runtimeId = useRuntime((s) => s.runtimeId);
  const customBaseUrl = useRuntime((s) => s.customBaseUrl);
  const localModel = useRuntime((s) => s.localModel);
  const runtime = runtimeFor(runtimeId);
  const isLocal = runtime.kind === "local";

  const [frame, setFrame] = useState<Frame | null>(null);
  const [recording, setRecording] = useState(false);
  const [clip, setClip] = useState<{ url: string; bytes: number } | null>(null);
  const [question, setQuestion] = useState("Describe what is on this screen.");
  const [answer, setAnswer] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<Recorder | null>(null);
  const abort = useRef<AbortController | null>(null);

  const supported = screenCaptureSupported();
  const visionReady = isLocal && localModel && looksLikeVisionModel(localModel);

  const shoot = async () => {
    setError(null);
    setAnswer("");
    try {
      setFrame(await captureFrame());
    } catch (err) {
      setError(dismissed(err) ? null : (err as Error).message);
    }
  };

  const toggleRecording = async () => {
    setError(null);
    if (recording) {
      const rec = recorder.current;
      recorder.current = null;
      setRecording(false);
      if (rec) {
        const out = await rec.stop();
        setClip({ url: out.url, bytes: out.bytes });
      }
      return;
    }

    try {
      const rec = await startRecording();
      recorder.current = rec;
      setRecording(true);
      // Stopping from the browser's own sharing banner must not leave the
      // button stuck on "recording".
      rec.onEnded(() => {
        if (recorder.current !== rec) return;
        recorder.current = null;
        setRecording(false);
        void rec.stop().then((out) => setClip({ url: out.url, bytes: out.bytes }));
      });
    } catch (err) {
      setError(dismissed(err) ? null : (err as Error).message);
    }
  };

  const read = async () => {
    if (!frame || !visionReady) return;
    setError(null);
    setAnswer("");
    setReading(true);

    const controller = new AbortController();
    abort.current = controller;

    try {
      let acc = "";
      await streamLocal({
        baseUrl: resolveBaseUrl(runtimeId, customBaseUrl),
        model: localModel,
        signal: controller.signal,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: question },
              { type: "image_url", image_url: { url: frame.dataUrl } },
            ],
          },
        ],
        onDelta: (d) => {
          acc += d;
          setAnswer(acc);
        },
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setReading(false);
      abort.current = null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Screen">
        {recording && (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-oxide">
            <span className="size-1.5 animate-pulse rounded-full bg-oxide" />
            rec
          </span>
        )}
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {!supported ? (
          <p className="text-[12px] leading-[1.6] text-muted">
            This browser has no screen capture API. Chrome, Edge and Firefox on
            desktop all do; most mobile browsers do not.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Action onClick={() => void shoot()}>
                <Camera size={10} />
                Capture a frame
              </Action>
              <Action onClick={() => void toggleRecording()} danger={recording}>
                {recording ? <Square size={10} /> : <Circle size={10} />}
                {recording ? "Stop" : "Record"}
              </Action>
            </div>

            <p className="text-[11px] leading-[1.6] text-faint">
              The browser asks which window or screen to share. Nothing is
              captured until you pick one, and the capture ends the moment the
              shot is taken.
            </p>

            {frame && (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={frame.dataUrl}
                  alt="Captured screen"
                  className="w-full rounded-[6px] border border-line"
                />
                <div className="flex items-center gap-2 font-mono text-[10px] text-faint tabular-nums">
                  <span>
                    {frame.width}×{frame.height}
                  </span>
                  <a
                    href={frame.dataUrl}
                    download={`marque-${frame.at}.jpg`}
                    className="flex items-center gap-1 hover:text-brass"
                  >
                    <Download size={10} />
                    save
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setFrame(null);
                      setAnswer("");
                    }}
                    className="ml-auto flex items-center gap-1 hover:text-oxide"
                  >
                    <Trash2 size={10} />
                    discard
                  </button>
                </div>

                <div className="space-y-1.5 rounded-[6px] border border-line p-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-faint">
                    Read it
                  </p>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-[5px] border border-line bg-ink px-2 py-1.5 text-[11.5px] leading-[1.5] text-paper outline-none focus:border-line-strong"
                  />
                  <Action
                    onClick={() => (reading ? abort.current?.abort() : void read())}
                    disabled={!visionReady && !reading}
                  >
                    <Eye size={10} />
                    {reading ? "Stop" : "Ask the local model"}
                  </Action>

                  {!visionReady && (
                    <p className="text-[11px] leading-[1.55] text-faint">
                      {isLocal
                        ? `${localModel || "The selected model"} does not look like it takes images. Pull a vision model — llava, moondream, qwen2.5-vl or llama3.2-vision — and pick it in the Models panel.`
                        : "Reading a screenshot only runs against a local runtime. Pick one in the Models panel so the picture stays on this machine."}
                    </p>
                  )}

                  {answer && (
                    <p className="whitespace-pre-wrap rounded-[5px] border border-line bg-ink px-2 py-1.5 text-[11.5px] leading-[1.6] text-muted">
                      {answer}
                      {reading && <span className="anim-caret text-brass">▍</span>}
                    </p>
                  )}
                </div>
              </div>
            )}

            {clip && (
              <div className="flex items-center gap-2 rounded-[6px] border border-line px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-paper">
                  recording · {bytes(clip.bytes)}
                </span>
                <a
                  href={clip.url}
                  download="marque-screen.webm"
                  className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-faint hover:text-brass"
                >
                  <Download size={10} />
                  save
                </a>
              </div>
            )}

            {error && (
              <p className="rounded-[6px] border border-oxide/30 bg-oxide/10 px-2.5 py-2 font-mono text-[11px] leading-[1.55] text-oxide">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Dismissing the picker throws NotAllowedError. That is a choice, not a fault. */
function dismissed(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotAllowedError";
}

function Action({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 rounded-[4px] border px-2 py-1 font-mono text-[10.5px] transition-colors duration-150 disabled:opacity-40",
        danger
          ? "border-oxide/50 text-oxide hover:border-oxide"
          : "border-line-strong text-muted hover:border-brass hover:text-brass",
      )}
    >
      {children}
    </button>
  );
}
