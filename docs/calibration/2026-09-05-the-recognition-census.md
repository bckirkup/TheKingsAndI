# The Recognition Census — Pricing the Uncarried Emotions, Phase A

Date: 2026-09-05 (UTC). Status: measurement evidence for the ADR 0078
recognition-threshold rulings (D209 spite, D213 guilt, D214 envy, D215 pride,
D216 panic, D217 relief/awe/loneliness). Nothing in this document changes a
default; the harness that produced it (`pnpm sim:census`) ships beside it.

## Question

Every ADR 0078 emotion is wired as a recognition (a terminal/debrief naming) at
a zero default, so none of them names anyone. Before any *carrier* is priced
(Phase B) the recognitions need thresholds: at what value does each naming
become rare-but-present, does it point the way the ADR intends across leader
styles, and which of the zeros are structural — a mechanism that cannot fire
under the seminar as configured — rather than thresholds set too tight?

## Method

- Harness: `sim/emotionCensus.ts` — one fake-engine seminar per run, then the
  recorded weeks are re-folded post hoc across a threshold grid for every
  pure recognition fold (envy, pride, awe, loneliness, spite, guilt cascade).
  The match-time recognitions (panic, relief, survivor guilt) are set by flag
  and read as recorded, so they get one grid point per run.
- Seminar: 8 weeks × 4 matches per commander, 6 commanders per side over the
  catalogue `servant, supportive, tyrannical, volatile, random, steady`
  (12 commanders, 64 commander-matches per style per seed, 384 records per
  style per seed), default `SEMINAR_CONFIG` otherwise (draft after cycle
  one, captivity hold off), fake engine.
- Runs (this box, 2 vCPU, ~5 h wall each, two at a time):

  | run | seed | `PANIC_ROSTER_FLOOR` | `RELIEF_CAPTURE_RISK_PERMILLE` | `GUILT_PEER_SAFETY_FLOOR` |
  |---|---|---|---|---|
  | A | 41 | 2 | 250 | 0.05 |
  | B | 41 | 4 | 500 | 0.05 |
  | C | 41 | 6 | 750 | 0.1 |
  | D | 42 | 4 | 500 | 0.05 |

- Play identity: A, B and C share `playDigest`
  `404f94f4…7ab0be` (standings + Judgement Seat), so the match-time
  recognition knobs are proven inert on play; only the event stream differs.
- Commit: `b453d287b5a943bece887af31f0bb2a95a48b9d9` (this branch).
  Raw outputs (`~/census/s41-{A,B,C}.json`, `s42-B.json`, `summary.txt`) are
  retained outside the repository.

Notation below is `named / commander-matches with a naming (of 64) / distinct
pieces`, per style, seed 41 unless stated.

## Findings

### Structural zeros — cannot be priced on this harness

| knob | evidence | why |
|---|---|---|
| `AWE_NOMINATION_FLOOR` (D217) | 0 `HEROISM_NOMINATION` events in 4,608 records, both seeds | Heroism needs the engine audit to show a decisive true gain the piece privately disagreed with; the fake engine never produces one. Awe is priceable only on a Lozza run. |
| `ENVY_PRICE_GAP_FLOOR` (D214) | 29 settlements per seminar, all in cycle 2; 7 (5) same-role groups with ≥2 lots, 0 (1) with a positive spread; max spread 5 | Fresh lots of one role clear at the same price; the only spread seen was 5 among five pawns (seed 42), naming one piece at floor 1. Envy needs a market with service-differentiated prices — more draft cycles or captivity ransoms — before a floor means anything. |
| gratitude (D210) | 0 debts | Captivity hold is off in `SEMINAR_CONFIG`, so no ransom is ever paid. |
| `SPITE_COMMANDER_COST_FLOOR` / `SPITE_DESERTION_PIVOTALITY_FLOOR` (D209) | 0 at cost floors 1–5 pawns and pivotality 0.1–0.75 | Unjustified refusals number 21k–63k per style but only 0–16 carry `perceivedValue ≥ 1` pawn, and desertion pivotality peaks at 0.3–0.5; the grievance ground (an unvindicated override of *that* piece earlier in the match, ~100–240 per style) rarely coincides with a costly act. The next grid must be fractional (cost 0.1–0.5 pawn) and should count grievance-carrying pieces separately. |
| `GUILT_CASCADE_WINDOW_PLIES` (D213) | identical at 2/4/8, both seeds | No deserter was followed within any window — every guilt naming is *survivor* guilt from the safety-floor annotation. The cascade term has nothing to price yet. |

### Priceable recognitions

