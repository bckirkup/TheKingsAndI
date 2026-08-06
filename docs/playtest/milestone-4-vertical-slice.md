# Milestone 4 — Vertical slice playtest note

_Date: 2026-08-06 (updated). Build: tactical-blueprint theme, campaign → match flow._

## Session

Played a full offline match in the browser (`pnpm dev`). No API keys, no network
calls. Drag-and-drop on chessground; refusal, override, quiet-quit, and desertion
panels appeared when psychology blocked or muted an order. Piece click focuses
the relationship inspector; last-move highlighting is on the board.

## Refusal: dramatic or annoying?

**Leaning dramatic**, with caveats.

- **Dramatic when:** the divergence panel shows depth-limited piece view vs
  commander implied value, and the authored line names the cause (`{san}`
  substitution). Override cost preview makes the tyrant path legible without
  hiding the price.
- **Annoying when:** refusal clusters early before the player has issued many
  orders — same root cause as harness calibration (heuristic eval, not yet
  engine depth views).

## M4 deliverable checklist

| Task | Status |
|------|--------|
| 4.1 chessground + intent pipeline | Done |
| 4.2 Trust aura, morale gauge, betrayal marker | Done |
| 4.3 Refusal / quiet-quit / desertion UX | Done (quiet-quit panel added) |
| 4.3b Override + divergence display | Done (depth-limited labels; engine eval deferred) |
| 4.4 Relationship inspector + board click-to-select | Done |
| 4.5 Authored dialogue ~200 lines | Done (`dialogueTree.ts`, role-expanded) |
| 4.6 tactical-blueprint theme | Done |

## UX observations

| Surface | Verdict |
|---|---|
| Override panel | Feels deliberate, not dismissible — good |
| Quiet-quit panel | Legible as muted compliance, not a bug |
| Desertion acknowledge step | Makes rout legible as it happens |
| Trust aura + morale tick | Readable on tactical-blueprint grid |
| Relationship inspector | Click piece on board to focus — good |
| Last-move highlight | Helps follow the tactical thread |

## Remaining follow-ups (post-M4)

1. Wire `EnginePort` per-piece views into the divergence display (ADR 0013) —
   requires async engine pool in the interactive match loop.
2. Reduce early refusal rate via harness calibration before widening playtests.

## Exit criteria

- [x] Full match playable end-to-end offline with zero API keys
- [x] Playtest note documenting whether refusal feels dramatic or annoying
