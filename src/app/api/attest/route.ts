import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

/**
 * Anchors a seal on Solana devnet.
 *
 * The user's session key signs the digest in the browser. This route verifies
 * that signature, then a relayer keypair pays for a memo transaction carrying
 * the record. The relayer never sees the session secret and cannot forge a
 * seal — it only pays rent for one that already verifies.
 *
 * Memo program: https://spl.solana.com/memo
 */

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const RPC = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
const CLUSTER = process.env.SOLANA_CLUSTER ?? "devnet";

function relayer(): Keypair {
  const raw = process.env.MARQUE_RELAYER_SECRET;
  if (!raw) throw new Error("MARQUE_RELAYER_SECRET is not set on this deployment.");
  const trimmed = raw.trim();

  // Accept a 64-byte base58 secret, a JSON byte array, or a 32-byte hex seed.
  if (trimmed.startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
  }
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Keypair.fromSeed(Uint8Array.from(Buffer.from(trimmed, "hex")));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

type Body = {
  digest?: string;
  signature?: string;
  author?: string;
  file?: string;
  agent?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { digest, signature, author, file = "", agent = "unknown" } = body;

  if (!digest || !/^[0-9a-f]{64}$/.test(digest)) {
    return NextResponse.json(
      { error: "digest must be a 64-character hex SHA-256." },
      { status: 400 },
    );
  }
  if (!signature || !author) {
    return NextResponse.json(
      { error: "signature and author are both required." },
      { status: 400 },
    );
  }

  // Reject anything that does not verify before spending a lamport on it.
  let valid = false;
  try {
    valid = nacl.sign.detached.verify(
      new TextEncoder().encode(digest),
      bs58.decode(signature),
      bs58.decode(author),
    );
  } catch {
    return NextResponse.json(
      { error: "signature or author is not valid base58." },
      { status: 400 },
    );
  }
  if (!valid) {
    return NextResponse.json(
      { error: "Signature does not verify against the supplied public key." },
      { status: 400 },
    );
  }

  let payer: Keypair;
  try {
    payer = relayer();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "relayer unavailable" },
      { status: 503 },
    );
  }

  // Memo payloads are capped well below 1232 bytes of transaction; keep it tight.
  const memo = JSON.stringify({
    p: "marque/v1",
    d: digest,
    a: author,
    s: signature.slice(0, 44),
    f: file.slice(0, 96),
    g: agent.slice(0, 40),
    t: Math.floor(Date.now() / 1000),
  });

  try {
    const connection = new Connection(RPC, "confirmed");

    const balance = await connection.getBalance(payer.publicKey);
    if (balance === 0) {
      return NextResponse.json(
        {
          error: `Relayer ${payer.publicKey.toBase58()} has no devnet SOL. Fund it at faucet.solana.com.`,
        },
        { status: 503 },
      );
    }

    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM,
        data: Buffer.from(memo, "utf8"),
      }),
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    const txSignature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction(
      { signature: txSignature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    const status = await connection.getSignatureStatus(txSignature);

    return NextResponse.json({
      txSignature,
      slot: status.value?.slot ?? 0,
      cluster: CLUSTER,
      relayer: payer.publicKey.toBase58(),
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=${CLUSTER}`,
      memo,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Transaction failed against the cluster.",
      },
      { status: 502 },
    );
  }
}