**Pride — `PRIDE_NAMING_FLOOR_PERMILLE` (D215).** Floors 1 and 100 name the
same pieces (servant 8/2/8, tyrannical 3/2/3, volatile 3/2/3, supportive
1/1/1, steady 1/1/1, random 0; seed 42: 4/4/3/1/2/0), 250 keeps 4–5 of them,
500 keeps one. The knee is between 100 and 250. Only 29 pricing events exist
per seminar (one draft cycle, no ransoms), so
`PRIDE_EXPECTATION_EMA_PERMILLE` is unobservable here — 250 and 500 give
identical tables — and its value is a nominal choice until pricing is
repeated.

**Loneliness — `LONELINESS_AFFINITY_THRESHOLD` (D217).** 25 and 50 are nearly
the same reading (volatile 357/7/67, random 184–197/7/73, steady 122–136/5,
servant 123–129/7–8, supportive 24/7/19, tyrannical 0; seed 42 has
tyrannical 178/3/37 and volatile 48/1/15), and 75 collapses to the two kind
styles only (supportive 51–127, servant 32–41, rest 0). The reading is
common — 2–5 pieces per match in most rooms — because the seminar loses
~7,000 pieces to capture per style per seed; it is a naming of who was left
without a bond, not a rare event. 50 is also the grief affinity threshold
(`GRIEF_AFFINITY_THRESHOLD`), so one notion of "bond" would serve both.

**Panic — `PANIC_ROSTER_FLOOR` at `PANIC_CAPTURE_RISK_PERMILLE = 750` (D216).**
Floor 2 saturates (every week names; supportive 354 onsets, 5.5 per match).
Floor 4 is rare-but-present (servant 7/5, supportive 6/4, tyrannical 1/1,
volatile 2/1, random 2/2, steady 2/2; seed 42: 7/4, 4/2, 0, 1/1, 7/3, 1/1).
Floor 6 is nearly silent (servant 3/3, supportive 1/1, rest 0). Note the
direction: kind rooms panic *more* here, because panic counts dreading pieces
on the board and cruel rooms have emptied theirs — the recognition reads the
crowd that is still present, which is what the ADR describes, but it is not a
cruelty signal.

**Relief — `RELIEF_CAPTURE_RISK_PERMILLE` (D217).** 250: supportive 466/16/137,
servant 172/16/85, random 164/13/95, volatile 136/10/87, steady 118/10/81,
tyrannical 30/9/27. 500 and 750 are *identical* (supportive 345/15/123 …
tyrannical 17/8/16), so the static-exchange risk takes few values between 500
and 1000 and any threshold in that band is the same knob. Relief is common by
nature (it names every piece whose danger passed) and points at the kind
rooms, where pieces live to be relieved.

**Survivor guilt — `GUILT_PEER_SAFETY_FLOOR` (D213).** At 0.05 (a 5-point
capture-probability spend on a peer): supportive 84/59/61, servant 4/4/4,
steady 3/3/3, random 1/1/1, tyrannical 0, volatile 0; 0.1 gives supportive
80/57/57 — again quantised. Seed 42 repeats the shape (supportive 82/63/59,
servant 9/8/8). The supportive room is the only one where compliant moves
routinely spend a peer's safety, which is the ADR's intended reading (guilt
belongs to the piece that *obeyed*).

## Proposed rulings (for the owner)

Recognition defaults change the debrief payload and nothing else; each still
owes the payload goldens a refresh and no exploit-tier rerun.

| knob | proposed | basis |
|---|---|---|
| `PRIDE_NAMING_FLOOR_PERMILLE` | 100 | knee at 100–250; names ~1–8 pieces per 64 matches |
| `PRIDE_EXPECTATION_EMA_PERMILLE` | 250 (nominal) | unobservable at one pricing event per piece |
| `LONELINESS_AFFINITY_THRESHOLD` | 50 | 25 ≡ 50; 75 collapses; matches the grief bond |
| `PANIC_ROSTER_FLOOR` | 4 | 2 saturates, 6 is silent |
| `RELIEF_CAPTURE_RISK_PERMILLE` | 500 | 500 ≡ 750; 250 admits low-risk "relief" |
| `GUILT_PEER_SAFETY_FLOOR` | 0.05 | 0.05 ≡ 0.1; supportive-only reading as intended |
| `GUILT_CASCADE_WINDOW_PLIES` | stay 0 | nothing to price — no followed desertions observed |
| `SPITE_*`, `ENVY_PRICE_GAP_FLOOR`, `AWE_NOMINATION_FLOOR`, gratitude | stay 0 | structural zeros; re-census with a fractional spite grid, a ransom/multi-cycle draft market, and a Lozza run for awe |

## Caveats

- Fake engine, two seeds, one seminar shape: this is relative evidence for
  the *shape* of each reading, not absolute rates.
- `matchesWithNaming` is keyed per (commander, week) for the folds that carry
  no match index (loneliness, relief, awe, pride, envy), so its ceiling there
  is 16, not 64.
- The seminar draft market is thin by construction (one cycle, fresh lots);
  the envy and pride readings will change if the market does.
