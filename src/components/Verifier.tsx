"use client";

import { useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { canonicalPatch, verifySeal } from "@/lib/seal";
import { sha256Hex, cn } from "@/lib/utils";

/**
 * The page that makes Marque's claim falsifiable. Everything here runs in the
 * browser — no request is made, so a sceptic can verify offline.
 */

type Result =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "done";
      computed: string;
      digestMatches: boolean | null;
      signatureValid: boolean;
    };

export function Verifier() {
  const [path, setPath] = useState("src/ledger/settle.ts");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [digest, setDigest] = useState("");
  const [signature, setSignature] = useState("");
  const [author, setAuthor] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const run = async () => {
    try {
      const computed = await sha256Hex(canonicalPatch(path, before, after));
      const claimed = digest.trim().toLowerCase();
      const digestMatches = claimed ? computed === claimed : null;

      const signatureValid =
        signature.trim() && author.trim()
          ? verifySeal({
              digest: claimed || computed,
              signature: signature.trim(),
              author: author.trim(),
            })
          : false;

      setResult({ kind: "done", computed, digestMatches, signatureValid });
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not verify.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-[1000px] px-6">
      <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-brass">
        Verify
      </span>
      <h1 className="mt-3 text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-paper">
        Check a seal without taking our word for it
      </h1>
      <p className="mt-4 max-w-[68ch] text-[15.5px] leading-[1.68] text-muted">
        Paste the patch and the seal. This page rebuilds the canonical string,
        recomputes the SHA-256, and checks the ed25519 signature against the public
        key. Nothing is sent anywhere — open your network tab and confirm it.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Field label="File path" value={path} onChange={setPath} mono />
          <Area label="Content before" value={before} onChange={setBefore} />
          <Area label="Content after" value={after} onChange={setAfter} />
        </div>

        <div className="space-y-4">
          <Field
            label="Claimed digest (optional)"
            value={digest}
            onChange={setDigest}
            mono
            placeholder="64 hex characters"
          />
          <Field
            label="Signature"
            value={signature}
            onChange={setSignature}
            mono
            placeholder="base58"
          />
          <Field
            label="Signer public key"
            value={author}
            onChange={setAuthor}
            mono
            placeholder="base58"
          />

          <button
            type="button"
            onClick={() => void run()}
            className="w-full rounded-[6px] bg-brass px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-brass-hi"
          >
            Verify
          </button>

          <Outcome result={result} />
        </div>
      </div>

      <div className="mt-14 rounded-[10px] border border-line bg-surface p-6">
        <h2 className="text-[15px] font-medium text-paper">
          The canonical form, so you can reimplement it
        </h2>
        <pre className="mt-3 overflow-x-auto font-mono text-[12px] leading-[1.8] text-muted">
          <code>{`marque/v1
<file path>
---
<content before>
+++
<content after>`}</code>
        </pre>
        <p className="mt-4 max-w-[74ch] text-[13.5px] leading-[1.65] text-muted">
          Joined with newlines, hashed with SHA-256, hex encoded lowercase. The
          signature is ed25519 over the hex digest string, encoded base58. Both are
          standard primitives with implementations in every language, which is the
          point — verification must not require our code.
        </p>
      </div>
    </div>
  );
}

function Outcome({ result }: { result: Result }) {
  if (result.kind === "idle") {
    return (
      <div className="flex items-start gap-2.5 rounded-[6px] border border-line bg-surface px-3.5 py-3">
        <ShieldQuestion size={15} className="mt-0.5 shrink-0 text-faint" />
        <p className="text-[12.5px] leading-[1.55] text-faint">
          Fill in the patch and the seal, then verify.
        </p>
      </div>
    );
  }

  if (result.kind === "error") {
    return (
      <div className="flex items-start gap-2.5 rounded-[6px] border border-oxide/30 bg-oxide/10 px-3.5 py-3">
        <ShieldAlert size={15} className="mt-0.5 shrink-0 text-oxide" />
        <p className="text-[12.5px] leading-[1.55] text-oxide">{result.message}</p>
      </div>
    );
  }

  const good = result.signatureValid && result.digestMatches !== false;

  return (
    <div
      className={cn(
        "rounded-[6px] border px-3.5 py-3",
        good
          ? "border-verdigris/30 bg-verdigris/10"
          : "border-oxide/30 bg-oxide/10",
      )}
    >
      <div className="flex items-center gap-2">
        {good ? (
          <ShieldCheck size={15} className="shrink-0 text-verdigris" />
        ) : (
          <ShieldAlert size={15} className="shrink-0 text-oxide" />
        )}
        <p
          className={cn(
            "text-[13px] font-medium",
            good ? "text-verdigris" : "text-oxide",
          )}
        >
          {good ? "Seal holds" : "Seal does not hold"}
        </p>
      </div>

      <dl className="mt-3 space-y-1.5 font-mono text-[11px]">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-faint">computed</dt>
          <dd className="min-w-0 flex-1 break-all text-muted">{result.computed}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-faint">digest</dt>
          <dd
            className={cn(
              result.digestMatches === null
                ? "text-faint"
                : result.digestMatches
                  ? "text-verdigris"
                  : "text-oxide",
            )}
          >
            {result.digestMatches === null
              ? "not supplied"
              : result.digestMatches
                ? "matches"
                : "does not match"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-faint">signature</dt>
          <dd className={result.signatureValid ? "text-verdigris" : "text-oxide"}>
            {result.signatureValid ? "valid" : "invalid or absent"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.11em] text-faint">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-[13px] text-paper outline-none transition-colors duration-150 focus:border-brass placeholder:text-faint",
          mono && "font-mono text-[12px]",
        )}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.11em] text-faint">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        spellCheck={false}
        className="w-full resize-y rounded-[6px] border border-line bg-surface px-3 py-2 font-mono text-[12px] leading-[1.6] text-paper outline-none transition-colors duration-150 focus:border-brass"
      />
    </label>
  );
}
