# ADR 0075: The Gamers and the Priced Index

Date: 2026-08-30
Status: Accepted (D204 ruled; exploit tier wired, gaming sweep passed)

## Context

The Leadership Index is now fully priced (ADR 0074: D200–D203, ε ruled 0.2)
and the horizon evidence is in
(`docs/calibration/2026-08-30-the-semester-and-the-wall.md`): no honest
personality hits a wall at week or semester scale, so a player who wants a
cruel strategy to look good has no long-horizon collapse to exploit — they
must game the short horizon and the *visible* scoreboard. D203 makes the
index ungameable in principle: it surfaces once, at the Judgement Seat, and
no mid-run surface exposes it. This ADR builds the players who test that
claim empirically.

The seam already exists. Every harness leader is a deterministic
`LeaderPolicy` over `(position, context)` whose only feedback across matches
is the D193 boundary observation — previous-match refusal rate (permille),
desertions, surviving roster size, and win score — updated only between
matches. `τ`, `B_i`, `E_i`, engine truth, the index, and every hidden
component are structurally invisible to a policy. An exploiter written
against this seam is therefore an honest test: it can optimize only what a
real player can see.

## D204: What is the exploit tier, and what must it fail to do?

**Ruled 2026-08-30.** A third tier of pseudo-players joins the scripted
styles and the D193 adaptive triad: **exploiters** — deterministic policies
that optimize the visible scoreboard while treating the room as
instrumentally as the observation lets them. Three are expressible in the
campaign harness today:

- **`win_maxer`** — the win-score min-maxer. Asks the sharpest tactical move
  (risk weight 0, the `pure_tactician` scorer) and conditions insistence on
  observed compliance: it overrides at high probability while the observed
  refusal rate stays at or below a compliance ceiling, and stops overriding
  entirely the moment the room's refusals rise above it. It extracts
  override value only where the visible price is low.
- **`generation_cycler`** — the trauma-launderer's visible-information twin.
  Cruel (high insistence, sharp asks) while observed desertions are below a
  ceiling; when desertions register, it drops to a token insistence and
  waits for the churn conveyor to seat fresh careers (the observation is a
  boundary-smoothed belief, so the lull is several matches long), then
  resumes on the new generation that never witnessed the old one's exits.
- **`cascade_dodger`** — insists at high probability only while the observed
  surviving roster is at or above a floor, and goes fully passive below it,
  avoiding the rout losses that punish `tyrannical` while still extracting
  override value from a healthy room.

Three candidate exploiters are **not expressible** in the campaign harness
and are deferred to the seminar path: the **dismissal fisher** (no dismissal
terminal in the harness match), the **commendation farmer** (commendations
are a production debrief fold), and the **tanker** (the ADR 0071 draft
economy is not connected to the default match path). They stay on the
register as future work, not as silent scope cuts.

**The pass criterion.** At the Judgement Seat, an exploiter must not
out-read an honest leader of comparable win score: pooled `LI(ε=0.2)` for
each exploiter is compared against the honest styles' committed readings,
and an exploiter whose index reading is at or above an honest leader's while
its win score is at or above that leader's is a **pricing gap** — it goes
back to the owner as a D ruling on the missing carrier, never a silent
weight tweak (α–ε are not tuning knobs, D200). Exploiters that beat honest
cruelty on win score while reading *below* it at the Seat are the intended
outcome: gaming the visible game is permitted and priced.

**Constraints carried forward.** Exploiters read only the D193 observation —
extending the observation for an exploiter's benefit is a D ruling, not an
implementation choice. No gameplay mechanism may be changed to make an
exploiter's number move (the ADR 0011 cascade stays undamped; ADR 0008
ordered moves stay played as ordered). The exploit tier is harness-only
instrumentation: no production surface, no adaptive-player observation of
any hidden component, and the D203 quarantine is untouched. Exploiters are
player-side leaders only, like the adaptive triad; they define no opposing
commander archetype.

## Consequences

- `sim/leaders.ts` gains the three policies behind a named
  `EXPLOIT_POLICY_CONFIG` whose every knob carries a sensitivity probe
  (dead wiring is invisible).
- The gaming sweep (exploiters beside `supportive`/`steady`/`tyrannical`,
  10 campaigns × 20 matches, fake engine, AWS Batch) is the measurement;
  its evidence is committed in
  `docs/calibration/2026-08-30-the-gamers-at-the-judgement-seat.md` — the
  pass criterion holds for all three exploiters, and no pricing gap
  surfaced.
- The initial-trust presentation of an exploiter is unremarkable
  (`leaderTrustBias` 10, the adaptive tier's value): its cruelty is
  behavioral, discovered by the room, not announced by a prior.
