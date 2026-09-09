import { mkdir, writeFile } from "node:fs/promises";

/**
 * Pin the top 2000 Open VSX extensions to disk.
 *
 * The workbench normally searches the registry live, which keeps results fresh
 * but assumes a network. This snapshot is what /api/extensions falls back to
 * when open-vsx.org is unreachable, so the marketplace still lists something
 * useful on a plane or behind a firewall.
 *
 * Open VSX caps a single search page at 100, so the catalogue is assembled from
 * twenty consecutive pages. Re-run it whenever the snapshot feels stale:
 *
 *   node scripts/fetch-catalog.mjs
 */

const REGISTRY = "https://open-vsx.org/api/-/search";
const BATCH = 100;
const BATCHES = 20;
const OUT = "src/data/catalog.json";

/** Trim a registry hit down to what the extensions panel actually renders. */
function normalise(e) {
  return {
    id: `${e.namespace}.${e.name}`,
    name: e.name,
    namespace: e.namespace,
    displayName: e.displayName || e.name,
    description: (e.description || "").slice(0, 220),
    version: e.version,
    downloadCount: e.downloadCount ?? 0,
    averageRating: typeof e.averageRating === "number" ? e.averageRating : null,
    reviewCount: e.reviewCount ?? 0,
    verified: Boolean(e.verified),
    icon: e.files?.icon ?? null,
    timestamp: e.timestamp,
    page: `https://open-vsx.org/extension/${e.namespace}/${e.name}`,
  };
}

async function page(offset) {
  const url = new URL(REGISTRY);
  url.searchParams.set("size", String(BATCH));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("includeAllVersions", "false");
  url.searchParams.set("sortBy", "downloadCount");
  url.searchParams.set("sortOrder", "desc");

  // The registry occasionally times out under load; three tries is enough.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`registry responded ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

const seen = new Set();
const extensions = [];
let totalSize = 0;

for (let i = 0; i < BATCHES; i++) {
  const offset = i * BATCH;
  const data = await page(offset);
  totalSize = data.totalSize ?? totalSize;

  const hits = data.extensions ?? [];
  for (const hit of hits) {
    const row = normalise(hit);
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    extensions.push(row);
  }

  const label = String(i + 1).padStart(2, "0");
  console.log(
    `batch ${label}/${BATCHES}  offset ${String(offset).padStart(4)}  +${hits.length}  running total ${extensions.length}`,
  );

  if (hits.length < BATCH) {
    console.log("registry ran out of results early; stopping");
    break;
  }
}

await mkdir("src/data", { recursive: true });
await writeFile(
  OUT,
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      source: "https://open-vsx.org",
      registryTotal: totalSize,
      count: extensions.length,
      extensions,
    },
    null,
    0,
  ),
);

console.log(`\nwrote ${OUT}`);
console.log(`  pinned      ${extensions.length}`);
console.log(`  registry    ${totalSize}`);
console.log(`  top install ${extensions[0]?.id} (${extensions[0]?.downloadCount.toLocaleString()})`);
