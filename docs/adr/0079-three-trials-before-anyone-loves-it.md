# ADR 0079 — Three trials before anyone loves it: the surface, the bots, and the room

- **Status:** Accepted (2026-09-04). A plan, in the manner of ADR 0061: it
  says in what order the decisions it opens come due. It opens **D218–D223**;
  the owner ruled **D218** (gate passed for act one and the seminar harness
  only) and **D221** (the model facilitator is a stand-in fallback outside
  ADR 0004) and **D219** (the GUI is a visual layer over the existing journal
  seam) and **D222** (disengagement is near-random choice, measured from the
  journal) and **D223** (packs: military, medieval, corporate, classic/purist,
  in that order) on 2026-09-04, and closed **D220** as moot the same day: the
  stranger step falls away, no journal ever crosses a network, and the model
  playtest becomes the hard gate on seating a human cohort.
- **Scope:** Everything between "the game plays and the seminar survives" and
  "someone who is not us loves it": the GUI, the model players, the human
  playtest, and the facilitator, human and model.
- **Supersedes:** ADR 0061 §1 step 7's phrasing "and only then the GUI" — the
  owner has called the gate; §1 below says what that opens and what it does not.
- **Refines:** ADR 0023 (content packs as data), ADR 0027 (the two formats and
  the ninety-minute cliff), ADR 0028 (the facilitator is a leader too), ADR 0030
  (the transcript), ADR 0062 (the decision journal), ADR 0063 (coverage and
  containment), ADR 0075/0076 (the exploit tier)
- **Depends on:** ADR 0001 (deterministic core, narrative skin), ADR 0004 (no
  runtime LLM), ADR 0013 (a piece reasons from its own view), ADR 0018 (the
  player never sees the arithmetic), ADR 0034 (the query barrier)

## Context

> **"The game plays, the seminar survives. Will anyone love our ugly baby? We
> need to make a GUI pretty enough to enchant, creative enough to intrigue, and
> varied enough to fit different audiences. Then, we need to have tested the
> game engine not only against LLM players, and merchant LLM players, and
> vicious or bored or disengaged LLM players, but also against human task
> rabbits. And then, we need to have the option for human and LLM
> facilitators."**

Where the tree actually stands against that sentence, so nothing below assumes
a surface that does not exist (`docs/adr/IMPLEMENTATION_STATUS.md` is
authoritative):

| The owner asks for | What exists | What does not |
|---|---|---|
| A GUI that enchants, intrigues, and varies | One theme (`tactical-blueprint`), the M4 vertical slice, roster/match/audit/debrief screens, relationship inspector, verdict panels; content-pack schema decided (ADR 0023 §4) | Any second pack; the four onboarding tracks (M7.2); accessibility (M7.3); **a real engine in the browser** — the interactive match constructs a *fake* engine port (`src/app/README.md`), so no browser match is comparable to any harness number |
| Model players, including merchants and the bored | The journal decorator, canonical options, scripted/recorded agents, the digest-checked replay seam (`sim/journal.ts`); the observation projection with qualitative bands; a deterministic **exploit tier** that already plays the merchant (`win_maxer`, `generation_cycler`, `cascade_dodger`, `tanker`, `commendation_farmer`, `dismissal_fisher`) and passes its gaming criterion | Any model agent; the fork machinery (ADR 0062 §5); the containment envelope as a computed metric; a `disengage` decision that anyone ever takes — the emotional axis is still two points (`docs/calibration/2026-08-27-…`), so **no containment number may be quoted** |
| Human task rabbits | One playtest note (`docs/playtest/milestone-4-vertical-slice.md`), the consumer pacing profile (5.8i) | Any protocol, any consent text, any way for a browser match to leave the browser as evidence — `src/` contains no journal writer at all |
| Human and model facilitators | The thesis (ADR 0028 D82: the facilitator receives the same audit a student does); player commendations; world/cohort **types** | The facilitator audit, the cohort dashboard (5.8h), the local world host (5.8j), facilitator commendations, and any ruling on whether a model may facilitate under ADR 0004 |

The lesson of ADR 0061 still governs: **a step may not ship before the
instrument that would detect its failure.** The sentence above lists four
things; read as instruments rather than features they are one chain, and the
chain has an order.

## Decision

### 1. One journal, three kinds of hand

