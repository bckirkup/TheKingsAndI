# Trust Dynamics — The Competence Trap

_Design intent, owner-stated:_

> **A brilliant chess player should still lose early if the pieces will not
> trust him, and losing should deepen the mistrust. The pure spiral — for a
> player who does not adjust to the new mechanics — is intentional. Recovery
> requires realizing this isn't exactly chess, and that takes multiple games.**

This document specifies that feedback loop. It resolves D24 and constrains D19.
Nothing here is implemented; it is the target model.

---

## 1. The loop the spec is missing

The reference spec has **no** outcome→trust edge. Trust gates behavior (depth,
refusal, desertion) but nothing writes it back from match results, so the loop
cannot occur:

```
                     (missing today)
        ┌──────────────────────────────────────────┐
        │                                          ▼
   low T_i ──► low η_i ──► shallow D_i ──► worse play ──► loss
        ▲                     +                              │
        │                  refusals                          │
        └──────────────────────────────────────────────────  ┘
                        loss lowers T_i
```

Add that edge and the thesis appears: **tactical skill is necessary but not
sufficient.** The player's Elo sets the ceiling; the roster's trust decides how
much of that ceiling they are permitted to use.

## 2. The spiral is a designed outcome, not a balance failure

This system is deliberately **positive feedback with no automatic damping**. A
player who keeps playing pure chess should watch a roster deteriorate to
refusal, desertion, and loss, campaign after campaign, and *should not be rescued
by a decay term*. Auto-forgiveness would delete the lesson: it would teach that
mistreatment costs nothing if you wait.

So the model has **no unconditional pull toward baseline**. Trust moves only in
response to what the player does.

```
ΔT_match = -λ_loss · (1 - WinScore/100) · severity     // losing compounds
         - Σ betrayal_debits                          // sacrifices, benching, exposure
         + Σ costly_signal_credits                    // ONLY source of recovery
```

The single legitimate safety property is narrower: **the spiral must be
escapable by a player who changes behavior**, and must remain inescapable for
one who does not. Those two requirements are what §5 tests.

## 3. Recovery is a change of policy, not a change of skill

Recovery comes from **costly signals** — actions that visibly sacrifice board
utility for organizational utility. These are the vocabulary of the second game
the player must learn to see:

| Signal | Trust effect | Chess cost |
|---|---|---|
| Move the King into real danger to relieve a piece | large `+T`, witnessed | genuinely bad chess |
| Decline a materially winning sacrifice of a high-`A` piece | `+T` to the spared piece and its friends | gives up material |
| Retain a failing piece rather than benching it | small `+T` roster-wide | keeps a weak piece on the board |
| Avenge a captured piece (recapture within *k* plies) | `+T` to the victim's friends | often tactically inferior |
| Give a novice piece the decisive move | `+T`, `+E` | lower `D_i` on a key move |

Two consequences:

- A player can be *winning* and still bleeding trust — that is the trap closing.
- A player can *deliberately lose a match* to buy trust, and it can be correct.
  This must be legible in the audit, or it reads as the game cheating.

**Rates stay asymmetric.** Distrust arrives fast and in large increments;
credit accrues slowly and only when paid for. A player who converts at match 10
should not be whole by match 12.

## 4. The arc is multi-campaign by design

The insight takes multiple games to arrive, so the unit of the arc is the
**campaign**, and possibly several:

| Phase | Roster state | Player experience |
|---|---|---|
| **1. Audition** | low `T`, low `E`, shallow `D_i` | "I'm playing 400 points below my strength and I don't know why." |
| **2. The trap** | losses compound; refusals appear | "I keep finding the right move and being told no." |
| **3. Collapse** | desertion cascade, roster attrition, campaign lost | The intended failure. Losing campaign 1 is a legitimate, non-buggy outcome, and the rout that ends it is designed (ADR 0011). |
| **4. Insight** | new campaign, changed policy | "This is not exactly chess." The product's actual moment. |
| **5. Command** | high `T`, high `E`, `D_i → 16` | Full tactical strength *plus* pieces that volunteer. |
| **6. Relapse** | one betrayal, one firing | The asymmetry never switches off. |

