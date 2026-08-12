# Core

Depends on nothing. Everything above may import from here.

## Landed

| Module | Role |
|---|---|
| `random.ts` | Seeded PRNG — the only legal source of randomness |
| `math.ts` | Deterministic replacements for banned transcendentals (ADR 0032 §4) |
| `canonicalJson.ts` / `digest.ts` | Byte-stable encoding and digests for replay / certificates |
| `ids.ts` | `PieceId` and related branded identifiers |

## Rules

- `Math.random` is lint-banned outside the PRNG module.
- `Math.exp` / `Math.pow` / `Math.log` / trig / `**` are lint-banned in
  `psychology/` and `chess/` — use `math.ts`.
- Digests and fingerprints must be stable across JS engines; quantize before
  branching comparisons.
