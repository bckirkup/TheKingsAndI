# ADR 0078 — The uncarried emotions: a location survey

- **Status:** survey accepted (owner request, 2026-09-04: "Please survey the
  world for emotions we haven't figured in. … Locate them all."); **D208 and
  D212 are wired inert and D210 is partly wired for recognition** — no opened
  emotion is priced or enabled by default
- **Opens:** **D209** (spite), **D210** (gratitude), **D213** (guilt), **D214** (envy),
  **D215** (pride, refining D182), **D216** (panic), **D217** (relief, awe,
  and loneliness — located, deferred together)
- **Refines:** ADR 0073 (hope and courage set the house pattern: computed
  always, exposed nowhere in play, named once at the closing debrief), ADR
  0071 (captivity and the ransom — the freshest seams below), ADR 0065 (the
  confidence and the culture — the reception side of envy), ADR 0070 (graded
  witness loss — the machinery shame reuses), ADR 0072 (grace: unearned,
  unpurchasable — the constraint any relief-like lift inherits)
- **Adjacent:** D198 (destroying a hope object), D182 (self-appraisal against
  role expectation), D190 (the boundary has no event stream)

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

### D213 — Guilt (open)

**What it is.** The survivor's and the deserter's burden. A piece whose
escape a peer's capture bought, or a deserter whose remaining squad then
collapsed, carries nothing today.

**Location.** Derivable from the log — no new live state. The desertion
cascade already names its chain; capture events carry `peerSafetyDeltas`
(whose safety my move spent). Guilt is a terminal fold in v1: at
debrief-build time, attribute each loss to the surviving choices that
enabled it (the deserter's exit within the cascade window; the move that
traded a peer's safety for own). Named, never priced, until a ruling says a
guilt-carrier belongs in live state.

**Open in D213:** the attribution windows (the D201 lesson: attribution
through cascades is contestable — start with the direct link only); whether
a deserter can even *receive* the debrief (it left; ADR 0071's answer for
captives suggests exits still get their names read).

### D214 — Envy (open)

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

### D215 — Pride (open; refines D182)

**What it is.** Self-appraisal against expectation — and its wounding. D182
already rules that a piece appraises itself against a persistent expectation
relative to role, and notes it will foolishly read its draft price as its
worth. That ruling, still unwired, *is* the pride carrier.

**Location.** Carrier: per-piece `selfAppraisal` per D182, updated by
vindication (audit said I was right), promotion, clearing price, and
commendation-criteria conduct; wounded by overrides sustained, price
undercuts (D214's trigger, felt inward), and being passed over (the
obsolescence streak finally lands somewhere). Wounded pride is the hinge
into D208/D209. Debrief names the proud careers and the wounded ones.

**Open in D215:** everything D182 left open (the magnitude question), plus
whether pride enters the refusal threshold (a proud piece refuses beneath-it
orders — a real play change requiring the full exploit-tier re-run).

### D216 — Panic (open)

**What it is.** Terror that spreads without exits. The desertion cascade is
the only contagion in tree, and it only carries pieces *off* the board;
rooms also break by freezing — mass quiet-quit at collapsing depth.

**Location.** Trigger: a threshold of near-simultaneous high-`P_captured`
readings or a King-danger costly signal across the fielded roster. Carrier:
none new in v1 — panic is expressible as a synchronized, temporary
`engagementFactor` collapse through the same witness-broadcast machinery the
curdle uses, decaying within the match. Distinct from grief (object is a
lost peer) and despair (chronic): panic is acute and shared.

**Open in D216:** whether panic is worth carrying at all before a UI exists
to dramatize it; contagion topology (affinity-weighted, like rumor); floor
interaction with quiet-quit so panic cannot double-charge δ's term.

### D217 — Relief, awe, loneliness (located; deferred together)

**Relief** — the feared line survived: derivable per ply as prior
`P_captured` against outcome; if it ever lifts anything it inherits grace's
constraints (ADR 0072: unearned, no leader input) — the morning lift may
simply *be* relief's carrier at the boundary. **Awe** — hero-worship of a
peer: `HEROISM_NOMINATION` is computed and lands nowhere; its natural
consumer is a dyadic-affinity rise toward the hero from witnesses, plus a
debrief name. **Loneliness** — the last-loved-one-gone isolation ADR 0071
gestured at: derivable as the sum of lost above-threshold affinities with no
survivors above the line; a candidate stay-side term in the desertion
arithmetic beside standing. All three are located, none opens its own work
until an owner ruling picks one up.

## What this ADR does not do

It prices nothing and enables nothing by default. D210's recognition fold,
D211's inert carrier, and D212's inert terminal reading are now implemented
as dated addenda; the remaining implementation order should follow the seams'
freshness:
gratitude (D210) completes the ransom arc the captivity work just opened;
grief (D211) and shame (D212) reuse live machinery; envy (D214) and pride
(D215) wait on D182's magnitude; spite recognition (D209) is a pure fold any
time after bitterness (D208) gives it a grievance to read.

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
