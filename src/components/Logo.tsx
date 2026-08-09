import { cn } from "@/lib/utils";

/**
 * The Marque die. The M is knocked out of the brass rather than drawn on top of
 * it, so the mark reads as an impression struck into metal. See brand.md §8.
 */
export function Mark({
  size = 28,
  className,
  id = "mq",
}: {
  size?: number;
  className?: string;
  /** Unique per instance — SVG gradient/mask ids are document-global. */
  id?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-brass`}
          x1="10"
          y1="6"
          x2="54"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F4CE8C" />
          <stop offset="0.42" stopColor="#E6A94E" />
          <stop offset="1" stopColor="#A96F27" />
        </linearGradient>
        <mask id={`${id}-cut`}>
          <rect x="4" y="4" width="56" height="56" rx="17" fill="#fff" />
          <path
            d="M20.5 43.5 V21.5 L32 34.5 L43.5 21.5 V43.5"
            stroke="#000"
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </mask>
      </defs>
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="17"
        fill={`url(#${id}-brass)`}
        mask={`url(#${id}-cut)`}
      />
      <rect
        x="9.75"
        y="9.75"
        width="44.5"
        height="44.5"
        rx="12.5"
        stroke="#100C05"
        strokeOpacity="0.18"
        strokeWidth="1.25"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark({
  size = 28,
  className,
  id,
}: {
  size?: number;
  className?: string;
  id?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark size={size} id={id} />
      <span
        className="font-semibold text-paper"
        style={{ fontSize: size * 0.62, letterSpacing: "-0.028em" }}
      >
        Marque
      </span>
    </span>
  );
}
