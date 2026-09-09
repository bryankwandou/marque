import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "node:crypto";

/**
 * End-to-end proof that the seal pipeline works against the deployed app:
 * build a canonical patch, hash it, sign it, anchor it, then confirm the
 * transaction exists on devnet and carries the digest we signed.
 *
 * Usage: node scripts/smoke-seal.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "https://marque-ide.vercel.app";

const file = "src/ledger/settle.ts";
const before = `export async function settle(order: Order) {
  const fee = order.total * 0.03;
  return ledger.commit(order, fee);
}`;
const after = `export async function settle(order: Order) {
  const fee = feeSchedule.resolve(order.tier);
  assert(fee <= order.total * 0.05, "fee ceiling");
  return ledger.commit(order, fee);
}`;

const canonical = ["marque/v1", file, "---", before, "+++", after].join("\n");
const digest = createHash("sha256").update(canonical, "utf8").digest("hex");

const pair = nacl.sign.keyPair();
const signature = bs58.encode(
  nacl.sign.detached(new TextEncoder().encode(digest), pair.secretKey),
);
const author = bs58.encode(pair.publicKey);

console.log("digest    ", digest);
console.log("author    ", author);
console.log("signature ", signature.slice(0, 24) + "…");

// 1. Signature must verify locally before we ask the server for anything.
const localOk = nacl.sign.detached.verify(
  new TextEncoder().encode(digest),
  bs58.decode(signature),
  bs58.decode(author),
);
console.log("local verify:", localOk ? "PASS" : "FAIL");

// 2. A tampered signature must be rejected by the route.
const tampered = bs58.encode(nacl.sign.detached(
  new TextEncoder().encode(digest.replace(/.$/, "0")),
  nacl.sign.keyPair().secretKey,
));
const bad = await fetch(`${BASE}/api/attest`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ digest, signature: tampered, author, file, agent: "smoke" }),
});
console.log(
  "forged seal rejected:",
  bad.status === 400 ? "PASS" : `FAIL (got ${bad.status})`,
);

// 3. The real one must land on chain.
const res = await fetch(`${BASE}/api/attest`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ digest, signature, author, file, agent: "smoke-test" }),
});
const body = await res.json();

if (!res.ok) {
  console.error("anchor FAILED:", body.error ?? res.status);
  process.exit(1);
}

console.log("\nanchored");
console.log("  tx      ", body.txSignature);
console.log("  slot    ", body.slot);
console.log("  cluster ", body.cluster);
console.log("  explorer", body.explorerUrl);

// 4. Read it back off the cluster and confirm the memo carries our digest.
const rpc = "https://api.devnet.solana.com";
let found = null;
for (let attempt = 0; attempt < 8 && !found; attempt++) {
  await new Promise((r) => setTimeout(r, 2000));
  const tx = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [body.txSignature, { encoding: "json", maxSupportedTransactionVersion: 0 }],
    }),
  }).then((r) => r.json());
  found = tx.result;
}

if (!found) {
  console.error("\non-chain readback FAILED: transaction not visible yet");
  process.exit(1);
}

const logs = (found.meta?.logMessages ?? []).join("\n");
const carriesDigest = logs.includes(digest);

console.log("\non-chain readback");
console.log("  confirmed slot:", found.slot);
console.log("  memo carries digest:", carriesDigest ? "PASS" : "FAIL");
console.log(
  "\nRESULT:",
  localOk && carriesDigest ? "seal pipeline verified end to end" : "SOMETHING FAILED",
);
