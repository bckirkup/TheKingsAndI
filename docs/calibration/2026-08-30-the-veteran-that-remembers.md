# The veteran that remembers — carrying `E_i` across the campaign boundary

**Date:** 2026-08-30
**Harness:** `pnpm sim --matches=20 --seed=7 --opponent=tyrannical --engine=fake`
**Conditions:** `--leader=tyrannical` and `--leader=supportive`, one campaign each
**Before:** `49704f2` (merge of #163). **After:** the `E_i` carry of #164.

## What was wrong

`mergeCampaignRoster` (`sim/roster.ts`) rebuilds the standard lineup every match
and copies the carried piece's psychology onto its seat — traits, `T_i`, `M_i`,
`B_i`, affinity, class prestige, engagement, credence, rumor, and role under
`PROMOTION_ROLE_PERSISTS_ACROSS_MATCHES` — and omitted `E_i`. So every survivor
was re-fielded at `startingAbilityForRole` (Pawn 20, officer 55, King 80), and
D149's earned ability — graded through the forced and heeded channels, audited as
`ABILITY_GRADE` — expired with the match that produced it. This was residue of the
PR #161 amnesia fix, not a decision: no register entry or ADR asks experience to
reset, and the season/pool path (which fields persistent `PieceState`s) never did.

Because `E_i` sets search depth (`D_i = max(1, floor(D_min + η_i·(E_i/100)·(D_max
− D_min)))`), the reset silently restored a roster's *competence* at every
boundary while leaving its trust, trauma, and grudges intact.

## What the fix changes: competence becomes a career-scale outcome

Per-match ability of the surviving roster (`meanAbility` / `abilityMax` from the
shard artifacts). The two arms move in opposite directions, and only after the fix:

| match | tyrannical mean (before → after) | tyrannical max | supportive mean (before → after) | supportive max |
|---|---|---|---|---|
| 1 | 47.2 → 47.2 | 73 → 73 | 54.0 → 54.0 | 80 → 80 |
| 5 | 79.0 → 54.0 | 79 → 54 | 47.5 → 48.5 | 80 → 82 |
| 10 | 59.7 → 46.8 | 82 → 60 | 41.4 → 45.8 | 81 → 85 |
| 15 | 61.7 → 36.0 | 79 → 36 | 41.9 → 91.0 | 81 → 91 |
| 20 | 40.2 → 40.8 | 80 → 64 | 44.5 → 48.4 | 80 → 92 |

The supportive arm's ceiling climbs monotonically — 80, 81, 82, 84, 85, 88, 91,
92 — and it is one identity: the King, who survives every match and keeps what he
earned. The tyrant's ceiling *falls* to 58–66 and his mean drops from the
mid-sixties to the mid-forties, because `ABIL_EARNED_CURVATURE` makes a loss
larger than a gain at mid-ability and there is no longer a boundary that restores
the textbook value. Before the fix both arms simply returned to role defaults,
so neither the veteran's compounding nor the churned roster's decay existed.

## What it does not change

| metric (20 matches, seed 7) | tyrannical before → after | supportive before → after |
|---|---|---|
| mean win score | 50.0 → 52.5 | 82.5 → 72.5 |
| mean plies | 107.8 → 108.2 | 91.3 → 97.2 |
| refusal rate | 0.135 → 0.142 | 0.066 → 0.063 |
| override rate | 0.444 → 0.440 | 0.000 → 0.000 |
| implicit (forced) overrides | 0 → 0 | 0 → 0 |
| desertions (total) | 41 → 46 | 0 → 1 |
| retirements / careers fielded | 16 / 32 → 19 / 34 | 12 / 28 → 14 / 29 |
| mean surviving roster | 3.60 → 3.35 | 8.40 → 7.60 |
| mean `τ_abil` end | 26.2 → 40.1 | 2.2 → 1.4 |
| mean `τ_benev` end | 24.7 → 23.1 | 95.1 → 95.5 |
| grace events | 0 → 0 (inert) | 0 → 0 (inert) |

**No outcome claim may be made from this pass.** Each cell is one campaign at one
seed; the supportive arm's 10-point win-score fall is two matches (15 and 18)
where the campaign reached the King alone, and the tyrant's 2.5-point rise is a
single match flipping. The honest reading is that carrying `E_i` moves the
*competence trajectory* — which is mechanism, visible per match — and that no
behavioural metric moved beyond seed noise at this sample size.

## Consequences for evidence already committed

`docs/calibration/2026-08-30-the-career-that-ends.md` and the D191 forced-move
measurement were taken on the amnesiac roster, where no piece kept experience
between matches. Their retirement, desertion, and win-score numbers are internally
consistent and remain the before/after record for retirement, but they may not be
quoted beside a run taken after this fix, and the `redeemer` collapse recorded
there is not a style finding: `redeemer` plays `pure_tactician` for nine matches
and switches to `supportive` at match 10 (`sim/leaders.ts`), so that campaign is a
plot rather than a style.

## Reproduction

```bash
pnpm sim --matches=20 --leader=tyrannical --opponent=tyrannical \
  --seed=7 --engine=fake --out=/tmp/tyrannical.csv
pnpm sim --matches=20 --leader=supportive --opponent=tyrannical \
  --seed=7 --engine=fake --out=/tmp/supportive.csv
```

Per-match `meanAbility`, `abilityMin`, `abilityMax`, `retirements`, and
`fieldedCareerIds` are in the `.csv.json` shard artifact, not in the CSV.