The load-bearing observation is that the three trials share an instrument the
tree already half-owns. ADR 0062 defined the decision journal for a model. A
scripted policy writes the same journal today. **A human at the GUI writes the
same journal**, and so does a facilitator.

> The GUI is a journal writer. What it shows is a rendering of the
> `Observation`; what it accepts is an index into the option set.

Three things follow, and they are why the plan is one plan rather than four:

1. **Containment is computed identically for models and people** (ADR 0063 §3):
   every human decision is scored against every NPC style after the fact, from
   the journal, with no model and no engine. The human playtest therefore
   produces *evidence* on the same axes as the sweeps, not a questionnaire and
   some anecdotes.
2. **The leak test moves to the screen.** ADR 0062 §3 says the observation is a
   projection and is checked. If the GUI renders anything not derivable from
   the `Observation` — the relationship inspector reading `PieceState` directly
   is the live example — then a human knows more than a model did, and every
   model-versus-human comparison is invalid. The rule is *the screen is the
   projection*; the test is a leak test over `ui/`'s inputs, not a formatting
   test. This is **D219**.
3. **A theme may not change a decision.** Packs are `themeTokens`, `nounMap`,
   `dialogue`, `epilogues` (ADR 0023 §4). Two humans on two packs, same seed,
   should produce journals that differ only in `agent`. A pack that measurably
   moves the containment reading has leaked information through its nouns.

Everything that makes the baby lovable — colour, prose, name, tempo — lives
*outside* the journal, and everything that makes the trial honest lives inside
it. That separation is ADR 0001 again, applied to the people.

### 2. The order

