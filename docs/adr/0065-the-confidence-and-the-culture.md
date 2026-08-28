# ADR 0065 — The confidence and the culture: a private word that may not be kept

- **Status:** accepted (2026-08-28) — **D168** ruled (the private channel
  exists, subject to the riders in §§ 0/0a/0b, which are the ADR's spine) and
  **D169** ruled (`leaderAppraisal` is read by the ability-credence weight,
  § 3). The D169 wiring ships **inert**; the private channel itself is designed
  but not built, and all magnitudes stay unruled pending calibration.
- **Refines:** ADR 0016 (perception, memory, rumor — rumor carries appraisals
  only), ADR 0024 (`τ_benev` buys resilience rather than compliance),
  ADR 0064 (the cushion and the repair)
- **Depends on:** ADR 0013 (a piece reasons from its own view), ADR 0015 /
  ADR 0017 (credence as the weight on the leader's judgment), ADR 0018 (a piece
  never shows arithmetic but always names a cause), ADR 0034 (the query
  barrier), ADR 0025 (no enemy psychological state reaches the player)
- **Evidence:** `docs/calibration/2026-08-28-the-curdle-and-the-floor.md`
- **Answers:** **D168**, **D169** (both 2026-08-28)

## Context

### What the owner asked for

> It's up to us to create a sociology in which 'good leadership' in various
> forms can be observed, rewarded. […] the curdle is one of the most dangerous
> phenomena for inexperienced leaders in all organizations; and while it is
> often interpreted as 'some have it, some don't' it probably is much more about
> some combination of good or bad fortune and assuming leadership for the first
> time in a good or bad culture. I do want to expose all the knobs while we are
> building […]. One thing that the leader brought up is that sometimes you get
> to have 'private communications' with a piece — but the piece may not keep
> that confidence.

Three requirements fall out, and they are the acceptance criteria for anything
built under this ADR:

1. **Leadership must be legible as more than a warmth scalar.** Distinct,
   recognisable ways of leading well must produce distinguishable measured
   outcomes.
2. **Culture and fortune must be first-class inputs.** Identical play must be
   able to produce materially different careers depending on the state of the
   room the commander inherits. A model in which outcome is determined by leader
   policy alone asserts "some have it, some don't", which is the thing the
   owner's source rejects.
3. **Every mechanic ships as an exposed knob**, sweepable later across a
   response surface once human-like players exist.

### What the D166/D167 measurement left unsolved

`docs/calibration/2026-08-28-the-curdle-and-the-floor.md` measured the override
cliff at seed 7 against a competent opponent: 78–87% of all benevolence lost
falls on witnesses rather than on the overridden piece (the curdle is real and
worth keeping), but 42–57% of overrides cost the roster *nothing* because every
payer is already clamped at `0`, and 62–78% of plies are played after that
point.

D167 asks what shape the cliff should have. It cannot, on its own, fix the
deeper asymmetry that D166 ran into: **betrayal is public and care is private.**
Every repair proposed so far — a graded witness cliff, witnessed care, a
proportional cliff — costs the commander nothing to attempt. A leadership
simulation in which kindness is free is not modelling leadership.

A private communication is the first mechanic in this design where the
commander **takes a risk in order to be kind**, and where the size of the risk
is a property of the room rather than of the commander's intention.

### What is already in tree (verified, not assumed)

The transmission graph ADR 0016 specifies is **implemented**:

| element | state | source |
|---|---|---|
| `RumorState` — `pLossTeam`, `leaderAppraisal` | shipped | `src/psychology/types.ts:44-46` |
| credibility-weighted diffusion over affinity + class prestige | shipped | `src/psychology/belief.ts:14-40` |
| roster-wide diffusion step from one speaker | shipped | `src/psychology/belief.ts:43-53` |
| rates as knobs (`RUMOR_P_LOSS_RATE: 0.15`, `RUMOR_LEADER_RATE: 0.1`) | shipped | `src/psychology/config.ts:143-144` |

Two limits matter for this decision:

- **Diffusion has exactly one production call site**, inside the desertion
  cascade, with the deserter as speaker (`src/psychology/cascade.ts:169`).
  Pieces therefore talk to each other *only at the moment someone walks off the
  board*. There is no ordinary, day-to-day peer transmission.
- **`leaderAppraisal` is a write-only field.** It is initialised to `0`
  (`src/psychology/reducers.ts:22`), clamped on load
  (`src/psychology/reducers.ts:56`), and written only by the diffusion function
  itself (`src/psychology/belief.ts:33-38`). Nothing reads it — no verdict, no
  utility, no desertion, no counsel term. Since nothing ever writes a non-zero
  value either, the channel currently diffuses zeros into zeros. The sibling
  channel `pLossTeam` *is* consumed (`src/psychology/cascade.ts:30`,
  `src/psychology/desertion.ts:379`), which is why collective panic spreads
  today and collective opinion of the commander does not.

So the roster can already transmit *how the battle is going* and cannot
transmit *what we think of him*. That is the missing half of the curdle: today
witnesses are curdled only by what they personally saw the commander do.

Two adjacent patterns should be reused rather than reinvented:

- **Qualitative, credence-gated private disclosure already exists** in counsel:
  `forthcoming` / `guarded` / `reluctant` / `silent`, laddered on the holder's
  `tauBenev` (`src/psychology/counsel.ts:54-61`). A piece already decides how
  much to tell the commander in private, based on how it feels about him. The
  confidence is the same ladder pointed the other way.
- **A witnessed social act already produces an explicit event plus a state
  change** (`appraiseDesertionWitness`, `src/psychology/witness.ts:17-56`).
  A leak must follow that shape, never a silent mutation, so that rule 5 of
  AGENTS.md (the log is the source of truth) holds and the seminar debrief can
  show the exact ply where a private word became common knowledge.

## Decision (D168 — ruled 2026-08-28)

A commander may speak privately to one piece. Whether the piece keeps the
confidence is a deterministic property of the roster's state, not of the
commander's wish, and a broken confidence travels through the existing rumor
graph.

The owner's ruling attached two riders, and they change the mechanic's shape
rather than decorating it:

> D168 — the private channel must exist, but good news makes poor gossip, and
> even benevolence can be read as favoritism […]. In leadership, almost nothing
> is free.

### 0. Nothing is free

The governing constraint on every magnitude chosen later: **each act in this
channel is priced, including the ones that look generous.** Confiding costs
(the room prices the intimacy). Keeping costs (the confidant carries something
it cannot unsay). Leaking costs the leaker too, not only the commander. And
declining to confide costs the distance it leaves. This is a falsifiable
constraint, not a slogan: if the calibration sweep finds *any* confiding
strategy that is net-free, the knobs are mis-specified and the mechanic is
rejected rather than shipped, because a free kindness is exactly the D166
failure this ADR exists to avoid.

### 0a. Good news makes poor gossip — which is not the same as not travelling

Leak propensity is a property of the **content**, not only of the room:
criticism and warnings are *repeatable* — they are interesting to carry — while
an admission or an assurance is dull to repeat. Mechanically this is a per-kind
transmission rate, which is the shape the diffusion already has (`pLossTeam`
and `leaderAppraisal` diffuse at separate rates today,
`src/psychology/config.ts:143-144`), so per-kind rates add no new machinery.

**Explicitly rejected reading:** "good news does not travel." It does; it simply
does not travel *as gossip*. The two modes are distinct and both are modelled:

| mode | driver | reaches | shape |
|---|---|---|---|
| gossip | the content is interesting to repeat | broadly, weighted by the speaker's credibility | the existing rumor step, at a per-kind rate |
| reputation among intimates | someone close to the affected piece observes how it fared | narrowly — the affected piece's close affinities | § 0b's affinity-weighted split |

So a commander's kindness is not socially silent, and the sweep must measure
whether repair through this channel produces net benevolence recovery — but the
answer is expected to run through *allies of the piece he was kind to*, not
through the room at large.

### 0b. A favour for one is a favour for all — or favoritism, depending who is watching

A confidence is **observable as an act even when its content is not**. The
pieces who were not taken aside see that someone was, and price it — but they do
not all price it the same way, and this is the owner's second rider in full:

> especially pieces with close affinities may take a favor for one as some
> favor for all.

So the act splits by the **recipient's affinity graph**, not by the content:

- pieces with high dyadic affinity toward the recipient read care — a commander
  who treats my friend well is a commander who might treat me well — and their
  own appraisal of him rises at a fraction of the recipient's deposit;
- pieces distant from or in rivalry with the recipient read favoritism, and
  theirs falls.

One act, opposite signs, decided by who is watching. The magnitude is therefore
not a single knob but a scaled read of the same deposit across the existing
affinity graph — the identical structure the override cliff already uses for
witnesses, with the sign no longer fixed.

A kept confidence is still not free (§ 0), because a commander cannot be close
to everyone: the ally credit and the outsider cost are both real and their
balance is a property of the *room's* cohesion, not of the commander's
intention. In a tight roster, kindness to one genuinely warms several; in a
factional or curdled one, the same act buys a favourite and costs the rest —
which is precisely the "good or bad culture on arrival" effect the owner's
source described, arriving here as a consequence rather than as an authored
rule.

This makes confiding a **rivalrous but not zero-sum** resource, and it turns the
mechanic into a real leadership discrimination: confiding repeatedly in one
trusted piece is measurably different from spreading it, and both differ from
silence — and *whom* you confide in matters as much as how often, because a
well-connected confidant spreads credit that an isolated one cannot.

It also gives the seminar its sharpest debrief
question — *who did you take aside, and who noticed?* The witness-side
appraisal pattern already exists and should be reused rather than reinvented
(`src/psychology/witness.ts:17-56`).

### 1. A confidence is an appraisal, never a board fact

ADR 0016 is binding: rumor carries appraisals only. This also rules out the
degenerate version of the mechanic ("tell the Knight the winning line"), which
would smuggle engine truth past ADR 0013. Four kinds, matching what a leader
actually says in private:

| kind | content | repeatability as gossip (§ 0a) | if kept | if leaked |
|---|---|---|---|---|
| `admission` | the commander concedes he asked too much | **low** — dull to repeat; its reputational effect runs through § 0b instead | repair against the recorded `ruptureDebt` (ADR 0064), larger than the public equivalent | the room learns the commander doubts himself — its appraisal moves, and not only downward |
| `criticism` | the commander's appraisal of a *third* piece | **high** | confidant's regard rises; the third piece is untouched | the third piece learns it was disparaged; dyadic affinity and its own credence fall, and the room prices a commander who talks about people |
| `warning` | the confidant's own standing is at risk | **high** | candour premium: the piece knows where it stands | the room reads a threat rather than candour |
| `assurance` | a promise about future orders ("I will not spend you like that") | **low**, until it is broken — then high | a commitment the piece can hold | breaking it later is the most expensive single act in the game |

Every row also carries the § 0b split: the non-recipients price the fact that a
confidence happened, whatever it contained — the recipient's friends as care,
the rest as favoritism.

`assurance` is the one that makes the other three matter: it is the only place
in the design where the commander's *past words* constrain the cost of a future
order. It is also the only kind that can be violated by the commander rather
than by the confidant.

### 2. Discretion is deterministic and learnable

Whether a confidence is kept is a threshold ladder over the confidant's own
state — the same shape as the counsel ladder — reading benevolence toward the
commander, affinity toward whoever is discussed, engagement (quiet quitting),
and class prestige. The seeded PRNG is used only where the design wants genuine
noise, and only after the ADR 0034 barrier closes.

This is deliberate: a commander must be able to **learn who is safe**, because
that discrimination is the skill the mechanic teaches. A hidden dice roll would
teach nothing and would make the response surface unreadable.

Leaking is not villainy, and the taxonomy must not moralise it. A piece that
tells the Rook it is being criticised may be protecting a friend; a piece that
repeats an `admission` may be reassuring a frightened room. Both are recorded as
the same event kind with different consequences.

### 3. A leak writes reputation, and reputation is then read

A leak emits an event, writes the speaker's `leaderAppraisal`, and runs one
`applyRumorDiffusion` step with the leaker as speaker — connecting the second
half of the ADR 0016 channel for the first time.

For that to have any consequence, `leaderAppraisal` must be read by something.
**D169 is ruled: it is read by the ability-credence weight in the perceived-value
blend, and by nothing else.** Because credence is the weight on the leader's
judgment (ADR 0015), the sink is the credence channel rather than any board
value: a room that has been told the commander is careless *interprets the same
order more harshly*, which is exactly what `calculatePerceivedValue` already
models via `tauAbil` (`src/psychology/credence.ts:9-17`).

Three properties make this safe, and they are load-bearing rather than
incidental:

- **Derived, never stored.** The shift is computed at the point of judgment;
  nothing writes `credence.tauAbil` from `leaderAppraisal`. Hearsay therefore
  cannot permanently overwrite first-hand observation, and it cannot compound
  across repeated diffusion steps — the failure mode that would let a single
  rumour ratchet a roster to zero.
- **Interpretation, not learning.** No other `tauAbil` reader changes
  (fatalistic compliance, the drip, vindication, desertion). What the room says
  colours how an order is read; what the piece has seen is still its own.
- **Signed as the sociology requires.** A positive appraisal raises the weight
  on the commander's implied value; a negative one lowers it, so a curdled room
  refuses more without any coefficient having been aimed at refusal.

The knob is `RUMOR_APPRAISAL_ABIL_WEIGHT`, shipping at `0` per § 5. Note the
honest limitation on evidence: until the leak event of §§ 0–3 exists, nothing
writes a non-zero `leaderAppraisal` — diffusion spreads zeros from its single
desertion-cascade call site — so the AGENTS.md rule 6 wiring probe is necessarily
a reducer-level one. An end-to-end sim sensitivity probe is impossible until the
channel is built, and must not be faked.

### 4. The culture you inherit

Campaign start seeds the roster's peer affinities and `leaderAppraisal` from a
named culture distribution rather than from zeros. A first-time commander
walking into a soured room plays the same moves for a different career, and the
discretion ladder makes that difference concrete: **a curdled room leaks**, so
being rough with one person degrades the very channel required to repair
anything afterwards. That compounding is the phenomenon the owner's source
described, and it emerges from state already tracked rather than being authored.

This is also the honest answer to "some have it, some don't": culture and the
seed are inputs the harness can hold fixed or vary, so the contribution of
fortune to outcome becomes *measurable* instead of rhetorical.

### 5. Inert defaults, and a knob for every clause

Following ADR 0064: everything ships wired and inert (zero magnitudes, culture
distribution defaulting to today's zeros), so every existing golden stays
byte-identical and the live numbers are chosen from a measured before/after, not
from a guess. Knobs to expose, each with a wiring probe per AGENTS.md rule 6:
`RUMOR_APPRAISAL_ABIL_WEIGHT` (§ 3, the only one of these already in tree), the
regard deposit for being confided in, one discretion threshold per kind, a
per-kind gossip repeatability rate (§ 0a), the § 0b affinity split — the ally
credit fraction, the outsider favoritism cost, and the affinity threshold
separating them — the leaker's own
standing cost, the leak's `leaderAppraisal` magnitude, the broken-`assurance`
penalty, the existing diffusion rates, and the campaign-start culture
parameters.

### 6. The acceptance test: no free kindness

Because of § 0, the calibration pass that chooses live magnitudes must report,
per NPC style: net benevolence change from confiding, the favoritism cost borne
by non-recipients, the leak rate by kind, and whether any confiding strategy
dominates silence at zero cost. A dominant free strategy fails the mechanic and
sends the magnitudes back, rather than shipping. Equally, a channel in which
confiding can only ever lose is also a failure — the knobs must be able to
express both regimes, and the measurement decides which the game inhabits.

## Harness consequences (the response surface)

Two gaps block the tuning programme the owner asked for, independent of this
ADR's ruling:

- `sim/sweep.ts` sweeps **one** `ENGINE_CONFIG` knob per run (`--knob`,
  `--values`, with `--fixed=` pinning the rest, `sim/sweep.ts:105-129`). A
  response surface is currently a hand-assembled outer product of runs. Tuning
  human-like players across a surface needs a grid sweep emitting one row per
  cell with the cell coordinates as columns.
- The sweep can only reach `ENGINE_CONFIG`. Counsel's disclosure thresholds live
  in `DRAFT_CONFIG` (`src/core/draftConfig.ts:9-15`) and are **not sweepable at
  all**. Any discretion knob must land somewhere the harness can move, or the
  sweep must be widened to cover both registers.

This ADR does not decide either; it records them as prerequisites for the
calibration that D168's ruling now requires.

## Consequences

- The dead half of ADR 0016 becomes live, and rumor stops being a
  desertion-only phenomenon. Any existing intuition that "pieces do not talk"
  ceases to hold, including in the seminar debrief material.
- Reputation becomes a state a commander can lose *without ever being
  observed*, which is a genuine increase in the game's cruelty. That is the
  point, but it interacts with D167: if the benevolence floor is left as-is, a
  leaked confidence lands on a room that has already stopped keeping score. D167
  should therefore be ruled first.
- LLM containment (ADR 0063) gains its most interesting decision kind: whether
  to confide, and in whom, is a decision no scripted policy currently expresses,
  so the NPC span must be widened to cover it before any containment number is
  quoted against it.
- Journal impact (ADR 0062): `confide` becomes a decision kind with an
  enumerated option set (target × kind), and the observation must carry only the
  qualitative bands the player already sees — never the discretion computation,
  or the mechanic collapses into a solved lookup.

## Alternatives considered

- **Random discretion.** Rejected: an unlearnable coin flip teaches nothing,
  and makes response-surface tuning meaningless.
- **Perfect confidentiality.** Rejected by D168: it makes the private channel a
  free benevolence tap, which is precisely the failure D166 identified. Note
  that rider 0b rejects it twice over — even *perfect* confidentiality would not
  make the act free, because the room prices the intimacy it can see.
- **Valence-neutral leaking** (one transmission rate for all kinds). Rejected by
  D168 rider 0a: good news makes poor gossip, and the asymmetry is the mechanic.
- **Good news simply not travelling.** Rejected — an earlier draft of this ADR
  said so and the owner corrected it. Dull to repeat is not the same as
  socially invisible: kindness reaches the recipient's intimates by observation
  even when nobody gossips about it (§ 0b).
- **A single-signed favoritism cost** on all non-recipients. Rejected by § 0b:
  it would make a well-run, tightly-bonded roster punish care exactly as hard as
  a factional one, erasing the culture effect this ADR exists to model.
- **Confidences carrying board facts or plans.** Rejected under ADR 0016 and
  ADR 0013.
- **Storing the rumour into `tauAbil`** rather than deriving the shift at the
  point of judgment. Rejected under § 3: it would let hearsay overwrite
  first-hand observation permanently and compound across diffusion steps, so a
  single rumour could ratchet a roster to zero with no act by the commander.
- **A separate secrecy subsystem.** Rejected: the affinity-weighted graph,
  credibility model, disclosure ladder, and witnessed-event pattern already
  exist; a parallel system would duplicate them and drift.

## Open questions for the owner

- ~~**D168** — does the private channel exist, and what may travel through
  it?~~ Ruled 2026-08-28: yes, subject to §§ 0/0a/0b.
- ~~**D169** — may `leaderAppraisal` be read, and by which term?~~ Ruled
  2026-08-28: yes, by the ability-credence weight only, derived rather than
  stored (§ 3), shipping inert.
- Whether the commander is ever *told* that a confidence leaked, or must infer
  it from behaviour. Inference is the more honest simulation and the crueller
  game; notification is more teachable in a seminar.
