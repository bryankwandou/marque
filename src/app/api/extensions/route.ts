import { NextResponse } from "next/server";
import catalog from "@/data/catalog.json";

/**
 * Proxy onto the Open VSX registry — the open-source marketplace that VSCodium,
 * Gitpod and Eclipse Theia consume. Going through our own route keeps the
 * browser free of CORS problems and lets us normalise the payload once.
 *
 * When the registry cannot be reached, the route serves a pinned snapshot of the
 * 2000 most-installed extensions instead of an empty list, so the marketplace
 * still works offline. Refresh the snapshot with `node scripts/fetch-catalog.mjs`.
 *
 * Open VSX API reference: https://open-vsx.org/swagger-ui/index.html
 */

// Overridable so a self-hosted Open VSX mirror can be pointed at instead, and so
// the snapshot fallback can be exercised by aiming this at a dead host.
const REGISTRY =
  process.env.OPEN_VSX_SEARCH_URL ?? "https://open-vsx.org/api/-/search";

export const revalidate = 300;

export type Extension = {
  id: string;
  name: string;
  namespace: string;
  displayName: string;
  description: string;
  version: string;
  downloadCount: number;
  averageRating: number | null;
  reviewCount: number;
  verified: boolean;
  icon: string | null;
  timestamp: string;
  page: string;
};

type OpenVsxHit = {
  name: string;
  namespace: string;
  displayName?: string;
  description?: string;
  version: string;
  downloadCount?: number;
  averageRating?: number;
  reviewCount?: number;
  verified?: boolean;
  timestamp: string;
  files?: { icon?: string };
};

// Cast through `unknown` so the type checker treats the snapshot as a plain
// array rather than inferring a 2000-member literal type from the JSON.
const PINNED = catalog.extensions as unknown as Extension[];

/**
 * Search the pinned snapshot the same way the registry would: match on the
 * display name, id and description, and keep the install-count ordering the
 * snapshot was captured in.
 */
function fromSnapshot(query: string, size: number, offset: number) {
  const needle = query.toLowerCase();
  const hits = needle
    ? PINNED.filter(
        (e) =>
          e.displayName.toLowerCase().includes(needle) ||
          e.id.toLowerCase().includes(needle) ||
          e.description.toLowerCase().includes(needle),
      )
    : PINNED;

  return {
    extensions: hits.slice(offset, offset + size),
    total: hits.length,
    offset,
    source: "snapshot" as const,
    capturedAt: catalog.capturedAt,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const size = Math.min(Number(url.searchParams.get("size") ?? 30) || 30, 100);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

  const upstream = new URL(REGISTRY);
  upstream.searchParams.set("size", String(size));
  upstream.searchParams.set("offset", String(offset));
  upstream.searchParams.set("includeAllVersions", "false");
  if (query) upstream.searchParams.set("query", query);
  if (category) upstream.searchParams.set("category", category);
  if (!query) {
    upstream.searchParams.set("sortBy", "downloadCount");
    upstream.searchParams.set("sortOrder", "desc");
  }

  try {
    // Caching is declared at the route level via `revalidate` above.
    const res = await fetch(upstream, {
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json({
        ...fromSnapshot(query, size, offset),
        notice: `registry responded ${res.status}; serving the pinned snapshot`,
      });
    }

    const data = (await res.json()) as {
      offset: number;
      totalSize: number;
      extensions: OpenVsxHit[];
    };

    const extensions: Extension[] = (data.extensions ?? []).map((e) => ({
      id: `${e.namespace}.${e.name}`,
      name: e.name,
      namespace: e.namespace,
      displayName: e.displayName || e.name,
      description: e.description || "",
      version: e.version,
      downloadCount: e.downloadCount ?? 0,
      averageRating: typeof e.averageRating === "number" ? e.averageRating : null,
      reviewCount: e.reviewCount ?? 0,
      verified: Boolean(e.verified),
      icon: e.files?.icon ?? null,
      timestamp: e.timestamp,
      page: `https://open-vsx.org/extension/${e.namespace}/${e.name}`,
    }));

    return NextResponse.json({
      extensions,
      total: data.totalSize ?? extensions.length,
      offset: data.offset ?? offset,
      source: "registry" as const,
    });
  } catch (err) {
    return NextResponse.json({
      ...fromSnapshot(query, size, offset),
      notice:
        err instanceof Error
          ? `${err.message}; serving the pinned snapshot`
          : "registry unreachable; serving the pinned snapshot",
    });
  }
}
