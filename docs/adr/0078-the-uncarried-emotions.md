# ADR 0078 — The uncarried emotions: a location survey

- **Status:** survey accepted (owner request, 2026-09-04: "Please survey the
  world for emotions we haven't figured in. … Locate them all."); **D208,
  D209, D211, D212, D213, and D214 are wired inert, D210 is partly wired for
  recognition, D215 is partly wired for price appraisal, D216 is partly wired
  for recognition, and D217 is partly wired for recognition** — no opened
  carrier is priced or play-enabled by default; recognition defaults are ruled
  below
- **Opens:** **D210** (gratitude)
- **Refines:** ADR 0073 (hope and courage set the house pattern: computed
  always, exposed nowhere in play, named once at the closing debrief), ADR
  0071 (captivity and the ransom — the freshest seams below), ADR 0065 (the
  confidence and the culture — the reception side of envy), ADR 0070 (graded
  witness loss — the machinery shame reuses), ADR 0072 (grace: unearned,
  unpurchasable — the constraint any relief-like lift inherits)
- **Adjacent:** D198 (destroying a hope object), D182 (self-appraisal against
  role expectation), D190 (the boundary has no event stream)

## Rulings 2026-09-05

The recognition census now in main at
`docs/calibration/2026-09-05-the-recognition-census.md` (PR #207) sets the
following terminal/debrief defaults without enabling any live carrier:

- `PRIDE_NAMING_FLOOR_PERMILLE = 100`: the naming knee is between 100 and
  250‰.
- `PRIDE_EXPECTATION_EMA_PERMILLE = 250`: the EMA is nominal because it was
  unobservable at one pricing event per piece.
- `LONELINESS_AFFINITY_THRESHOLD = 50`: 25 and 50 are equivalent, 75
  collapses the reading, and 50 matches the grief bond threshold.
- `PANIC_ROSTER_FLOOR = 4`: floor 2 saturates while floor 6 is nearly silent.
- `RELIEF_CAPTURE_RISK_PERMILLE = 500`: 500 and 750 produce identical
  readings, while 250 admits low-risk relief.
- `GUILT_PEER_SAFETY_FLOOR = 0.05`: 0.05 and 0.1 are quantised alike and
  retain the supportive-only reading.

The structural zeros remain zero: `GUILT_CASCADE_WINDOW_PLIES`, both spite
floors, `ENVY_PRICE_GAP_FLOOR`, `AWE_NOMINATION_FLOOR`, and gratitude remain
unpriced until their required market, audit, ransom, or cascade evidence
exists.

## Context

The model carries more feeling than its vocabulary admits. Before asking what
is missing, the register should say plainly what is already present under
other names, because several "missing" emotions turn out to be present but
unnamed, and several others have their seams already built and waiting.

**Already carried.** Trust and betrayal (credence plus rupture debt, ADR
0064); hope as a named forecast — object, prospect, credence — with promotion
and the exchange both wired to the debrief (ADR 0053, 0071, 0073); courage as
the overcome margin, asked-risk-relative (D199); fear as appraisal
(`P_captured`, discounted by `w_courage`); despair and resignation
(quiet-quitting at reduced depth); class contempt (the prestige matrix, per
piece, not per roster); protective love and open schadenfreude (dyadic
affinity signs the peer-safety term of utility — endangering a despised peer
*pleases*); glory-seeking (`gloryWeight`); loyalty (`lambdaLoyalty`);
vindication (the audit channel of ability credence); the sting of being
passed over (the obsolescence streak); longing for home (the exchange hope).

**The pattern every entry below follows** is ADR 0073's: an emotion is not a
mood scalar. It is a *located* state — an object, a trigger the log already
witnesses or must begin to witness, a carrier field with a documented default
of zero or a pure fold requiring no state at all, a decay rule, and one
naming surface: the closing debrief. Nothing here surfaces during play, joins
`LeaderObservation`, or moves the Leadership Index without its own priced
ruling. Every knob opened here ships inert.

## The survey

### D208 — Bitterness (wired inert, 2026-09-05 addendum)

**What it is.** Grievance that has curdled into a standing stance: not low
benevolence credence — which good conduct can rebuild — but a *discount on
repair itself*. The bitter piece receives care at a fraction of its face
value.

**Location.** A per-piece `bitternessPermille` carrier (default absent, inert),
written once when rupture debt crosses a threshold while `tauBenev` sits at
the floor, and thereafter multiplying every inbound `REPAIR`/`REGARD` gain
and the morning lift's reach for that piece. The captivity decay ("you did
not come for me", ADR 0071) is the natural second trigger. Never surfaced;
the debrief names it: *she stopped believing apologies in week three*.

**Wired addendum (2026-09-05).** The optional `PieceState.bitternessPermille`
carrier is clamped to `0..1000` and absent by default. An unvindicated
rupture-floor charge forms one `rupture_floor` trigger when the post-charge
rupture debt reaches the configured permille threshold and benevolence is at
zero; each week of actual positive captive benevolence decay forms one
`not_ransomed` trigger. Each trigger adds the shared inert-by-default
`BITTERNESS_PER_TRIGGER_PERMILLE`. Repair and regard gains, plus the D207
per-piece trust rise, have separate inert integer discounts; match-boundary
decay is also inert by default. Nonzero formation is named only in terminal
campaign and seminar folds as `BITTERNESS_FORMED`; no live observation,
policy, register, standings, commendation, or Leadership Index surface reads
it, and no PRNG draw is consumed.

Thresholds and magnitudes remain open for measurement before any ruling.
Whether a voided gratitude debt converts to bitterness remains open, and
pricing remains open.

**Measured (2026-09-05, Phase B,
`docs/calibration/2026-09-05-the-carriers-and-the-floor.md`).** The
`rupture_floor` trigger is a **structural zero** on the campaign harness:
it requires `tauBenev <= 0`, but ADR 0066's proportional cliff
(`trunc(tauBenev / 4)` per override) stalls benevolence at 3 after eleven
overrides with 47 rupture debt, below the 50 floor, and the D175 ruling
accepts that truncation. Neglect erosion reaches 0 only on heeded refusals
(a kind-room event) and `not_ransomed` needs a ransom the census never saw.
No knob on the trigger can make it fire. A trigger ruling is owed before
any magnitude sweep: debt-only (drop the benevolence clause, threshold
≤ 470‰ or ceiling read as the seeded benevolence), a derived benevolence
floor in place of `<= 0`, or rounding the cliff up (reopens D175 and every
cruel-room number). All `BITTERNESS_*` defaults stay 0.

### D209 — Spite (wired inert, 2026-09-05 addendum)

**What it is.** Courage's dark mirror: a grievance-driven refusal or desertion
whose commander cost is visible in the existing audit stream.

**Location.** No new state or event fields. `foldSpite` is a match-local,
recognition-only classifier over existing events. An unvindicated override
grounds grievance until a later repair; bitterness grounds it permanently for
the match. An unjustified refusal above `SPITE_COMMANDER_COST_FLOOR` names
the perceived commander cost, while a desertion above
`SPITE_DESERTION_PIVOTALITY_FLOOR` names pivotality as its cost. Override
grievance wins when both grounds are present. Both floors are zero sentinels,
so the fold is inert by default and terminal blocks remain omitted.

**Open in D209:** threshold magnitudes and the motivation question. A MOVE
shape and cross-match grievance carry remain open; v1 does not change play or
carry grievance between match logs.

### D210 — Gratitude (partly wired: recognition) — *the freshest seam*

**What it is.** A debt-object, structurally hope's sibling: object (what was
done), magnitude (what it cost the doer), holder (who is owed). REGARD and
REPAIR move trust, but nothing in the model *owes*.

**Location.** The ransom just built the canonical trigger: **"he paid for
me"** creates a gratitude object held by the returned captive toward the
commander whose purse paid (payer `commander` or `split`, pro rata); the
self-sprung piece's *"I owe him nothing"* is its explicit negation, already
distinguished in the exchange-hope fold. Second trigger, already witnessed:
a costly signal that saves a specific piece (`king_endangerment`,
`removedThreatToPeer`). Carrier: a per-piece list of gratitude objects with
magnitude = what the payer actually spent; discharge: the debt is *spent*
when the piece obeys against its own utility for that commander (folding
into the courage/asked arithmetic as a credit), and *voids* on the next
betrayal-class event. Debrief names debts honored, debts voided, and the
self-sprung who owed nothing.

**Open in D210:** whether gratitude discounts the refusal threshold (play
change) or is recognition-only in v1; the exchange rate between purse gold
and obedience margin; whether a voided debt converts to bitterness (D208).

#### D210 addendum — recognition without price (2026-09-04)

The owner rules **v1 recognition-only**. The ransom is the only active
formation trigger: a commander-paid or split ransom records “he paid for me”
with magnitude equal to the commander’s actual share. Costly-signal
recognition remains open pending its pricing ruling and is not inferred from
other events.

At semester close, the terminal gratitude fold names the first subsequent
courage act by the ransomed piece as **honored**, provided the act is a
positive-margin MOVE after the ransom week's first-match boundary. An
unvindicated OVERRIDE before that act **voids** the debt; otherwise the debt
is **owed** at close. Each debt has at most one honor, and an earlier void
wins over a later courage act. This is naming-only: gratitude adds no live
state, refusal-threshold credit, play change, Leadership Index term, or
pricing.

The self-sprung “I owe him nothing” negation remains named by the exchange-hope
fold (ADR 0073/ADR 0071); gratitude does not duplicate that incident. The
refusal-threshold credit, the exchange rate between purse gold and obedience
margin, costly-signal recognition, and any bitterness conversion remain open.

The vocabulary is deliberate: the captive is the captor's **fengr**, the draft
lot is a **hlutr**, and **wælreaf** names the rejected alternative of stripping
spoils from the fallen. Weregild was considered and rejected by the owner:
ransom prices a return, not a life.

### D211 — Grief (open)

**What it is.** Mourning the lost, as distinct from anger at the leader. The
witness curdle (ADR 0066/0070) charges the *commander* when a peer is
wronged; nothing mourns the peer. A beloved's capture and a stranger's cost
the same feeling today.

**Location.** Trigger: capture, desertion, or career-end of a peer whose
dyadic affinity to the mourner exceeds a threshold. Carrier: per-piece
`griefLoad` (default-inert), raised in proportion to the lost affinity,
suppressing `engagementFactor` (the piece plays shallower — grief reads as
distraction, not disloyalty) and decaying slowly per match — the one
permitted decay, because mourning ending is not drift toward baseline but
the mechanism of mourning (ADR 0007 note required). Captivity refines it:
a held fengr is mourned at half weight — lost, but not gone — and the
ransom return lifts that grief, which is the roster-side half of the
exchange hope.

**Measured (2026-09-05, Phase B,
`docs/calibration/2026-09-05-the-carriers-and-the-floor.md`).** Grief
fires where bonds exist and nowhere else: ≈18 mournings per supportive
match, 1.2 steady, 0.2 tyrannical (the cruel room has no affinity ≥ 50, the
Phase A loneliness finding). With the depth suppression live the carrier is
a tax only the kind room can pay — pooled ≤ 0.7 LI and ≤ 1.75 win at
loads 250–500‰, with single paired campaigns falling 6 LI / 17.5 win — and
nothing else follows (no exit, no quiet quit): the wrong sign for the D188
trajectory gate. Load and decay behave as designed (decay 0 saturates toward
1000‰, 250 holds ≈500‰ at load 250, 500 holds ≈270‰). Proposed and
awaiting the owner's ruling: `GRIEF_LOAD_PER_LOSS_PERMILLE = 100`,
`GRIEF_DECAY_PERMILLE_PER_MATCH = 250` as recognition-grade defaults with
`GRIEF_ENGAGEMENT_SUPPRESSION_PERMILLE` a **ruled zero** until grief has a
consumer that is not a chess penalty or the cruel room a bond source.

**Open in D211:** the affinity threshold, the load and decay magnitudes, the
engagement suppression curve, and whether grief transfers on generation
(D189 says careers have no memory of predecessors — grief should die with
the mourner, but the seat's replacement arriving into a grieving room is a
scene the narration layer will want).

### D212 — Shame (wired inert, 2026-09-04)

**What it is.** Humiliation is trust loss *scaled by who watched*. Today an
override before twelve witnesses charges the twelve (ADR 0070) and the
overridden piece the same as if it had been private.

**Location.** No new machinery: ADR 0070 already enumerates the witnesses and
their regard for the overridden piece. Shame is a multiplier on the
overridden piece's own losses — its trust and benevolence deltas scale with
the number and standing of witnesses (a public overriding of a Queen before
the pawns she despises is the maximal case). The private confidence channel
(ADR 0065, unwired) is its complement: correction *in private* is the shame
that never happens, which finally gives that channel its kept-confidence
value. Debrief names the public humiliations.

**Addendum (2026-09-04).** D212 is wired inert. An unvindicated override
reuses ADR 0070's witness enumeration and standing values; shame is
`min(cap, witnesses × perWitness + trunc(sumStanding × standing / 1000))`,
and scales only the overridden piece's own trust and benevolence losses by
`trunc(drop × (1000 + shame) / 1000)`. Private correction has no witnesses
and therefore no shame. Positive exposures are terminal-only
`SHAME_EXPOSURE` names in campaign and seminar debriefs; witness charges,
broadcasts, and existing `PSYCH_DELTA` events are unchanged. The v1 curve is
linear-with-cap, with magnitudes awaiting a measurement sweep. Whether
`leaderAppraisal` or bitterness interactions should respond remains open.

**Measured (2026-09-05, Phase B,
`docs/calibration/2026-09-05-the-carriers-and-the-floor.md`).** Shame fires
≈0.8 times per tyrannical match and ≈1.1 per steady, never in the
supportive room (byte-identical to control at 25/50/100‰ per witness). Its
price at the Judgement Seat is ≈0.8–1.3 points of `trust_final` at
50–100‰, monotone and correctly signed but under the play-divergence noise,
because the overridden piece's trust and benevolence are already floored by
mid-campaign at this opponent. Proposed and awaiting the owner's ruling:
`SHAME_PER_WITNESS_PERMILLE = 50` as a recognition-grade default;
`SHAME_STANDING_PERMILLE` stays 0 unswept; the D212 magnitude proper waits
on an unsaturated trust term.

### D213 — Guilt (wired inert, 2026-09-05 addendum)

**What it is.** The survivor's and the deserter's burden. A piece whose
escape a peer's capture bought, or a deserter whose remaining squad then
collapsed, carries nothing today.

**Location.** Derivable from the log — no new live state. A terminal
`foldGuilt` reads the desertion cascade and a floor-gated optional `MOVE`
annotation. The annotation is produced from `CandidateMoveEvaluation`'s
`peerSafetyDeltas`; capture events themselves do not carry those deltas.
Guilt recognizes only direct links in v1: a first deserter with cascade
followers inside `GUILT_CASCADE_WINDOW_PLIES`, or a surviving mover whose
floor-qualified peer-safety spend is followed by that peer's capture inside
`GUILT_CAPTURE_WINDOW_PLIES`. Both shapes are named only in terminal
campaign/seminar debriefs and remain unpriced.

#### D213 addendum (2026-09-05)

D213 is recognition-only. `GUILT_CASCADE_WINDOW_PLIES` remains zero while
`GUILT_PEER_SAFETY_FLOOR` defaults to `0.05`; the capture window defaults to
two plies and is consulted only when its floor is enabled. The deserter
incident names the first departure and its cascade follower count. The
survivor incident names the mover, peer, positive safety spent, and capture
ply. Fielding filters actors as in the other terminal folds. The MOVE
annotation is enabled at the ruled floor; recognition changes the terminal
record/debrief only, with no live state, observation, policy, standing,
register, commendation, Leadership Index, or PRNG draw involved. A deserter
still receives a terminal name when the cascade window is later enabled,
following the exit precedent in ADR 0071.

The direct-link ruling intentionally does not attribute guilt through longer
cascades. Whether guilt ever becomes a live carrier and pricing remain open.

### D214 — Envy (wired inert, 2026-09-05 addendum)

**What it is.** Wanting the portion another received. The draft just created
its concrete object: clearing prices are now piece-held cash (D183), so a
piece paid less than a same-role peer has an exact, denominated grievance.

**Location.** Trigger: draft settlement where a same-role, same-side peer
cleared higher; the favour-reception side already exists in ADR 0065's
ruling (a confidence for one reads as favoritism to the distant). Carrier:
per-piece `envyTargets` — or, v1, a pure fold over draft ledgers naming the
gaps at the debrief. If it ever prices: envy discounts dyadic affinity
toward the envied peer (not toward the commander — that channel is
favoritism's, ADR 0065), which the desertion cascade and peer-safety terms
then read for free.

**Open in D214:** whether the *piece* knows the peer's price (terms of the
draft are public within a side today — confirm before wiring); the
affinity-discount magnitude; whether envy of the ransomed ("he paid for
*her*") joins the same carrier.

#### D214 addendum (2026-09-05)

D214 is wired inert and recognition-only, in the seminar path alone because
the draft is envy's only denominated object. `foldEnvy` is a pure terminal
fold over the cycle's draft settlements: within one settlement, a piece
cleared strictly below a same-role peer drafted by the same commander names
the highest-paid such peer and the gap in purse units, when the gap reaches
`ENVY_PRICE_GAP_FLOOR`. The floor is a zero sentinel, so the fold is inert by
default and the terminal `envy` block is omitted. Cycles are not compared
with each other, roles are not compared with each other, and no commander's
purse is compared with another's.

v1 assumes what the draft already makes true today: clearing prices are
settled side-wide and no private-knowledge model of the draft exists, so the
piece is taken to know its peers' prices. A future knowledge model would gate
the fold, not change it. No live state, observation, policy, standing,
register, commendation, Leadership Index term, affinity discount, or PRNG
draw is involved. The affinity-discount magnitude, whether envy of the
ransomed joins the reading, and pricing remain open.

### D215 — Pride (partly wired, 2026-09-05 addendum; refines D182)

**What it is.** Self-appraisal against expectation — and its wounding. D182
already rules that a piece appraises itself against a persistent expectation
relative to role, and notes it will foolishly read its draft price as its
worth. The price side of that ruling is now a terminal recognition fold; live
registration remains open.

**Location.** Carrier: per-piece `selfAppraisal` per D182, updated by
vindication (audit said I was right), promotion, clearing price, and
commendation-criteria conduct; wounded by overrides sustained, price
undercuts (D214's trigger, felt inward), and being passed over (the
obsolescence streak finally lands somewhere). Wounded pride is the hinge
into D208/D209. Debrief names the proud careers and the wounded ones.

**Open in D215:** live registration and the non-price triggers, plus whether
pride enters the refusal threshold (a proud piece refuses beneath-it orders —
a real play change requiring the full exploit-tier re-run).

#### D215 addendum (2026-09-05): the D182 magnitude, price side

The owner ruled the shape of D182 in ADR 0071 — a signed difference from a
persistent, moving expectation seeded by role — and here rules its first
arithmetic. A piece's expectation begins at the role's public asking price,
`DRAFT_LOT_BASE_PRICE + role value × DRAFT_LOT_ROLE_WEIGHT_PERMILLE / 1000`
(a pawn expects 20, an officer 40–60, a Queen 100 at the defaults). Every
price the piece is actually given — its draft clearing price, or the
acceptance price paid to bring it home from captivity, whoever paid it —
registers as `clamp((price − expectation) × 1000 / expectation, −1000..1000)`
permille, and then moves the expectation toward that price by
`PRIDE_EXPECTATION_EMA_PERMILLE`. A pawn paid an officer's price is proud; a
Queen ransomed for a pawn's price is wounded; the same coin means opposite
things, which is the whole of D182. A piece bought high once expects it
again, which is the foolishness D182 was for.

In v1 the carrier is not a `PieceState` field: the expectation and appraisal
are reconstructed deterministically at semester close by `foldPride` from the
cycle ledgers (ransoms first, then the draft, as the week actually runs). The
trajectory is identical to what a carried field would hold, and it lifts into
`PieceState` only when a live registration — the refusal threshold, trauma,
or bitterness — is ruled. A career whose summed appraisal reaches
`PRIDE_NAMING_FLOOR_PERMILLE` is named **proud** or **wounded** at the
seminar debrief only. The ruled defaults are
`PRIDE_EXPECTATION_EMA_PERMILLE = 250` and
`PRIDE_NAMING_FLOOR_PERMILLE = 100`; the fold remains terminal-only and does
not alter play.

Still open in D215: the non-price triggers (vindication, promotion,
commendation conduct; overrides sustained, the obsolescence streak), whether
pride enters the refusal threshold (a play change owed the exploit-tier
re-run), the hinge into bitterness and spite, and the EMA and floor
magnitudes, which await a measurement sweep.

### D216 — Panic (partly wired, 2026-09-05 addendum)

**What it is.** Terror that spreads without exits. The desertion cascade is
the only contagion in tree, and it only carries pieces *off* the board;
rooms also break by freezing — mass quiet-quit at collapsing depth.

**Location.** Trigger: a threshold of near-simultaneous high-`P_captured`
readings or a King-danger costly signal across the fielded roster. Carrier:
none new in v1 — panic is expressible as a synchronized, temporary
`engagementFactor` collapse through the same witness-broadcast machinery the
curdle uses, decaying within the match. Distinct from grief (object is a
lost peer) and despair (chronic): panic is acute and shared.

#### D216 addendum (2026-09-05)

Recognition only: a `PANIC_ONSET` event names the ply at which
`PANIC_ROSTER_FLOOR` fielded pieces read capture risk ≥
`PANIC_CAPTURE_RISK_PERMILLE` at once, or a King-danger costly signal fires
while the fold is enabled. The ruled roster floor is 4; the event is folded
only into the seminar terminal reading. The carrier — synchronized
`engagementFactor` collapse through the witness broadcast — remains open, as
do contagion topology, the quiet-quit double-charge guard, and whether a UI
should dramatize panic. The carrier is the play change owed the exploit-tier
re-run.

### D217 — Relief, awe, loneliness (partly wired, 2026-09-05 addendum)

**Relief** — the feared line survived: a `RELIEF` event names a piece whose
prior own-ply capture risk was at or above `RELIEF_CAPTURE_RISK_PERMILLE` and
then fell below it. **Awe** — a seminar fold names a hero when
`HEROISM_NOMINATION` reaches `AWE_NOMINATION_FLOOR` in one match, reporting
the fielded witnesses. **Loneliness** — a seminar fold names a survivor who
lost above-threshold-affinity peers and has no surviving peer at or above the
same `LONELINESS_AFFINITY_THRESHOLD`. All three are terminal seminar
recognitions only, with zero sentinels and no state change, PRNG draw, or
seeded-payload change at defaults.

#### D217 addendum (2026-09-05)

The three recognitions are debrief-only. Relief is emitted per
ply when the prior own-ply capture-risk reading crosses down through
`RELIEF_CAPTURE_RISK_PERMILLE`; awe folds existing heroism nominations at
`AWE_NOMINATION_FLOOR`; loneliness folds departed peers and survivor affinity
at `LONELINESS_AFFINITY_THRESHOLD`. The ruled defaults are
`RELIEF_CAPTURE_RISK_PERMILLE = 500` and
`LONELINESS_AFFINITY_THRESHOLD = 50`; awe remains at its structural zero.
Each reading is exposed only in the seminar terminal debrief. Relief as a lift
inherits grace's constraints — the morning lift may be its carrier. Awe's
open carrier is a dyadic-affinity rise toward the hero. Loneliness' open
carrier is a stay-side desertion term. None is live state.

## What this ADR does not do

It prices nothing and enables nothing by default. D210's recognition fold,
D211's inert carrier, and D212's inert terminal reading are now implemented
as dated addenda; the remaining implementation order should follow the seams'
freshness:
gratitude (D210) completes the ransom arc the captivity work just opened;
grief (D211) and shame (D212) reuse live machinery; envy (D214) is implemented
as a recognition fold, while pride (D215) is partly wired for price appraisal;
spite recognition (D209) is a pure fold any time after bitterness (D208)
gives it a grievance to read.

The house disciplines bind every entry: hidden during play (D203's
quarantine extends to all of these), named at the closing debrief (ADR
0073's pattern), priced into the Leadership Index only by explicit ruling
with a measurement sweep (the ε discipline), defaults inert, determinism
absolute (no unseeded randomness, no transcendentals, clamped integer
arithmetic), and any carrier that changes play re-runs the exploit tier
(D204/D206) before its knob may default on.

## Addendum — 2026-09-05: D211 grief wired inert

D211 is now wired as a deterministic, terminal-only reading. Each piece may
carry an integer `griefLoad` in `0..1000`; a high-affinity peer loss
(`captured`, `deserted`, or `career_ended`) can add load, while a captive
fengr carries the loss at half weight and a ransom return lifts that captive
portion. Match-boundary decay is the mechanism by which mourning ends, with
the owed ADR 0007 note: the boundary is a permitted place for decay, not a
new live event stream. A fresh career generation starts without its
predecessor's grief.

The carrier can suppress only effective search depth, after the existing
quiet-quit calculation; it does not change quiet-quit classification or
counting. Campaign and seminar closing debriefs may name carried incidents,
but grief is absent from observations, standings, registers, commendations,
policies, live UI, and the Leadership Index. The default load, suppression,
and decay knobs are zero, so default payloads and seeded draws remain
unchanged. The current threshold, load, captive weight, suppression curve, and
decay magnitude are deliberately open for a measurement sweep before any
ruling. No PRNG draw is consumed.
