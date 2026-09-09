"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Download, Check, ExternalLink } from "lucide-react";
import { PanelHeader } from "./Explorer";
import { compactNumber, cn } from "@/lib/utils";
import type { Extension } from "@/app/api/extensions/route";

const CATEGORIES = [
  "",
  "Programming Languages",
  "Linters",
  "Formatters",
  "Themes",
  "Debuggers",
  "Snippets",
  "Testing",
  "SCM Providers",
  "Data Science",
  "Machine Learning",
  "Azure",
  "Other",
];

const INSTALLED_KEY = "marque.extensions.v1";

export function ExtensionsPanel() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<Extension[]>([]);
  const [total, setTotal] = useState(0);
  // True when the route fell back to the pinned snapshot because open-vsx.org
  // could not be reached. Worth saying out loud rather than quietly showing
  // stale counts.
  const [offline, setOffline] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("loading");
  const [installed, setInstalled] = useState<string[]>([]);

  useEffect(() => {
    try {
      setInstalled(JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? "[]"));
    } catch {
      setInstalled([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    const params = new URLSearchParams({ size: "40" });
    if (debounced) params.set("q", debounced);
    if (category) params.set("category", category);

    fetch(`/api/extensions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setState("error");
          return;
        }
        setItems(d.extensions ?? []);
        setTotal(d.total ?? 0);
        setOffline(d.source === "snapshot");
        setState("idle");
      })
      .catch(() => !cancelled && setState("error"));

    return () => {
      cancelled = true;
    };
  }, [debounced, category]);

  const toggle = (id: string) => {
    setInstalled((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem(INSTALLED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const installedSet = useMemo(() => new Set(installed), [installed]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Extensions">
        <span className="flex items-center gap-1.5">
          {offline && (
            <span
              className="rounded-[3px] border border-line-strong px-1 py-px font-mono text-[9px] uppercase tracking-[0.08em] text-faint"
              title="open-vsx.org is unreachable. Searching the snapshot bundled with this build."
            >
              offline
            </span>
          )}
          <span className="font-mono text-[10px] text-faint tabular-nums">
            {total ? total.toLocaleString("en-US") : "—"}
          </span>
        </span>
      </PanelHeader>

      <div className="shrink-0 space-y-2 border-b border-line p-2.5">
        <div className="flex items-center gap-2 rounded-[6px] border border-line bg-ink px-2 py-1.5 focus-within:border-line-strong">
          <Search size={12} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Open VSX"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-paper outline-none placeholder:text-faint"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className="w-full rounded-[6px] border border-line bg-ink px-2 py-1.5 font-mono text-[11px] text-muted outline-none hover:border-line-strong"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c || "All categories"}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {state === "loading" &&
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="border-b border-line/60 p-2.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
              <div className="mt-2 h-2.5 w-full animate-pulse rounded bg-line/60" />
            </div>
          ))}

        {state === "error" && (
          <p className="p-3 text-[12px] leading-[1.6] text-muted">
            Open VSX did not respond. Check your connection and search again — the
            registry is queried live rather than bundled.
          </p>
        )}

        {state === "idle" && items.length === 0 && (
          <p className="p-3 text-[12px] text-faint">
            Nothing matched {debounced ? `"${debounced}"` : "that filter"}.
          </p>
        )}

        {state === "idle" &&
          items.map((e) => {
            const on = installedSet.has(e.id);
            return (
              <div
                key={e.id}
                className="group border-b border-line/60 p-2.5 transition-colors duration-150 hover:bg-raised"
              >
                <div className="flex items-start gap-2.5">
                  {e.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.icon}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      className="size-7 shrink-0 rounded-[5px] object-contain"
                    />
                  ) : (
                    <span className="grid size-7 shrink-0 place-items-center rounded-[5px] border border-line font-mono text-[12px] text-faint">
                      {e.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-paper">
                        {e.displayName}
                      </span>
                      {e.verified && (
                        <span
                          title="Verified publisher"
                          className="size-1.5 shrink-0 rounded-full bg-verdigris"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.5] text-faint">
                      {e.description || "No description published."}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-faint tabular-nums">
                      <span>{e.namespace}</span>
                      <span>·</span>
                      <span>{compactNumber(e.downloadCount)}</span>
                      {e.averageRating !== null && (
                        <>
                          <span>·</span>
                          <span>{e.averageRating.toFixed(1)}★</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggle(e.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-[4px] px-2 py-1 font-mono text-[10.5px] transition-colors duration-150",
                      on
                        ? "border border-verdigris/40 bg-verdigris/10 text-verdigris"
                        : "border border-line-strong text-muted hover:border-brass hover:text-brass",
                    )}
                  >
                    {on ? <Check size={10} /> : <Download size={10} />}
                    {on ? "enabled" : "enable"}
                  </button>
                  <a
                    href={e.page}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1 rounded-[4px] px-2 py-1 font-mono text-[10.5px] text-faint transition-colors duration-150 hover:text-paper"
                  >
                    <ExternalLink size={10} />
                    registry
                  </a>
                </div>
              </div>
            );
          })}
      </div>

      <p className="shrink-0 border-t border-line px-2.5 py-2 font-mono text-[10px] leading-[1.5] text-faint">
        Metadata is served live from open-vsx.org. Enabling records your selection in
        this workspace; extensions requiring a Node host do not execute in-browser.
      </p>
    </div>
  );
}
