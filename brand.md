# Marque — Brand & Design System

Single source of truth for colour, type, motion, and voice. Anything built in this
repository defers to this file.

---

## 1. The name

A *letter of marque* was a document issued by a sovereign that authorised a private
vessel to act with state authority — and made that vessel answerable for what it did
under that authority. Delegated power, on the record.

That is the exact shape of the problem Marque addresses. An AI agent writes code on
your behalf. Today nothing records that it did, what it touched, or under whose
authority. Marque issues the letter and keeps the register.

Secondary reading: a *marque* is a maker's mark — the stamp a smith strikes into
finished metal. The product signs work. The name says so twice.

---

## 2. Visual theme

Struck metal, not glass. The reference points are signet rings, hallmarked silver,
and letterpress dies — objects whose entire purpose is to prove something is genuine.
Surfaces are warm-black and matte. The single accent is brass, used the way a hallmark
is used: rarely, and only where authenticity is being asserted.

Explicitly rejected: violet-to-cyan gradients, glassmorphism, floating 3D blobs,
neon-on-navy. Those read as generic AI product and undercut a trust claim.

---

## 3. Colour

Tokens live in `src/app/globals.css` under `@theme`. Names below are canonical.

### Surfaces (warm neutral, never pure grey)

| Token | Hex | Role |
| --- | --- | --- |
| `ink` | `#0A0908` | Page background, deepest level |
| `surface` | `#121110` | Cards, panels, editor chrome |
| `surface-raised` | `#1A1817` | Menus, popovers, active tabs |
| `line` | `#262321` | Hairline dividers, 1px borders |
| `line-strong` | `#3A3532` | Input borders, focus containers |

### Content

| Token | Hex | Role |
| --- | --- | --- |
| `paper` | `#FAF7F2` | Primary text on dark |
| `muted` | `#A39C92` | Secondary text, labels |
| `faint` | `#6B655D` | Tertiary, timestamps, placeholder |

### Accent — brass

| Token | Hex | Role |
| --- | --- | --- |
| `brass` | `#E6A94E` | Primary accent. Signature, CTA, active state |
| `brass-hi` | `#F4CE8C` | Gradient stop, hover lift |
| `brass-lo` | `#A96F27` | Gradient stop, pressed |

**Rule:** brass appears at most three times per viewport. If a fourth use is tempting,
one of the other three was not important.

### Semantic

| Token | Hex | Role |
| --- | --- | --- |
| `verdigris` | `#4FB79A` | Verified on-chain, additions, success |
| `oxide` | `#D2603F` | Deletions, destructive, failure |
| `azurite` | `#5B8DEF` | Links, informational, in-flight |

Verdigris is the patina copper forms with age — the visual proof a seal is old and
untampered. It is the only colour permitted to mark a confirmed attestation.

---

## 4. Typography

| Role | Family | Notes |
| --- | --- | --- |
| Display / headings | `Instrument Serif` | Only at 40px+. Tight leading, `-0.02em`. |
| UI / body | `Inter` | Variable. Body `-0.011em`, UI `-0.006em`. |
| Code / data | `JetBrains Mono` | Editor, terminal, hashes, addresses, numerals. |

Scale (rem): `0.6875 · 0.75 · 0.8125 · 0.875 · 1 · 1.125 · 1.375 · 1.75 · 2.25 · 3 · 4`

**Rules**
- Every hash, public key, signature, and file path is monospace. No exceptions.
- Never centre a paragraph longer than two lines.
- Measure caps at 68 characters.
- Numerals in tables use `font-variant-numeric: tabular-nums`.

---

## 5. Layout & spacing

4px base unit. Permitted steps: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.

- Content max width `1200px`; prose max width `680px`.
- Workbench chrome uses an 8px rhythm; marketing pages use a 24px rhythm.
- Radii: `6px` controls, `10px` cards, `16px` modals, `999px` pills. The logo's `17/64`
  ratio is the only squircle in the system.

---

## 6. Depth

Light comes from directly above. Shadows are warm-black, never blue-black.

```
--shadow-sm: 0 1px 2px rgb(10 9 8 / 0.40)
--shadow-md: 0 4px 16px -2px rgb(10 9 8 / 0.50)
--shadow-lg: 0 16px 48px -12px rgb(10 9 8 / 0.65)
```

Elevation is carried primarily by surface value, not by shadow. A raised panel is
lighter first and shadowed second.

---

## 7. Motion

| Purpose | Duration | Easing |
| --- | --- | --- |
| Hover, focus, colour | 120ms | `cubic-bezier(0.2, 0, 0.38, 0.9)` |
| Enter, expand | 240ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Layout, page | 380ms | spring, stiffness 260, damping 30 |

**Rules**
- Stagger lists at 40ms per item, capped at 8 items.
- Nothing animates on scroll more than once.
- Everything respects `prefers-reduced-motion: reduce` — transforms collapse to
  opacity-only, durations drop to 0.01ms.
- No parallax. No autoplaying loops longer than 4 seconds.

---

## 8. The mark

A brass die with the letter M struck through it — knocked out, not drawn, so the mark
reads as an impression left in metal rather than an icon placed on a surface. A 1.25px
inner rim at 18% black gives the raised edge of a stamp.

- `public/marque-mark.svg` — full colour, 64×64
- `public/marque-mark-mono.svg` — `currentColor`, for single-colour contexts
- `src/app/icon.svg` — favicon, heavier stroke and no rim for legibility at 16px

Clear space equals one quarter of the mark's width on all sides. Never place the mark
on brass. Never rotate, outline, or add effects to it.

---

## 9. Voice

Write like a senior engineer explaining a system to a peer who is short on time.

**Do**
- Lead with the mechanism. "Every edit is signed with your keypair and the digest is
  written to Solana."
- Use concrete numbers. "16,371 extensions" beats "a huge library".
- Admit limits plainly. "Devnet only. Mainnet is not deployed."

**Do not**
- No emoji anywhere in product surfaces, marketing copy, or commit messages.
- Banned vocabulary: seamless, unleash, empower, revolutionise, game-changing,
  cutting-edge, robust, leverage (as a verb), delve, tapestry, testament, elevate,
  supercharge, journey, unlock the power of.
- No em-dash-and-tricolon rhythm in consecutive sentences.
- No sentence that would survive unchanged if the product were something else.

---

## 10. Do's and don'ts

| Do | Don't |
| --- | --- |
| Warm-black surfaces | Pure `#000` or blue-black `#0A0A0F` |
| Brass on dark | Brass on brass, or brass text under 14px |
| Monospace for all identifiers | Proportional font for a public key |
| State the network on every on-chain claim | Imply mainnet when running devnet |
| One accent per viewport region | Accent-coloured decoration |
