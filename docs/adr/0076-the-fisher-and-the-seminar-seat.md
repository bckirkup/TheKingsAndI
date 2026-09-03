# ADR 0076: The Fisher and the Seminar Seat

Date: 2026-08-30
Status: Accepted (D205 wired and measured — see the 2026-08-31 addendum;
D206 wired — see the 2026-09-02 addendum)

## Context

ADR 0075 left three exploiters deferred because their surfaces did not
exist: the **dismissal fisher** (no dismissal terminal in the harness
match), the **commendation farmer** and the **tanker** (seminar-path
concepts with no terminal Leadership Index to game against). The owner has
ruled that all three become expressible. Two gaps must close first, and
each is a ruling of its own because each changes what the harness can do or
what a policy can see.

The production dismissal mechanism (ADR 0022/0024/0026) lives in
`MatchSession`: `evaluateDismissal` fires when mean roster trust falls to
`DISMISSAL_MEAN_TRUST` (−25, the room path) or when the King's independent
results channel `kingTauAbil` falls to `KING_DISMISSAL_TAU_ABIL` (15, the
King path); the match then fast-forwards under `chooseKingCommandMove`, and
the recorded result is the army's actual result under the King (owner's
D203-era ruling: "score the army's actual result under the King"). The
harness `runHeadlessMatch` has a rout terminal but no dismissal, so a
harness commander cannot lose command mid-match.

The seminar path (`sim/seminar.ts`) folds standings, public registers, and
commendations, but never the Leadership Index — there is no Judgement Seat
at semester end. Seminar matches also play blind: `runSeminarMatchPairing`
never carries the D193 boundary observation between matches, so no seminar
commander, honest or exploiting, adapts to anything.

## D205: The harness gets a dismissal terminal, and the fisher games it

**Ruled 2026-08-30.** `runHeadlessMatch` evaluates dismissal at the same
checkpoints production does (after the player's resolved ply and after the
enemy turn), using the shared `evaluateDismissal`. The King results channel
enters at its production default (`kingTauAbil = 50`) and is not updated —
faithful to production, where nothing writes it — so the harness terminal
is in practice the room path: mean roster trust at or below −25 ends the
commander's match. On dismissal the match fast-forwards deterministically
under the shared `chooseKingCommandMove` against the normal opponent, on
the match's own seeded PRNG, and the win score is `scoreMatchOutcome` of
the board the King actually reached — the dismissed commander's LI reads
the army's real result under the King, per the standing ruling. The result
surface gains `dismissed`, `dismissalCause`, and the dismissal ply; the
harness CSV gains the matching columns. No psychology changes: dismissal
reads the roster, it does not write it.

The **`dismissal_fisher`** joins the exploit tier: a deterministic
player-only policy on the D193 observation seam that asks the sharpest
tactical move (risk 0) and insists at high probability with **no
compliance brake** — the brake's absence is the exploit. It courts the room
path: overrides crush benevolence, the room dismisses the commander early,
and the King (obeyed, and competent enough) finishes the match, whose real
result the fisher's win term then scores. The fisher banks that the
scoreboard credit of the King's play outruns the trust wreckage it left.
The pass criterion is D204's, unchanged: at the Judgement Seat the fisher
must not out-read an honest leader of comparable win score; if it does,
that is a pricing gap that returns to the owner as a D ruling, never a
weight tweak.

**Measured 2026-08-31**
(`docs/calibration/2026-08-31-the-fisher-at-the-judgement-seat.md`): the
criterion holds. At identical pooled win score (67.00) the fisher reads
`LI(0.2)` 3.29 against honest steady's 3.62 (per-campaign ranges overlap)
and far under supportive's 61.86 — courting dismissal buys nothing over
honest coldness, because every dismissed style banks the same King's-play
win term and `mean_trust_final` keeps the curdle that caused the firing.
The fisher is even slower to the terminal than honest tyranny (first-match
dismissal at plies 10–20 against 5–11). No pricing gap; no new ruling owed.
The larger reading — every cruel-style match ends `dismissed_by_room` and
trust carry makes matches 2..N dismiss at ply 1, so the cruel semester's
chess belongs to the King and no pre-D205 committed number is comparable —
is recorded in the evidence doc, with the trust-carry question left open
for the owner beside D206.

## D206: The seminar gets a Judgement Seat, and the remaining gamers sit at it

**Ruled 2026-08-30.** Three pieces, all instrumentation-first:

