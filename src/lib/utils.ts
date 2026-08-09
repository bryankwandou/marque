import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shorten a base58 address or signature for display without losing recognisability. */
export function truncateKey(value: string, lead = 4, tail = 4) {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** SHA-256 of a string, hex encoded. Runs in browser and on the server. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const UNITS = ["", "K", "M", "B"];

/** 77475514 -> "77.5M". Used for extension download counts. */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  let value = n;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${value.toFixed(digits)}${UNITS[unit]}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  const table: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [2592000, "day"],
    [31536000, "month"],
  ];
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let previous = 1;
  for (const [limit, unit] of table) {
    if (seconds < limit) return fmt.format(-Math.round(seconds / previous), unit);
    previous = limit;
  }
  return fmt.format(-Math.round(seconds / 31536000), "year");
}
