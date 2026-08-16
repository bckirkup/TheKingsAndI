# Does a piece's history change anything? Measured quality, and the bench that isn't there

Revision: `eb0168b` (merged `main`, D147 in tree with the hope weight at `0`).

This report answers one question asked at owner level — *is a really great and
loyal queen much better than a mediocre and somewhat abused one?* — and records
what was found underneath it while looking: the state that makes a piece
distinctive, the state that cannot change at all, and the fact that the shipped
application has no bench for a distinctive piece to sit on.

## Method

Everything except one piece is held fixed: same seed (`7`), same leader policy,
same opponent, same fake engine, same fifteen other pieces created by
`createStartingRoster`. Only the **queen's** carried state is varied across
three cells, three matches per cell:

| variant | `T_i` | `M_i` | `B_i` | dyadic affinity to every peer | credence |
|---|---|---|---|---|---|
| `baseline` | 20 | 70 | 0 | none | default |
| `great` | 95 | 100 | 0 | +80 | `τ_abil` 90, `τ_benev` 90 |
| `abused` | 1 | 10 | 90 | −80 | `τ_abil` 1, `τ_benev` 1 |

The probe is a diagnostic outside the repository build; `playHash` is a hash of
the whole move sequence plus each match's `determinismId`, so a changed hash
means the games genuinely diverged rather than differing only in bookkeeping.

## Result

```
tyrannical  baseline  refusals=126   queenRefusals=3   desertions=3   queen died 3/3   plies=600  meanWinScore=50.000
tyrannical  great     refusals=99    queenRefusals=6   desertions=0   queen lived 3/3  plies=327  meanWinScore=100.000
tyrannical  abused    refusals=51    queenRefusals=0   desertions=9   queen lived 3/3  plies=336  meanWinScore=100.000

random      baseline  refusals=1293  queenRefusals=15  desertions=12  queen died 3/3   plies=570  meanWinScore=0.000
random      great     refusals=1140  queenRefusals=12  desertions=15  queen died 3/3   plies=600  meanWinScore=50.000
random      abused    refusals=915   queenRefusals=6   desertions=18  queen died 3/3   plies=486  meanWinScore=0.000

supportive  baseline  refusals=165   queenRefusals=9   desertions=0   queen died 3/3   plies=600  meanWinScore=50.000
supportive  great     refusals=738   queenRefusals=0   desertions=3   queen died 3/3   plies=522  meanWinScore=100.000
```

The `supportive` `abused` cell did not finish inside the run's time budget and
is omitted rather than estimated; `supportive` is the most expensive style in
the harness. Every `playHash` differs, and the `plies` and `meanWinScore` columns move: one
piece's accumulated history already changes the whole match, not its margin.
Under `random` the abused queen walks off the board herself.

## Reading

**The abuse channel is real and monotone; the excellence channel is not.**
Mistreating one piece raises total desertion in both styles that produce any
(3 → 9 under `tyrannical`, 12 → 18 under `random`), because her negative
affinity and low morale reach her peers through the witness and rumor channels.
The `great` cell is a different story: it does not reliably improve anything, it
perturbs the trajectory. Under `tyrannical` it removes desertion entirely
(3 → 0); under `random` desertion rises slightly (12 → 15) and under
`supportive` peer refusals rise sharply while the queen's own refusals fall to
zero. Those are chaotic re-routings of a different game, not evidence of a
better queen.

**The structural reason is that ability cannot be earned.** `E_i` — the field
the specification calls *experience* (`docs/psychology_engine.md:17`) — is
assigned in exactly two places, both of them piece **creation**
(`src/orchestration/roster.ts:58-65`, `sim/roster.ts:74-78`). The only other
write anywhere in `src/` or `sim/` is the clamp inside `normalizePieceState`
(`src/psychology/reducers.ts:34`), which preserves the value it is given. No
event, reducer, fold or campaign path ever moves it. It is a constant of role: pawn 20, officer 55, King 80.
Traits are likewise frozen at creation, jittered ±0.1 from a single seeded unit
(`sim/roster.ts:29-41`). Ability is read to derive search depth
(`src/psychology/depth.ts:4`, `src/psychology/verdict.ts:84`) and to order
`strongest_available` fielding (`sim/pool.ts:250-254`), so a piece's *counsel
quality* and its *selection priority* are both fixed at birth by its role.