This makes several previously-open questions load-bearing:

- **A campaign must have a hard failure state** (previously open in
  `risks_and_open_questions.md`). Phase 3 needs to actually end something.
- **D27 (cross-campaign roster memory) is now a real fork.** A fresh roster each
  campaign gives the player a clean surface to apply the insight; a remembered
  reputation makes the world persistent but can make campaign 2 unwinnable for
  reasons the player already learned from. Recommend: **fresh roster, persistent
  player reputation as a small starting-trust modifier** — the world remembers,
  but not fatally.
- **D28: do not tell the player.** Discovery is the mechanic. But discovery must
  be *inferable*: piece dialogue and the match audit must state the grievance
  plainly ("you spent me to win a pawn") even while never naming the strategy.
  The line between "hard to see" and "unfair" is legibility of cause, not
  disclosure of solution. The exec-lab onboarding track is the exception — a
  facilitated session probably front-loads the lesson.

## 4b. Dismissal, succession, and the only earned recovery (ADR 0021, ADR 0022)

The spiral has an ending that is not a rout: the King relieves the player and
takes personal command. The lesson lands because the successor is *worse at
chess* and gets *better results* — full mandate means a mediocre plan is
actually executed, while the player's superior judgment could not reach the
board through collapsed credence. Watching that is the argument this project
exists to make.

Recall (D56) is the one recovery path that does not violate the
no-free-forgiveness rule: it is triggered by the successor's *measured*
performance, never by elapsed time or contrition, and surviving it still
requires the changed policy §3 demands.

## 5. What must be true — and what must NOT be fixed

The harness runs scripted leader policies. Two of them define the acceptance
criteria for this whole subsystem:

- `pure_tactician` — maximizes board evaluation, never pays a costly signal.
- `redeemer` — plays `pure_tactician` for *N* matches, then switches to a
  trust-investing policy.

| Assertion | Meaning |
|---|---|
| `pure_tactician` spirals to desertion and rout in the large majority of campaigns | **required**; if it recovers, the lesson is absent |
| `pure_tactician` win rate declines monotonically across a campaign | the loop is live |
| `redeemer` measurably recovers within ~1–2 campaigns of switching | the spiral is escapable *by insight* |
| `redeemer` does **not** recover immediately | the asymmetry holds |
| corr(player tactical strength, campaign win rate) ∈ (0, 1) | skill helps; skill alone does not suffice |
| a `redeemer` who switched at any point can always still improve | no absorbing state exists *for a changed policy* |

Note the reframing of the "doom spiral" detector: the failure condition is not
"campaigns collapse" — collapse is the point. The failure condition is
**collapse that persists under an ideal trust-investing policy**, i.e. an
absorbing state the player cannot leave even after learning the lesson.

## 6. Degeneracy detectors (added to `docs/testing_strategy.md` §4)

8. **Absorbing state:** > 5% of campaigns reach a state from which even the
   oracle `redeemer` policy cannot raise mean trust.
9. **Toothless spiral:** losing has no measurable effect on next-match trust —
   the owner's core loop is absent.
10. **Skill nullification:** corr(player strength, campaign win rate) ≈ 0 — the
    chess stopped mattering and the game became a slot machine.
11. **Free redemption:** `redeemer` recovers as fast as it fell, or recovers
    without paying board cost — the costly signals aren't costly.

## 7. Open sub-decisions

- **D25:** Which costly signals ship in MVP? King-endangerment and
  declined-sacrifice are the strongest and the hardest to detect correctly.
- **D26:** How many matches should phase 2 last before collapse? Too fast and
  the player never forms a hypothesis; too slow and they quit. Hypothesis: the
  first campaign should be losable in 8–12 matches.
- **D27:** Cross-campaign memory — fresh roster, remembered roster, or fresh
  roster with a reputation modifier (recommended).
- **D28:** Onboarding disclosure — discovery by default, with grievances always
  legible; exec-lab track may front-load the lesson.
- **D29:** Is there a post-collapse epilogue (a debrief that names the
  archetype the player just enacted)? This is probably where the product's
  leadership claim is actually earned.
