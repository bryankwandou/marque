# Marque — submission notes

## One line

A browser IDE where every patch an AI agent writes is hashed, signed in-tab, and
anchored on Solana, so machine authorship becomes checkable instead of assumed.

## The problem, stated without inflation

Git records who *committed* a change. It records nothing about who or what
*authored* it. As agents write a growing share of shipped code, that omission
compounds: a regression traces back to a patch nobody remembers approving, and
there is no artefact establishing whether a person wrote it, a model drafted it,
or an unattended agent produced it overnight.

Provenance tooling already exists one layer up — signed container images, signed
package releases. It stops at the patch, which is where authorship actually
happens.

## What was built

| Component | State |
| --- | --- |
| Monaco editor, custom theme, bundled locally for offline use | Working |
| xterm.js terminal with a real shell over the virtual workspace | Working |
| Open VSX live search, whole registry | Working |
| Pinned 2,000-extension snapshot as the offline fallback | Working |
| Streaming agent panel, four models, per-file patch application | Working |
| Local runtimes — Ollama, LM Studio, llama.cpp, Jan — driven straight from the tab | Working |
| Append-only revision log in IndexedDB with one-click restore | Working |
| GitHub read and commit, Vercel listing, n8n webhook, all browser-direct | Working |
| Screen capture, recording, and frame reading through a local vision model | Working |
| ed25519 seal: canonical patch → SHA-256 → sign → devnet memo | Working |
| Third-party verifier at `/verify`, fully client-side | Working |
| Desktop build, mainnet, Node-host extensions | Not built |
| OS emulators, Blender/Photoshop bridges, Replit connector | Not built, see below |

## Running the model locally

This is the part that makes the workbench useful with no network and no account.
The Models panel probes an OpenAI-compatible server on loopback, lists the models
actually on disk, and the agent panel then talks to it directly from the browser.

```bash
ollama pull qwen2.5-coder:7b                        # 4.7 GB, one time
OLLAMA_ORIGINS=https://marque-ide.vercel.app ollama serve
```

The panel generates that second line with the current origin already filled in,
because a missing `OLLAMA_ORIGINS` is what breaks this for nearly everyone the
first time. LM Studio, llama.cpp and Jan need only their local server switched on.

Two claims worth refusing rather than fudging: a browser tab has no API that
reaches an NPU, and it cannot drive a CPU to 99%. The runtime does both. That is
the reason the weights sit outside the tab instead of being downloaded into it.

## Numbers, checked rather than asserted

- Open VSX held **17,607** extensions at the last live query. The landing page
  reads that figure from the registry at load time.
- **2,000** of them are pinned in `src/data/catalog.json`, which is what answers
  when the registry is unreachable.
- There is no open registry with 295,000 extensions. The VS Code Marketplace has
  roughly 75,000 and its terms forbid third-party clients, which is why Marque
  does not read it.
- The command palette lists the workbench commands plus every action the live
  Monaco instance exposes, enumerated at open time — a few hundred, none padded.

## Solana usage

Not decorative. The chain does one job the rest of the stack cannot: hold an
append-only record that survives the party being audited.