Every channel that does grow — `T_i`, `M_i`, `B_i`, `dyadicAffinity`,
`classPrestige`, `credence`, `rumor` — is a **compliance and resilience**
channel. Since a commanded move is always the move played (ADR 0008), a great
piece does not play better chess. She argues less, does not quit, and holds her
peers steady. That is a real difference, and it is not the difference the phrase
"a much better queen" implies.

## The bench does not exist where the player is

Three findings, all separate from the above and all load-bearing for any
promotion or roster design:

1. **The harness has a bench; the application does not.** `POOL_DEPTH_FACTOR: 2`
   (`sim/seasonConfig.ts`) gives each commander 31 members — 16 pawns, 4 each of
   knight, bishop and rook, 2 queens, 1 King — and `fieldPool`
   (`sim/pool.ts:335-372`) selects the lineup by one of three policies chosen by
   the leader's *style*, never by a player. In the shipped app,
   `bootstrapRoster` (`src/app/careerBootstrap.ts:29-50`) creates exactly the
   standard sixteen and `activeLineup`
   (`src/orchestration/rosterActions.ts:132-142`) fields whoever is `ACTIVE`, so
   benching or firing a piece means fielding fifteen with no replacement.
2. **"Free agents" are the player's own deserters.** `listFreeAgents`
   (`src/persistence/repository.ts:354-358`) returns pieces with status
   `DESERTED` from the same career database. There is no outside market and no
   right to decline; ADR 0026's community model is not wired.
3. **The fielded lineup is always exactly the standard army.** A lineup's IDs
   are installed onto `LivingBoard.standard()`
   (`src/orchestration/headlessMatch.ts:429-433`), so no lineup can ever contain
   two queens. Any "promotion earns a second queen" design is unavailable at the
   board level; promotion can only change *who holds the one queen's chair*.

Two further gaps in the campaign paths matter for persistent promotion:
`mergeCampaignRoster` (`sim/roster.ts:109-135`) re-derives `role` from the
standard board and does not carry `E_i`, so both `sim/campaign.ts` and
`sim/world.ts` would silently un-promote a promoted piece and reset any earned
ability. And `LivingBoard` already records the promotion faithfully
(`src/chess/board.ts:367-369`) while no orchestration path reads that field.

## What the player can know

Grounded inventory of the shipped surfaces, because a distinctive bench is only
worth having if the distinctions are legible:

- `RosterScreen` shows role, raw `T_i`, and status, plus a consequence preview
  for benching or firing (`src/app/RosterScreen.tsx:84`,
  `src/app/RosterScreen.tsx:94-95`); a recruitable free agent is shown as its
  role and trust alone (`src/app/RosterScreen.tsx:63`).
- `PieceOverlay` is gauge-shaped — trust-coloured aura, morale bar, a `!` above
  trauma ≥ 40 — but its `aria-label` and `title` attributes publish the exact
  integers (`src/ui/overlays/PieceOverlay.tsx:40-58`), which sits against
  ADR 0018's rule that the player never sees the arithmetic.
- Ability, traits, class prejudice, credence, remembered events and bonds are
  shown nowhere.
- **A piece's name is never rendered.** Names are generated and stored
  (`src/app/careerBootstrap.ts:10-27`, `src/app/careerBootstrap.ts:44-49`) and
  no screen displays one, so the persistent identity the design rests on is
  invisible in the interface.

## Consequences for calibration

`DESERTION_PROMOTION_HOPE_PERMILLE` stays at `0`. The D147 measurement showed
that even at the knob's maximum no pawn is retained, and the fix is not a larger
coefficient: what a pawn stands to gain by promoting is currently *nothing at
campaign scale*, so there is no defensible magnitude to pick until promotion has
consequences to be worth. See **D148**.

The related open question this report creates is **D149**: whether service can
move `E_i`. Without it, a bench cannot have a quality gradient, `strongest_
available` is a fixed role ordering rather than a judgement, and no piece can
ever become better than the day it was created.