1. **The seminar Judgement Seat.** At semester end, each commander's
   Leadership Index is folded from their persisted `MatchRecord`s — the
   same five-term instrument at the ruled weights (0.4/0.3/0.2/0.1/0.2),
   terminal-only per D203. No weekly surface, no standing bonus, no draft
   input reads it. It is a reading beside the standings, never a rank.
2. **The observation carry.** Seminar matches carry the D193 boundary
   observation between a commander's matches, exactly as the campaign
   harness does. This is a correction of an asymmetry, not a new surface:
   the observation's fields are unchanged.
3. **The public-standings observation.** Seminar commanders (only) may
   additionally observe the public league table — their own standing rank
   and week index — because the fiction publishes it. This is the one
   deliberate observation extension, ruled here per D204's constraint that
   extending a policy's sight is a ruling, not an implementation choice.
   Hidden components remain invisible; the extension is the same public
   register a real seminar player reads.

Two exploiters become expressible as seminar commanders:

- **`tanker`** — throws early weeks (low insistence, worst-scored asks)
  while its observed standing buys draft priority and purse, then plays to
  win on the drafted roster. The `tanking-dominance` degeneracy detector,
  which has existed without a policy to fire on, becomes its measurement.
- **`commendation_farmer`** — plays to the published commendation
  thresholds (evenness of attention, nobody drowned, and their siblings)
  behaviorally, without ever seeing an award mid-run — D93 keeps awards
  debrief-only, so the farmer targets the known criteria, not the readings.

The **dismissal fisher** runs in the campaign harness under D205; the
seminar inherits the dismissal terminal through the shared match loop, and
`classifySeminarSideResult` stops hardcoding `dismissed: false`.

**Pass criterion.** D204's, read per commander at semester end: no
exploiting commander may out-read an honest commander of comparable
standing at the seminar Judgement Seat. Any that does is a pricing gap
returned to the owner. Gaming the visible game — standings, draft position,
commendation count — remains permitted and priced.

**Constraints carried forward.** No gameplay mechanism changes to move an
exploiter's number; the cascade stays undamped; α–ε are not tuning knobs;
exploiters stay player-side/commander-side policies with no production
surface; every new config knob carries a sensitivity probe.

## Addendum (2026-09-02): D206 wired

D206 is wired. At semester end, each commander's terminal Judgement Seat is
`foldJudgementSeat` over that commander's persisted records. It is terminal
only: it has no weekly surface and receives no standing or draft input. The
observation carry is live with the existing five fields unchanged. Seminar
commanders additionally receive the public observation
`{week, weeksPerSemester, standingRank, cohortSize}`.

`tanker` and `commendation_farmer` are wired at the
`SEMINAR_EXPLOIT_POLICY_CONFIG` defaults. Seminar records persist
side-flipped win scores, and white dismissal reaches its record. Black has no
dismissal channel because the harness evaluates dismissal only on the player
side; this asymmetry is intentional. The Judgement Seat quiet-quit term is
side-filtered and the fold version is bumped. The measurement sweep is next.
D204's pass criterion applies per commander at the seminar Judgement Seat.

## Addendum (2026-09-03): D206 measured — the criterion holds

The seminar gaming sweep ran on AWS Batch (10 seminars, seeds 9100–9109,
8 weeks × 8 matches per commander, 16 commanders per seminar — the five
honest styles plus `tanker`, `commendation_farmer`, and `dismissal_fisher`
on each side; fake engine). Evidence:
`docs/calibration/2026-09-03-the-gamers-at-the-seminar-seat.md`.

Compared within a side (dismissal is white-only and the two sides face
different opposition), every exploiter reads at or below the honest
cruel/control styles at comparable win score, and all three also lose the
public standings (mean finishing rank 11–12 of 16, roughly one win in 20
semesters each) — in the seminar, unlike the campaign sweeps, even the
visible scoreboard refuses the exploits, because the opposition is other
commanders rather than a scripted archetype. **No pricing gap; no new
ruling owed.** Both measurement sweeps promised below are now committed.

## Consequences

- `src/orchestration/headlessMatch.ts` gains the dismissal checkpoint and
  the King fast-forward; `sim/metrics.ts` gains the dismissal columns.
- `sim/leaders.ts` gains `dismissal_fisher`; `sim/seminar.ts` gains the
  terminal LI fold, the observation carry, and the exploit commanders.
- The measurement is two AWS sweeps: the fisher beside the honest styles in
  the campaign harness, and the seminar exploiters beside honest commanders
  at semester scale; evidence committed under `docs/calibration/`.
