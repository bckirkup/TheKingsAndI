---
name: browser-e2e-testing
description: Drive The Kings and I through a full match in a real browser — fresh career bootstrap, ordering moves on the chessground board, forcing refusals, reaching a terminal state, and rendering the match audit. Use when verifying any user-facing UI change end to end instead of only running vitest.
---

# Browser end-to-end testing (The Kings and I)

## Bring the app up

```bash
pnpm install
pnpm dev            # Vite on http://localhost:5173 (localhost only —
                    # 127.0.0.1:5173 is refused unless you pass --host)
```

## Reset to a fresh career

Career state lives in an IndexedDB database named `living-chess`. To force a
fresh 31-member bootstrap (seed 42, names Aethelgard…Petra; 1 King, 2 Queens,
4 Rooks, 4 Bishops, 4 Knights, 16 Pawns — 16 of them are fielded on the board),
run this in the browser console and reload — `await` at top level fails over
CDP, so use a promise chain:

```js
indexedDB.databases().then(dbs => {
  dbs.forEach(d => indexedDB.deleteDatabase(d.name));
  console.log('deleted ' + dbs.map(d => d.name).join(','));
});
```

## Screen path

Campaign hub → "Begin first match" → Roster screen (click a row to see its
service record + bench/fire consequence preview) → "Confirm lineup (31 active)"
→ Match screen → terminal state → "Fast-forward to end" (succession) → Match
audit → "Continue" → Campaign hub.

## Ordering a move on the board

Chessground needs a real press-move-release: `mouse_move` to the origin square,
`left_mouse_down` (no coordinate argument — it is rejected), several
intermediate `mouse_move` steps, then `left_mouse_up` on the destination.
After `left_mouse_down`, take a screenshot: chessground draws green dots on the
legal destinations, which is the reliable way to calibrate square centres
(rank/file centres are easy to get off by one square). Read
`document.querySelector('cg-board').getBoundingClientRect()` and scale it by
1024/1600 to convert board geometry into computer-tool coordinates rather than
eyeballing the squares.

Known blocker (present at least through the promotion-truth slice): the piece
overlays in `src/app/tacticalBlueprint.css`
(`.board-stack__overlays .piece-overlay { pointer-events: auto }`) cover the
full square, so `document.elementFromPoint` returns `.piece-overlay` and
chessground never sees the pointerdown — the drag silently does nothing and the
ply counter does not advance. If this reproduces, confirm it first (it is a real
user-facing bug worth reporting), then edit that rule to `pointer-events: none`
for the duration of the test (Vite HMR applies it instantly), label all later
evidence as taken with the workaround, and revert the file before finishing.

## Reaching a terminal state quickly

Dismissal fires when mean roster trust ≤ `DISMISSAL_MEAN_TRUST` (-25). Each
forced override costs -35 trust to the piece and -8 to every witness, so roughly
6 overrides ends the match. Order obviously bad moves (queen sorties such as
Qh5/Qxh7, `Bc4`/`Bxf7`, king walks) — they get refused, then scroll the right
aside panel down and click "Force <san>". Terminal banner reads
"Dismissed — the King commands the remainder"; the succession panel then offers
"Step King's move" / "Fast-forward to end".

## ADR 0018 (no arithmetic shown to the player)

Board overlays are clean: `aria-label="<Name>, <Role>, <band> trust, <band>
morale"` and `title="Morale is strong"`. The surfaces that still print raw
numbers are the refusal dialog (`src/ui/panels/VerdictPanels.tsx` — piece view /
commander implied / faith gap / perceived value / refusal threshold, plus
"Trust to piece: -35" and "Witness trust: -8 each") and the "Quiet compliance"
panel ("Trust is -4"). Check these explicitly when auditing qualitative-label
work.

## Devin Secrets Needed

None — the app is fully local and offline (no runtime LLM, no API key).