- **Program:** SPL Memo (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`)
- **Cluster:** devnet
- **Payload:** `{ p, d, a, s, f, g, t }` — protocol tag, digest, author pubkey,
  signature prefix, file path, agent id, unix timestamp
- **Server-side guard:** `/api/attest` verifies the ed25519 signature *before*
  any RPC call, so the relayer cannot be drained by forged seals

Why memo rather than a custom program: the record is a claim, not state to be
mutated. Nothing here needs an account model, and a memo settles sub-second for a
fraction of a cent — which is what makes sealing *every* patch viable rather than
a select few.

## Why it is not just another AI IDE

The editor is the acquisition surface, not the product. Editors are copyable in a
quarter. A continuous, verifiable record of machine authorship is not — it
accrues value with every seal and cannot be backfilled by a competitor who starts
later. The endgame is a verification layer that CI, review, and procurement query;
the IDE exists because seals must be created at the moment of authorship.

`/verify` is the load-bearing page. It lets a sceptic recompute the digest and
check the signature without running our code or trusting our server.

## Honest limitations

1. **A seal proves vouching, not typing.** It attests that a keyholder stood
   behind a patch. That is accountability, not surveillance, and the product says
   so rather than implying more.
2. **Demand is on a regulator's timetable.** Provenance is a compliance purchase.
   If that demand is years out, the ledger has no buyer — which is why the IDE has
   to be worth using on its own merits today.
3. **Some connectors cannot exist in a browser.** Blender and Photoshop have no
   web-callable API; driving them needs a bridge process on the desktop, which is
   a different product. Replit publishes no API for writing into a Repl. iOS,
   Android and Windows images cannot be emulated in a tab. Each of these is listed
   in the workbench with the reason rather than shown as a dead button.
4. **Platform risk is real.** GitHub could ship signed authorship metadata to
   every repository at once. The counter is that a vendor-owned log is exactly
   what an auditor discounts.

## Reproducing the demo

```bash
git clone https://github.com/bryankwandou/marque
cd marque && npm install
cp .env.example .env.local     # add GROQ_API_KEY and MARQUE_RELAYER_SECRET
npm run dev
```

1. Open `/studio`. `src/ledger/settle.ts` loads by default.
2. In the agent panel: *"Replace the hardcoded fee with the schedule lookup."*
3. Press **apply** on the returned patch.
4. Press **Seal** (or `Ctrl S`, or type `seal` in the terminal).
5. The Seals panel shows the digest, signer, and a devnet transaction link.
6. Paste the digest, signature, and public key into `/verify` to confirm offline.

## Links

- Live: https://marque-ide.vercel.app
- Workbench: https://marque-ide.vercel.app/studio
- Verifier: https://marque-ide.vercel.app/verify
- Deck: https://marque-ide.vercel.app/deck
- Source: https://github.com/bryankwandou/marque

## On-chain proof

Run from a clean checkout against the deployed app:

```
node scripts/smoke-seal.mjs https://marque-ide.vercel.app
```

The script builds a canonical patch, hashes it, signs it with a throwaway
ed25519 pair, posts it to `/api/attest`, then reads the transaction back off
`api.devnet.solana.com` and asserts the memo carries the digest that was signed.
It also sends a forged signature first and asserts the route answers 400 without
touching the relayer key.

Most recent run, 10 September 2026, against the production build at
marque-ide.vercel.app:

| Check | Result |
| --- | --- |
| Local signature verify | PASS |
| Forged seal rejected (400) | PASS |
| Anchored on devnet | slot 496139376 |
| Memo carries the signed digest | PASS |

Transaction:
https://explorer.solana.com/tx/4PWAeoUMEWUvPkkjUDusN9hnF6nPVNrYq3ySwpFULGTzRHGivU8CT81bidA5ds86PdDi9wk76NZwTVfhRuGMWRRC?cluster=devnet

## Offline extensions

The marketplace searches Open VSX live, so results are current. That assumes a
network, which the rest of the workbench does not. To close the gap,
`scripts/fetch-catalog.mjs` pins the 2000 most-installed extensions to
`src/data/catalog.json` in twenty pages of one hundred, and `/api/extensions`
serves that snapshot whenever the registry cannot be reached. Search still runs
over it, results are still ranked by install count, and both the extensions panel
and the landing page label the state rather than passing stale counts off as live.

Exercise the fallback without unplugging anything:

```
OPEN_VSX_SEARCH_URL=https://registry.invalid.example/api/-/search npm run dev
```

The route then answers `"source": "snapshot"` and search keeps working, for
example `?q=docker` returns eleven matches led by `ms-azuretools.vscode-docker`.

Refresh the snapshot with `npm run catalog`.
