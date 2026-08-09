import { NextResponse } from "next/server";

/**
 * Proxy onto the Open VSX registry — the open-source marketplace that VSCodium,
 * Gitpod and Eclipse Theia consume. Going through our own route keeps the
 * browser free of CORS problems and lets us normalise the payload once.
 *
 * Open VSX API reference: https://open-vsx.org/swagger-ui/index.html
 */

const REGISTRY = "https://open-vsx.org/api/-/search";

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
      return NextResponse.json(
        { error: `registry responded ${res.status}`, extensions: [], total: 0 },
        { status: 502 },
      );
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
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "registry unreachable",
        extensions: [],
        total: 0,
      },
      { status: 502 },
    );
  }
}
