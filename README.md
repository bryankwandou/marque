<div align="center">

<img src="public/marque-mark.svg" width="72" height="72" alt="Marque" />

# Marque

**A browser code workspace that keeps a verifiable record of what its agents wrote.**

[Live](https://marque-ide.vercel.app) · [Workbench](https://marque-ide.vercel.app/studio) · [Deck](https://marque-ide.vercel.app/deck)

</div>

---

## The problem

A growing share of production code is written by models rather than people. Git
records who *committed* a change; nothing records who or what *authored* it, under
what instruction, or with which model. When a regression traces back to a patch
nobody remembers approving, there is no artefact to point at.

Provenance systems that already exist for container images and package registries
have no equivalent at the level where the change actually happens: the patch.

## What Marque does

Marque is an IDE that runs in a browser tab. When an agent proposes a change, the
workspace:

1. builds a canonical string from the file path and the text before and after,
2. takes its SHA-256,
3. signs that digest with an ed25519 key generated in your tab,
4. writes the digest, your public key, and the file path to Solana devnet.

The result is a transaction anyone can open. Given the patch and the public key, a
third party can recompute the digest and check the signature offline, then compare
it against the chain. Marque does not have to be trusted for the record to hold.

## Why a chain

The log has to be append-only against the party being audited. A database owned by
the tool vendor cannot serve as evidence about the tool vendor. Solana was chosen
for cost and finality — a memo transaction confirms in well under a second for a
fraction of a cent, which is the difference between sealing every patch and sealing
the ones someone remembered to.

**This deployment runs on devnet only.** No mainnet contract exists.

---

## What runs today

| | |
| --- | --- |
| Editor | Monaco, custom `marque` theme, TypeScript/JSON/CSS diagnostics |
| Terminal | xterm.js with a working shell over the virtual workspace |
| Extensions | Live search across all of Open VSX, with the top 2,000 pinned on disk so the marketplace still answers with no network |
| Agent | Streaming, any OpenAI-compatible endpoint, patches applied per file |
| Local models | Ollama, LM Studio, llama.cpp and Jan, called straight from the tab. Weights stay on disk and reach the GPU or the full CPU |
| History | Every version of every file appended to IndexedDB, restorable one click at a time. Autosave writes it; nothing is ever overwritten |
| Connectors | GitHub read and commit, Vercel project listing, n8n webhook trigger — all direct from the browser, tokens never touch our server |
| Screen | Capture a frame, record a clip, or hand a frame to a local vision model and ask what is on it |
| Seals | ed25519 signing in-tab, memo anchoring on devnet, verify on read |
| Persistence | Files and seals in localStorage, revisions in IndexedDB; nothing is uploaded |

### Running a model on your own machine

The agent panel points at whatever the Models panel selects. Pick a local runtime
and the request never leaves the laptop:

```bash
# once
curl -fsSL https://ollama.com/install.sh | sh      # or the Windows installer
ollama pull qwen2.5-coder:7b                       # 4.7 GB

# every time, so the browser is allowed to call it
OLLAMA_ORIGINS=https://marque-ide.vercel.app ollama serve
```

The panel probes `http://localhost:11434/v1`, lists what is on disk, and hands you
that `OLLAMA_ORIGINS` line pre-filled with the origin you are actually on. LM
Studio (`:1234`), llama.cpp (`:8080`) and Jan (`:1337`) work the same way.

A browser tab cannot reach an NPU — there is no web API for one — and cannot pin a
CPU at 99%. The runtime does both, which is exactly why the weights live outside
the tab rather than inside it.

### What does not

- No desktop or mobile build.
- No OS emulators. iOS, Android and Windows images cannot run in a tab.
- No Blender, Photoshop or Adobe connectors. Those need a local bridge process,
  which is not a browser feature and is not shipped here.
- Replit has no public API for writing files, so there is no connector for it.
- Language servers beyond what Monaco ships in-browser.
- Extensions requiring a Node extension host are listed but do not execute.
- Mainnet.

Stating this plainly is deliberate. A project claiming parity with a decade-old
editor after one build cycle is not credible.

### On the numbers

Open VSX held **17,595** extensions when this snapshot was taken, and the headline
on the landing page reads that count from the registry rather than from a constant
somebody typed once. There is no open registry anywhere with 295,000 entries; the
VS Code Marketplace has roughly 75,000 and its terms forbid third-party clients.
The command palette carries the workbench commands plus every action Monaco itself
exposes — a few hundred, enumerated live from the editor instance, not padded.

---

## Running it

```bash
git clone https://github.com/bryankwandou/marque
cd marque
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | for the agent | Any OpenAI-compatible key |
| `AGENT_BASE_URL` | no | Defaults to Groq. Point elsewhere to switch provider |
| `AGENT_MODEL` | no | Defaults to `openai/gpt-oss-120b` |
| `MARQUE_RELAYER_SECRET` | for anchoring | Pays devnet fees. base58, JSON array, or hex seed |
| `SOLANA_RPC_URL` | no | Defaults to the public devnet endpoint |

Fund the relayer at [faucet.solana.com](https://faucet.solana.com). Without it the
workbench still runs; seals stay local and say so.

---

## How a seal is built

The canonical form is fixed so two parties compute the same digest:

```
marque/v1
<file path>
---
<content before>
+++
<content after>
```

```ts
digest    = sha256(canonical)
signature = ed25519.sign(digest, sessionKey)   // in the browser
memo      = { p: "marque/v1", d: digest, a: pubkey, s: sig, f: path, g: agent, t: unix }
```

The server verifies the signature **before** it spends anything. A request that
does not verify is rejected at the route, so the relayer cannot be drained by
forged seals.

### Verifying one yourself

```ts
import nacl from "tweetnacl";
import bs58 from "bs58";

const ok = nacl.sign.detached.verify(
  new TextEncoder().encode(digest),
  bs58.decode(signature),
  bs58.decode(publicKey),
);
```

Then open `https://explorer.solana.com/tx/<sig>?cluster=devnet` and read the memo.

---

## Architecture

```
src/
  app/
    page.tsx              landing
    studio/page.tsx       the workbench
    deck/page.tsx         pitch deck
    api/
      extensions/         Open VSX proxy, 5 min revalidate, snapshot fallback
      agent/              streaming chat completions (edge)
      attest/             verify signature -> memo transaction
  components/
    landing/              hero, mechanism, registry, comparison, faq
    studio/               editor, terminal, agent, seals, extensions, palette,
                          history, models, connectors, screen
  lib/
    seal.ts               keypair, canonical patch, sign, verify, anchor
    workspace.ts          virtual filesystem (zustand + persist)
    history.ts            append-only revision log in IndexedDB
    models.ts             local runtime discovery and streaming
    connectors.ts         GitHub, Vercel and n8n, called from the browser
    screen.ts             getDisplayMedia capture and recording
    editor-bridge.ts      hands Monaco's own action list to the palette
```

## Security notes

- The session secret key is generated in-tab and stored in `localStorage`. It is
  never transmitted and never logged.
- The signing key is deliberately **not** a wallet. Signing a patch should not
  require the key holding funds.
- The relayer key lives in server environment only and is never exposed to the
  client bundle.
- `/api/attest` validates the digest shape and verifies the signature before any
  RPC call.
- Connector tokens live in `localStorage` on the machine that typed them and are
  sent only to the service they belong to. That is the same trust boundary as the
  signing key, and it means anything able to run script on this origin can read
  them: scope a GitHub token to the one repository you mean.
- Screen capture goes through `getDisplayMedia`, so the browser's own picker
  decides what the tab can see. Reading a frame with a model is restricted to a
  local runtime, so a picture of a desktop is never posted to a hosted provider.

## Licences and attribution

Monaco (MIT, Microsoft) and xterm.js (MIT) are used as published. Extension
metadata comes from [Open VSX](https://open-vsx.org), an Eclipse Foundation
registry whose terms permit third-party clients. No proprietary editor code is
copied and no licensing is circumvented. Marque is not affiliated with Microsoft,
Google, or any editor vendor referenced in this repository.

## Licence

MIT.
