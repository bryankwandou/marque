"use client";

/**
 * The revision log.
 *
 * Every version of every file the editor has ever held is appended here and
 * never overwritten, so there is no such thing as losing work to a bad edit —
 * you go back and take the version you wanted. It lives in IndexedDB rather
 * than localStorage because localStorage caps out around five megabytes and a
 * working day of editing blows past that; IndexedDB is bounded by the origin's
 * storage quota, which is hundreds of megabytes or more.
 *
 * Nothing here is uploaded. The log is as private as the files it describes.
 */

const DB_NAME = "marque.history";
const DB_VERSION = 1;
const STORE = "revisions";

export type Origin = "edit" | "agent" | "restore" | "create" | "seal";

export type Revision = {
  id?: number;
  path: string;
  content: string;
  /** Epoch milliseconds. */
  at: number;
  origin: Origin;
  /** Character count of the version this one replaced, for the size delta. */
  from: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser has no IndexedDB."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        // Compound so a single cursor walks one file newest-first.
        store.createIndex("path_at", ["path", "at"]);
        store.createIndex("at", "at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB refused to open."));
  });

  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Transaction failed."));
      }),
  );
}

/**
 * Append a version, but only when it differs from the one already on top.
 * Autosave fires on a timer and would otherwise fill the log with duplicates of
 * a file nobody touched.
 */
export async function record(
  path: string,
  content: string,
  origin: Origin,
): Promise<Revision | null> {
  const [latest] = await revisions(path, 1);
  if (latest && latest.content === content) return null;

  const entry: Revision = {
    path,
    content,
    at: Date.now(),
    origin,
    from: latest ? latest.content.length : 0,
  };

  const id = await tx<IDBValidKey>("readwrite", (store) => store.add(entry));
  return { ...entry, id: Number(id) };
}

/** Versions of one file, newest first. */
export async function revisions(path: string, limit = 200): Promise<Revision[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, "readonly").objectStore(STORE);
    const index = store.index("path_at");
    // IndexedDB sorts arrays after every other key type, so [path] falls below
    // every [path, <timestamp>] and [path, []] sits above all of them.
    const range = IDBKeyRange.bound([path], [path, []]);
    const req = index.openCursor(range, "prev");
    const out: Revision[] = [];

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) {
        resolve(out);
        return;
      }
      out.push(cursor.value as Revision);
      cursor.continue();
    };
    req.onerror = () => reject(req.error ?? new Error("Could not read history."));
  });
}

/** How much the log holds, for the line in the status bar. */
export async function stats(): Promise<{ count: number; oldest: number | null }> {
  const db = await open();
  const count = await tx<number>("readonly", (store) => store.count());
  if (count === 0) return { count: 0, oldest: null };

  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, "readonly").objectStore(STORE);
    const req = store.index("at").openCursor(null, "next");
    req.onsuccess = () => {
      const cursor = req.result;
      resolve({ count, oldest: cursor ? (cursor.value as Revision).at : null });
    };
    req.onerror = () => reject(req.error ?? new Error("Could not read history."));
  });
}

/** Wipe the log. Separate from resetting the workspace, and deliberately so. */
export async function clear(): Promise<void> {
  await tx<undefined>("readwrite", (store) => store.clear());
}

/** A short, unambiguous stamp: "14:02:31" today, "9 Sep 14:02" before that. */
export function stamp(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  return sameDay
    ? d.toLocaleTimeString("en-GB", { hour12: false })
    : d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}
