"use client";

/**
 * Screen capture.
 *
 * A page cannot look at your screen on its own; getDisplayMedia puts the choice
 * in the browser's own picker, and the tab only ever receives the surface you
 * hand it. That is the whole security model and it is worth stating, because
 * "the IDE can read your screen" sounds like something that happens behind your
 * back and this is the opposite of that.
 *
 * Frames and recordings stay in memory. Nothing here uploads anything; sending
 * a frame to a model is a separate, explicit step, and when the model is local
 * that step does not leave the machine either.
 */

export function screenCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}

/** Ask for a surface. Throws if the picker is dismissed, which is not an error. */
async function requestSurface(audio: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio,
  });
}

export type Frame = {
  dataUrl: string;
  width: number;
  height: number;
  at: number;
};

/**
 * Grab a single frame and stop the stream immediately, so the browser's sharing
 * indicator goes away the moment the shot is taken rather than lingering.
 *
 * The frame is downscaled before encoding: a 4K screenshot as a PNG data URI is
 * roughly twelve megabytes, which most local vision models will refuse outright
 * and every one of them will be slow about.
 */
export async function captureFrame(maxWidth = 1600): Promise<Frame> {
  const stream = await requestSurface(false);

  try {
    const track = stream.getVideoTracks()[0];
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    // The first frame is not always ready the instant play() resolves.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const settings = track.getSettings();
    const sourceWidth = settings.width ?? video.videoWidth;
    const sourceHeight = settings.height ?? video.videoHeight;
    const scale = Math.min(1, maxWidth / sourceWidth);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser refused a 2D canvas.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    video.pause();
    video.srcObject = null;

    return {
      // JPEG rather than PNG: a screenshot of an editor compresses to a
      // fraction of the size and the text stays perfectly readable.
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: canvas.width,
      height: canvas.height,
      at: Date.now(),
    };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export type Recorder = {
  stop: () => Promise<{ url: string; type: string; bytes: number }>;
  /** Fires when the user ends sharing from the browser's own banner. */
  onEnded: (fn: () => void) => void;
};

/**
 * Record the chosen surface to a file the user can save. The container is
 * whichever of webm or mp4 this browser actually supports — Chrome and Firefox
 * do VP9 in webm, Safari does h264 in mp4, and picking wrong yields a file that
 * records fine and then will not play.
 */
export async function startRecording(withAudio = false): Promise<Recorder> {
  const stream = await requestSurface(withAudio);

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) throw new Error("This browser cannot record a screen capture.");

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start(1000);

  return {
    onEnded: (fn) => {
      stream.getVideoTracks()[0].addEventListener("ended", fn, { once: true });
    },
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: mimeType });
          resolve({
            url: URL.createObjectURL(blob),
            type: mimeType,
            bytes: blob.size,
          });
        };
        recorder.stop();
      }),
  };
}

/** Human-readable byte count for the recording row. */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
