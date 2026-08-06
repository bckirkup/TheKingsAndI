# Milestone 4 — Vertical slice playtest note

_Date: 2026-08-06. Build: tactical-blueprint theme, seed 42._

## Session

Played a full offline match in the browser (`pnpm dev`). No API keys, no network
calls. Drag-and-drop on chessground; refusal and override panels appeared when
psychology blocked an order.

## Refusal: dramatic or annoying?

**Leaning dramatic**, with caveats.

- **Dramatic when:** the divergence panel shows the piece's view vs the leader
  implied value, and the authored line names the cause (`{san}` substitution).
  Override cost preview makes the tyrant path legible without hiding the price.
- **Annoying when:** refusal clusters early before the player has issued many
  orders — same root cause as harness calibration (heuristic eval, not yet
  engine depth views).

## UX observations

| Surface | Verdict |
|---|---|
| Override panel | Feels deliberate, not dismissible — good |
| Desertion acknowledge step | Makes rout legible as it happens |
| Trust aura + morale tick | Readable on tactical-blueprint grid |
| Relationship inspector | Useful for debugging; needs click-to-select next |

## Follow-ups

1. Wire `EnginePort` per-piece views into the divergence display (ADR 0013).
2. Click piece on board to focus relationship inspector.
3. Reduce early refusal rate via harness calibration before widening playtests.