| # | Step | Gate it opens | Why it cannot move later |
|---|---|---|---|
| 0 | **The ruling** — the owner has said the ADR 0061 step-7 gate is passed. This ADR reads that as: passed for the *single-player act-one campaign and the seminar harness*; **not** passed for the draft, purse, ransom, honours, or between-cycle market, whose magnitudes are still under search (ADR 0061 steps 3–7). GUI work touches nothing whose knob is still moving | **D218** | Building a draft screen over a purse whose clearing rule may change is ADR 0061's exact failure mode |
| 1 | **The journal reaches the app** — the interactive match path writes `JournalEntry`s; `ui/` reads only the `Observation`; a browser match exports `{journal, seed, determinismId}`; **the browser runs the harness's engine** (Lozza WASM in a worker behind the barrier), so `determinismId` matches | D219 | Every later step's evidence is a journal. A human playtest on the fake engine measures a game nobody else plays; the M4 note already flagged it |
| 2 | **The model players** — the fork (ADR 0062 §5) over cheap NPC prefixes; a model agent behind `AgentIdentity{id, promptVersion, optionSetVersion}`; the containment envelope as a *computed* metric with a pass criterion; the persona set the owner names, each as **authored, versioned prompt text**: honest, merchant (already the exploit tier's job — the model merchant is a check that a *reasoning* gamer finds nothing the deterministic one missed), vicious, bored, disengaged | **D222** | Bored and disengaged are the players the NPCs cannot be (ADR 0062 context). Until `disengage` is a decision someone takes, the emotional axis stays two points and the coverage duty is unmet. This must be measured before a human is asked to play, or the human is the first bored player and there is no envelope to contain them |
| 3 | **The surface** — three tracks that fan out (§4): (a) *legibility* — the first ninety minutes (ADR 0027 §4), the ADR 0018 "name a cause" panel, the transcript made visible (ADR 0030); (b) *variety* — the four packs (military, medieval, corporate, classic/purist — D223) as data, with pack-coverage CI; (c) *access* — colour-safe aura encoding, keyboard play, reduced motion (M7.3) | **D223** | Pretty before step 1 is a screenshot; pretty after step 1 is an instrument with a skin. Variety before the packs are data is a fork (ADR 0023 rejected it) |
| 4 | **The room, first pass** — the local world host (5.8j) so that journals leave a seat only over the LAN, into the room; then a pilot **intensive** cohort of ~12 with a human facilitator and the corporate pack, recruited unselected if the owner wants strangers. **Gated on step 2:** no human is seated until the containment envelope is computed and every persona — honest, merchant, vicious, bored, disengaged — is contained or its escape is understood (§3) | **D220** (closed) | A week of twelve people is the only human test worth running (ADR 0027: less than a week measures nothing that matters), and it is unrepeatable at the price of a sweep. The bots are the only thing standing between the harness and twelve potentially angry people; that is why step 2 is mandatory, not a nicety |
| 5 | **The room** — the facilitator audit (ADR 0028 D82) as a fold over the cohort's journals; the facilitator's own decision kinds (`pair`, `intervene`, `bench`, `feed`, `debrief`) as a **facilitator journal**; the cohort dashboard (5.8h) and the local world host (5.8j); then the **model facilitator** as an ADR 0062 agent over those decision kinds plus debrief prose, judged by the same audit as the human | **D221** | A model facilitator without a facilitator audit is unaccountable by construction — ADR 0028's own detector. The human facilitator in step 4 produces the first audit the model is measured against |

Steps 1 → 2 → 4 → 5 are serial: each is the instrument for the next. Step 3
depends on step 1 and is otherwise parallel with step 2. Step 0 precedes all.

### 3. The gate on the room

The owner considered and dropped a paid, ninety-minute stranger playtest
(2026-09-04): shipping files back and forth is pointless, and anything shorter
than a week measures nothing the seminar cares about. The human test is
therefore the pilot intensive itself, and the model playtest of step 2 is the
**only** instrument between the harness and twelve people in a room. It is
run as a sweep, not a demo:

- **Population:** the five personas as authored, versioned prompts, each run
  across the harness's coverage seeds, with the scripted NPC styles and a
  uniform-random NPC (the D222 floor) on the same seeds as twins.
- **Evidence, in order of weight:** (1) the containment envelope (ADR 0063 §3)
  — every persona's journal metrics against the NPC envelope, per axis; (2)
  the emotional axis — the bored and disengaged personas' rank distribution
  against uniform (D222), and the honest styles' distance from it; (3) the
  merchant's escapes, if any — a reasoning gamer finding a seam the exploit
  tier did not; (4) the ninety-minute cliff on the consumer pacing profile,
  read off the persona journals as "did a legible leadership event occur."
- **Transport:** none. Journals are written in the harness; in the room they
  travel from a seat to the local world host over the LAN and no further
  (ADR 0028). The consumer build makes no network call; **D220 is moot.**
- **Pass criterion, and it is a hard gate:** every persona is contained, or
  each escape is a named, understood finding with a fix or a ruling (ADR 0063
  §2). While any persona escapes on an axis nobody can explain, no cohort is
  seated. The cohort's own journals are then judged against the same envelope,
  and a human escape on an axis the bots did not find is the pilot's first
  result.

### 4. What fans out, and what may not

Fans out cleanly (separate folds or separate files, no shared magnitude):

- the four content packs (each a data file plus dialogue; pack-coverage CI
  makes them independently mergeable);
- the persona prompts (authored text under `promptVersion`; a prompt is never a
  balance term, ADR 0062 §7);
- the engine-in-browser worker (an `EnginePort` adapter; the barrier already
  exists);
- the accessibility track;
- the facilitator-audit folds (one fold per ADR 0028 question: pairing,
  intervention timing, bench distribution, burnout concentration).

May not fan out: the journal-in-app seam (one seam, one leak test), the
containment metric (one definition), the human protocol (one baseline), the
ruling on the model facilitator.

### 5. Detectors that ship with their step

Per ADR 0061 §3, each detector lands in the same change as the thing it guards.

- **The glass screen** (step 1) — any `ui/` read that is not a function of
  `Observation`. Enforced by lint on imports and by a leak test over the render
  inputs, the way the layer rules are enforced.
- **The bored model that isn't** (step 2) — the persona journals are not
  separable from the honest styles by any journal metric. Then the emotional
  axis is still two points and the personas are decoration.
- **The pretty leak** (step 3) — two packs, same seed, same agent, different
  containment reading.
- **The ninety-minute cliff** (step 2, already named by ADR 0027) — no legible
  leadership event inside ninety minutes for a measurable share of persona
  journals on the consumer pacing profile.
- **The bots are not the room** (step 4) — the pilot cohort escapes the
  envelope on an axis no persona found. Then the persona set was too narrow
  to have gated the room, and the finding is a new persona before it is a
  new knob.
- **The unaccountable host** (step 5, ADR 0028) — the facilitator audit cannot
  tell a well-run cohort from a badly-run one across seed variation. A model
  facilitator may not ship while this fires, because it would be judged by an
  instrument that judges nothing.

### 6. Cost, honestly

In sessions of the kind this repository has been running (one owner, one
baseline, AWS Batch for sweeps): step 1 is two to three sessions and the
engine-in-browser is the uncertain half of it; step 2 is two sessions of code
and one of inference spend, with the spend needing a budget ruling; step 3's
three tracks are one to two sessions each and parallel; step 4 is one to two
sessions for the local host, then a pilot cohort measured in the intensive's
five days plus recruitment; step 5 is two sessions for the audit and dashboard
and one for the model facilitator. The external waits — recruitment, the
pilot week, the inference budget — dominate
the calendar and are the reason the order matters: nothing that waits on a
person should be scheduled before the instrument that will read what they did.

## Open decisions

- **D218** ✅ — Is the ADR 0061 step-7 gate passed, and for which surfaces?
  **Ruled 2026-09-04 (owner):** passed for the act-one campaign and the
  seminar harness; not passed for the draft, purse, ransom, honours, and market.
- **D219** ✅ — Does the GUI become a journal writer, and may the screen show
  anything not derivable from the `Observation`? **Ruled 2026-09-04 (owner):
  yes, and no** — "the GUI is just a visual layer on what already exists."
  The relationship inspector today reads past the projection and must move.
- **D220** ⬜ — May a consented playtest upload a journal? **Closed as moot
  2026-09-04 (owner):** the stranger playtest falls away; journals cross no
  network, only the LAN to the local host in the room. The consumer build
  makes no network call and ADR 0004's "no backend" is untouched.
- **D221** ✅ — Is a model facilitator inside ADR 0004 (no runtime LLM in the
  shipped game) or outside it? **Ruled 2026-09-04 (owner): outside** — a
  stand-in fallback for when no human facilitator is available; a host-side,
  API-keyed, opt-in tool whose prose is presentation and whose decisions are
  journal indices. The human facilitator's audit is its pass criterion.
- **D222** ✅ — What is disengagement, measurably? **Ruled 2026-09-04
  (owner): "a near random choice of moves."** A decider is disengaged over a
  window when its chosen indices are indistinguishable from a uniform draw
  over the option set; computable from the journal alone, since every option
  is scored. Latency and abandonment are telemetry correlates, not the
  definition. A uniform-random scripted NPC becomes the floor of the
  emotional axis.
- **D223** ✅ — Which packs ship, and in what order? **Ruled 2026-09-04
  (owner): military, medieval, corporate, classic/purist**, in that order,
  replacing the indie / exec-lab / purist / academic track names as the pack
  set. The personas sweep every pack; the pilot cohort plays corporate.

## Consequences

- ADR 0061 §1 step 7 is read as opened for the act-one and seminar-harness
  surfaces only; its chain (steps 3–7) continues untouched beside this one, and
  no GUI in this plan renders a knob that chain is still moving.
- The fake engine leaves the interactive match path. Until it does, no browser
  evidence is admissible beside a harness number (`src/app/README.md`).
- Human evidence enters `docs/calibration/` on the same terms as sweep
  evidence: dated, seeded, `determinismId` recorded, one baseline — and only
  from the room, via the local host. No journal crosses a network.
- No human cohort is seated until step 2's containment envelope passes for all
  five personas. The model playtest is a gate, not an option.
- A model facilitator, if D221 rules it outside ADR 0004, is the first place a
  live model touches the product at all, and the boundary is the same as ADR
  0062's: indices in, prose out, nothing re-enters state.

## Alternatives considered

- **GUI first, telemetry later.** Rejected: the first pretty playtest would be
  on the fake engine and would produce anecdotes; ADR 0027 §5 rejected this
  order once already.
- **A paid, ninety-minute stranger playtest with journal upload.** Considered
  and dropped by the owner: files back and forth are pointless, less than a
  week is pointless, and it would have been the consumer build's only network
  call. The human test is the pilot week; the bots gate it.
- **A separate playtest build with its own logging.** Rejected: two instruments
  measuring one game (ADR 0061 §4's failure — several confident answers against
  different baselines).
- **A live model as opponent or piece, to make the game "creative."** Rejected
  by ADR 0004 and ADR 0062; creativity is authored packs and the roster's own
  history (ADR 0023 §5).
- **Human facilitators only.** Rejected as a plan, not as a product: the model
  facilitator is what makes a third-party seminar (ADR 0028 §3) affordable, but
  it is last because it needs the human's audit to be measured against.
- **Recruiting chess players for the playtest.** Rejected: the consumer will not
  be filtered, and strength is a covariate the journal can carry.
