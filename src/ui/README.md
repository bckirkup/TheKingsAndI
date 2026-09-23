# UI

Presentation components for the playable vertical slice (Milestone 4).

| Area | Role |
|---|---|
| `board/` | chessground wrapper and FEN/dest adapters |
| `overlays/` | Trust aura (shape + hue), morale gauge, betrayal marker, inspect hit-target |
| `panels/` | Verdict, override, divergence, relationship inspector |
| `theme/` | Pack `themeTokens` (`tactical-blueprint`; military JSON under `public/assets/packs/`) |

No game logic — state mutations live in `src/orchestration/`.
Overlays stay `pointer-events: none` except `.piece-overlay__inspect` so chessground
drag-to-move is not blocked (S1 board hit-testing).
