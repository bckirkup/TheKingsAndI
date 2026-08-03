# Chess

Milestone 1.1–1.2: a chess.js wrapper that adds the one thing chess.js does not
have — **piece identity** — plus the geometric features `psychology/` consumes.

| Module | Responsibility |
|---|---|
| `types.ts` | Chess-layer types. `psychology/` may import these, type-only (ADR 0013). |
| `board.ts` | `LivingBoard`: legality, FEN/SAN, and a square → `PieceId` map maintained through captures, castling, promotion, and en passant. |
| `features.ts` | Threat maps and per-move features: `ΔV_capture`, material delta, `P_captured`, peer safety deltas, King safety delta. |

## Identity rules

- A `PieceId` is minted once per piece from the starting position and never
  changes. Promotion mutates `role`, never `id`.
- Castling relocates two identities in one move; the rook keeps its own `id`.
- En passant removes the identity on the *victim's* square, not the
  destination square.
- `pieces()`, `legalMoves()`, and every feature record are returned in a
  canonical order (`PieceId`, then LAN) so nothing downstream can depend on
  enumeration order.

## Determinism rules

- No transcendentals here (lint-enforced, ADR 0032 §4). Risk is accumulated in
  integer thousandths (`RISK_SCALE`) and divided only on the way out, so a
  comparison that decides a verdict cannot be flipped by a last-bit difference.
- `extractMoveFeatures` applies the move to a `clone()`; the caller's board is
  never mutated.
- No engine call happens here. These are facts about the geometry; what a piece
  *believes* about them belongs to `psychology/`, and `ΔV_board` arrives later
  from `engine/` (Milestone 1.3).
