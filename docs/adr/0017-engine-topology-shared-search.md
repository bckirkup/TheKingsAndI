# ADR 0017 — Engine topology: shared search, private scoring

- **Status:** proposed (2026-07-26); resolves **D9**
- **Depends on:** ADR 0013 (own view), ADR 0016 (belief channels)

## Context
D9 has been the last blocking technical unknown. The pressure on it kept rising:
D5 (symmetric psychology) doubles the budget, ADR 0013 means *every* piece needs
a view rather than the few being consulted, and ADR 0016 now gives each piece a
distinct evaluation profile and attention pattern. Worker-per-piece is 16 WASM
instances per side and is unusable on anything but a desktop.

## Decision
One pooled engine. **Search is shared; scoring is private.**

```
shared   one search from the pool over the current position → leaf set
private  for piece i: re-score those leaves under i's own weights,
         truncate to D_i, extend only i's attention lines
cache    keyed (position, D_i, evalProfile_i)
```

Rationale: search is what costs, scoring is nearly free, and ADR 0016's
attention is a *depth allocation over the same tree* rather than a different
tree — so pieces that end up in total disagreement still share most of the work.

## Consequences
- Sixteen genuinely different minds for roughly one engine's work per side.
- Fixed depth only (`go depth N`, D10); the shared tree must not depend on wall
  clock, or every golden test dies.
- The cache key must include `evalProfile_i`, not just `D_i` — two pieces at the
  same depth with different egocentric weights are not interchangeable, and this
  is the most likely source of a silent determinism bug.
- The true `D_max` score exists in this layer and must not cross into
  `psychology/` (ADR 0013); the pool's public surface is *"what does piece i
  believe"*, with the true evaluation exposed on a separate audit-only path.
- **Resolved by ADR 0019:** attention **prunes** the lines a piece does not
  appear in. Cheapest option and the dramatic one — refusals of winning moves
  become common, which is either the best feature in the game or its worst bug
  report; testimony (ADR 0018) is the mitigation.
