# UI

Presentation components for the playable vertical slice (Milestone 4).

| Area | Role |
|---|---|
| `board/` | chessground wrapper and FEN/dest adapters |
| `overlays/` | Trust aura, morale gauge, betrayal marker |
| `panels/` | Verdict, override, divergence, relationship inspector |
| `theme/` | tactical-blueprint design tokens |

No game logic — state mutations live in `src/orchestration/`.
