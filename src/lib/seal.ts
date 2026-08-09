"use client";

import nacl from "tweetnacl";
import bs58 from "bs58";
import { sha256Hex } from "./utils";

/**
 * A "seal" is Marque's unit of provenance: one patch, hashed, signed by the
 * author's session key, and anchored on Solana.
 *
 * The session key is an ed25519 keypair generated in the browser and kept in
 * localStorage. It never crosses the network — only public key and signature
 * do. This is deliberately a session identity, not a wallet: signing a patch
 * should never require the key that holds funds.
 */

const STORE_KEY = "marque.session-key.v1";

export type SessionKey = {
  publicKey: string; // base58
  secretKey: Uint8Array; // 64 bytes
};

export type Seal = {
  id: string;
  file: string;
  digest: string;
  signature: string; // base58
  author: string; // base58 public key
  agent: string;
  summary: string;
  createdAt: string;
  txSignature?: string;
  explorerUrl?: string;
  status: "local" | "anchoring" | "anchored" | "failed";
  error?: string;
};

export function loadSessionKey(): SessionKey {
  if (typeof window === "undefined") {
    throw new Error("Session keys are browser-only.");
  }
  const stored = window.localStorage.getItem(STORE_KEY);
  if (stored) {
    try {
      const secretKey = bs58.decode(stored);
      if (secretKey.length === 64) {
        const pair = nacl.sign.keyPair.fromSecretKey(secretKey);
        return { publicKey: bs58.encode(pair.publicKey), secretKey };
      }
    } catch {
      // Corrupted entry; fall through and mint a fresh key.
    }
  }
  const pair = nacl.sign.keyPair();
  window.localStorage.setItem(STORE_KEY, bs58.encode(pair.secretKey));
  return { publicKey: bs58.encode(pair.publicKey), secretKey: pair.secretKey };
}

export function rotateSessionKey(): SessionKey {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORE_KEY);
  return loadSessionKey();
}

/**
 * Canonical form of a patch. Both the signer and any later verifier must build
 * this string identically, so the rules are fixed here and nowhere else:
 * newline-joined, trailing whitespace preserved, file path first.
 */
export function canonicalPatch(file: string, before: string, after: string): string {
  return ["marque/v1", file, "---", before, "+++", after].join("\n");
}

export async function digestPatch(
  file: string,
  before: string,
  after: string,
): Promise<string> {
  return sha256Hex(canonicalPatch(file, before, after));
}

export function signDigest(digest: string, key: SessionKey): string {
  const message = new TextEncoder().encode(digest);
  const sig = nacl.sign.detached(message, key.secretKey);
  return bs58.encode(sig);
}

export function verifySeal(seal: Pick<Seal, "digest" | "signature" | "author">) {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(seal.digest),
      bs58.decode(seal.signature),
      bs58.decode(seal.author),
    );
  } catch {
    return false;
  }
}

/** Ask the server to write the seal to devnet and return the transaction. */
export async function anchorSeal(seal: Seal): Promise<{
  txSignature: string;
  explorerUrl: string;
  slot: number;
}> {
  const res = await fetch("/api/attest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      digest: seal.digest,
      signature: seal.signature,
      author: seal.author,
      file: seal.file,
      agent: seal.agent,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `attest failed (${res.status})`);
  return json;
}

const LEDGER_KEY = "marque.ledger.v1";

export function readLedger(): Seal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LEDGER_KEY) ?? "[]") as Seal[];
  } catch {
    return [];
  }
}

export function writeLedger(seals: Seal[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEDGER_KEY, JSON.stringify(seals.slice(0, 200)));
}
