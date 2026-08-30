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

## What this does not settle (D188)

The trajectory gate needs a *kind* condition measured on the same horizons before
any grace magnitude can be chosen, and it needs the comparison at a longer horizon
than 40 to see whether a cruel style's advantage widens. What is established here
is the instrument: retirements, careers per seat, and distinct careers are now
measurable per horizon, and win score is already known to be nearly insensitive to
them over 40 matches — so the gate will have to read the permanent quantities,
because the outcome column will not show it.
