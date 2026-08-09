"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#mechanism", label: "How it works" },
  { href: "#workbench", label: "Workbench" },
  { href: "#registry", label: "Extensions" },
  { href: "/verify", label: "Verify" },
  { href: "/deck", label: "Deck" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled
          ? "border-b border-line bg-ink/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-6">
        <Link href="/" className="rounded-sm" aria-label="Marque home">
          <Wordmark size={26} id="nav" />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-[6px] px-3 py-2 text-[13.5px] text-muted transition-colors duration-150 hover:bg-raised hover:text-paper"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/bryankwandou/marque"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden rounded-[6px] px-3 py-2 text-[13.5px] text-muted transition-colors duration-150 hover:bg-raised hover:text-paper sm:block"
          >
            Source
          </a>
          <Link
            href="/studio"
            className="group relative overflow-hidden rounded-[6px] bg-brass px-3.5 py-2 text-[13.5px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-brass-hi active:scale-[0.98]"
          >
            Open the workbench
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="rounded-[6px] p-2 text-muted hover:bg-raised hover:text-paper md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d={open ? "M4 4 L14 14 M14 4 L4 14" : "M2.5 5h13M2.5 9h13M2.5 13h13"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <ul className="anim-rise border-t border-line bg-ink/95 px-6 py-3 backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-[6px] px-2 py-2.5 text-sm text-muted hover:text-paper"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
