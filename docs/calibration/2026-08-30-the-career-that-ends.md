# 2026-08-30 — The career that ends, and the bill that arrives late

**What this measures:** the campaign path with D186 retirement live and D187 grace
wired inert (`GRACE_RATE_PERMILLE=0`, `GRACE_RELIEF=0`), against the same campaign
on `main` where trauma ratcheted to the `clampTrauma` ceiling and no career ever
ended. Fake engine, seed 7, `--opponent=tyrannical`, one campaign of 40 matches
per condition (`--matches=40` with no `--campaign-length` is a single campaign, so
state carries across all 40 boundaries). Horizons are cumulative prefixes of the
same campaign, not separate runs.

**What it does not measure:** any grace magnitude. Grace consumes no PRNG draw at
its defaults, so every number below is retirement plus the PR #161 carry, and
D188's rate and relief remain unchosen.

## The horizon table (tyrannical, seed 7)

| | matches | win score | mean survivors | desertions | retirements | enemy retirements | distinct careers | careers per seat |
|---|---|---|---|---|---|---|---|---|
| before | 10 | 35.00 | 2.20 | 24 | 0 | 0 | 16 | 1.00 |
| after | 10 | 40.00 | 2.30 | 25 | 7 | 2 | 22 | 1.375 |
| before | 20 | 52.50 | 3.30 | 37 | 0 | 0 | 16 | 1.00 |
| after | 20 | 50.00 | 3.60 | 41 | 16 | 9 | 32 | 2.00 |
| before | 40 | 57.50 | 4.05 | 57 | 0 | 0 | 16 | 1.00 |
| after | 40 | 53.75 | 3.42 | 71 | 45 | 24 | 60 | 3.75 |

`before` cannot report retirements or careers-per-seat by construction: sixteen
seats, sixteen careers, forever, however wounded.

## What the numbers say

**Trauma now ends careers, and the rate accelerates.** 7 retirements by match 10,
16 by match 20, 45 by match 40 — 0.70, 0.80, then 1.13 per match. Nothing in the
mechanism accelerates; the roster does. Each fresh career starts clean and takes
its own five captures to reach the ceiling, so the retirements of a long campaign
are the *second* and third generations arriving at the same ceiling faster than
the first, because the seats that see the most action see it every generation.

**The permanent cost is in identity, not in outcome.** Win score barely moves
(57.50 → 53.75 at 40 matches, and *up* at 10), while careers per seat goes 1.00 →
3.75 and 45 careers end. This is exactly the shape the owner's ruling requires:
the tyrant keeps winning about as much as before while burning through 45 people
instead of wounding 16 indefinitely. The bill is legible in the roster ledger and
almost invisible in the scoreboard — which is the finding, not a defect.

**Both armies pay.** The enemy commander retires 24 careers over the same 40
matches (ADR 0025); retirement is not a player-side mechanic.

**Desertions rise rather than fall (57 → 71 at 40 matches).** Retirement removes
the most traumatized careers before they can desert, so the naive expectation was
fewer exits. Instead the replacements desert: a fresh career has no accumulated
attachment to the roster it joins, and a roster of strangers is the condition the
desertion model exits from. Retirement does not relieve the campaign; it changes
what the campaign loses.

## The kind condition, on the same horizons (redeemer, seed 7)

| | matches | win score | mean survivors | desertions | retirements | distinct careers | careers per seat |
|---|---|---|---|---|---|---|---|
| before | 10 | 35.00 | 1.80 | 60 | 0 | 16 | 1.00 |
| after | 10 | 25.00 | 1.60 | 47 | 6 | 22 | 1.375 |
| before | 20 | 35.00 | 1.75 | 195 | 0 | 16 | 1.00 |
| after | 20 | 17.50 | 1.45 | 161 | 10 | 25 | 1.562 |
| before | 40 | 40.00 | 1.90 | 459 | 0 | 16 | 1.00 |
| after | 40 | 30.00 | 1.73 | 415 | 11 | 27 | 1.688 |

The cruel style leads the kind one at **every** horizon (after: 40.00 vs 25.00 at
10, 50.00 vs 17.50 at 20, 53.75 vs 30.00 at 40) — so the D188 trajectory gate
cannot be evaluated on this evidence, because the kind condition is not merely
behind, it is collapsing, and it was collapsing before retirement existed (459
desertions at 40 matches on `main`).

**Retirement barely fires for the kind leader (11 careers over 40 matches, against
the tyrant's 45), because desertion out-races it.** Its pieces leave before trauma
can reach the ceiling: 415 exits against 71. Kindness therefore produces the *least*
permanent record of harm while suffering the most attrition, which is the opposite
of what the permanent-cost ledger is supposed to show.

## The mechanism, and why it is not grace's fault (D191 raised)

Per-match means over the 40-match campaigns tell a consistent story:

| | refusal rate | overrides | **implicit** overrides | benev loss (target) | benev loss (witness) | cascade length | desertions from winning positions |
|---|---|---|---|---|---|---|---|
| redeemer | 0.77 | 41.9 | **33.6** | 644 | 639 | 2.60 | 5.92 |
| tyrannical | 0.14 | 51.5 | **0.05** | 297 | 529 | 1.32 | 0.40 |

An implicit override is not a leadership act. It is the ADR 0014 fallback in
`headlessMatch.ts` — when *every* candidate move has been refused, the harness
forces the first refused move so no position is unplayable — and it is priced
identically to an override the commander chose. The redeemer's roster refuses 77%
of plies, so the unanimous-refusal state arrives on roughly a quarter of its plies,
and **80% of its overrides are forced ones** (33.6 of 41.9) against the tyrant's
0.1%.

Each of those forced moves then costs a kind roster *more* than the same act costs
a cruel one — 644 versus 297 in target benevolence — which is the grid-sweep
finding from `2026-08-29-the-response-surface-under-the-curdle.md` (regard enlarges
the fall rather than cushioning it) arriving at campaign scale. Longer cascades
(2.60 versus 1.32) and 5.92 desertions per match from *winning* positions follow.

So the causal chain is: kindness raises refusal → refusal exhausts the candidate
list → the harness forces a move → the forced move is billed as insistence → a
kind roster pays double for it → cascade. **D191** is raised on the pricing step:
whether a forced move, taken because the room refused unanimously and the game had
to continue, may cost what a chosen override costs. This is upstream of D188; no
grace magnitude can be chosen while the kind condition is dominated by a fallback
path rather than by conduct.

## What this does not settle (D188)

The gate itself is still un-evaluated. What is established is the instrument —
retirements, careers per seat, and distinct careers are measurable per horizon, and
win score is nearly insensitive to them over 40 matches, so the gate must read the
permanent quantities — plus the reason the kind arm cannot yet be compared.
