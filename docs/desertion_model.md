# Desertion — the piece's own calculation

_Owner intent:_

> **Defection to the other side is off the table; quitting the board is very
> much in scope. By deserting, a piece loses the risk of the pain of being
> taken, but increases the risk of loss. You can definitely push your entire
> team to losing the game quickly in a cascade.**

Governed by ADR 0003 and ADR 0011. The expected-cost comparison below is
implemented in `src/psychology/desertion.ts`.

---

## 1. Desertion is a decision, not a threshold

The reference spec gates desertion on `T_i <= -75 && M_i === 0` — a hard
trip-wire that fires on state rather than on reasoning. Owner intent replaces it
with an expected-cost comparison the piece performs itself:

```
U_stay(i)   = -P_capture(i)·pain_i
              - P_loss(team | i stays)  · λ_i · S_collective
U_desert(i) =            0
              - P_loss(team | i leaves) · λ_i · S_collective · μ_i
              - standing_i · glory_i · S_standing

desert  ⟺  U_desert(i) > U_stay(i) + hysteresis_i
```

| Term | Meaning |
|---|---|
| `P_capture(i)` | the piece's own estimate of being taken soon, from its depth-`D_i` view |
| `pain_i` | how much being taken costs it — rises with accumulated `B_i` (ADR 0009) |
| `P_loss(team \| ·)` | probability the army loses, with and without it on the board |
| `λ_i` | **how much this piece cares that the team loses** |
| `S_collective` | team-loss stake, measured in the same pain units as `pain_i` (default `50`) |
| `standing_i` | mean bond the remaining pieces hold toward `i`; zero peers means zero standing |
| `glory_i` | `(w_ambition_i + w_prestige_i) / 2`, the piece's stake in reputation |
| `S_standing` | anticipated standing-loss stake in pain units (default `100`) |
| `μ_i` | residual stake after walking away, `0 ≤ μ_i ≤ 1` |

Deserting sets the piece's personal capture risk to zero and raises
`P_loss(team)`. Everything interesting lives in `λ_i`.

## 2. `λ_i` is where trust does its work

```
λ_i = f(T_i, M_i, w_loyalty_i, Σ_j A_{i,j})
```

A piece that trusts its leader, has morale, is loyal by trait, or has friends
still on the board weights the team's defeat heavily and will absorb enormous
personal risk. A distrusting piece discounts the team's fate toward zero and
deserts on a much smaller personal danger.

This is the cleanest statement of the game's thesis anywhere in the design: **a
leader's trust budget is literally the coefficient on collective interest.**
The implementation keeps `λ_i` as a dimensionless commitment factor and gives
the team's defeat an explicit pain-scale stake, `S_collective`, so that trust
can outweigh private capture pain rather than being confined to a
probability-sized addend.
Desertion also charges the deserter for the standing it expects to lose in
front of its remaining comrades. This is the mean of each remaining observer's
non-negative affinity-plus-class-prestige bond toward the deserter, weighted by
the deserter's ambition and prestige traits. The cost falls as comrades leave
and is exactly zero when no comrades remain, so it is an anticipated witness
cost rather than a damping floor.

Consequences that fall out for free, none of which need special-case code:

- **Free-riding is emergent.** Every piece would rather *someone else* hold the
  line, because the team term is shared and the pain term is private.
- **Sacrificing pawns has second-order cost.** It raises `pain` (via `B_i`) and
  lowers `λ` (via `T_i`) for every witness, not just the victim.
- **The brave are exploitable.** High-`λ` pieces will stay through anything,
  which is exactly how a leader burns out their best people. The campaign
  debrief should name this.
- **Desertion is contagious through `P_loss`, not through a mood variable** —
  see §3.

## 3. The cascade is intended

Each desertion raises `P_loss(team)` for everyone remaining, which lowers the
value of staying, which triggers more desertions. That is textbook positive
feedback and **it is the design**: a rout is a real leadership outcome, and a
player should be able to lose an army in a handful of plies.

Therefore:

- **No artificial damping.** No cooldowns, no per-match desertion caps, no
  "morale floor" that quietly prevents collapse. Those would hide the lesson,
  which is the same reason ADR 0007 refuses a trust-decay term.
- **One natural brake only:** witnessing cost. A piece that walks off in front of
  its comrades loses standing with them (`A_{j,i}` drops for every witness `j`).
  Early deserters are punished by the ones who stay. This is a consequence of
  the existing witnessed-event machinery, not a balance patch.
- The costly signal for declining a sacrifice applies when the preferred line
  would sacrifice a piece whose incoming dyadic affinity `Σ_j A_{j,i}` is at
  least `100`; this identifies a well-liked, high-`A` piece without requiring
  it to be the roster's highest-ability piece.
- Declined-sacrifice detection uses a width-1 pre-move best-line seat at
  `CAMPAIGN_CONFIG.PLAYER_EFFECTIVE_DEPTH`. This is the leader's available
  view, not ground-truth ceiling analysis: a sacrifice the player could not
  see is not treated as a costly decline. The seat is collected concurrently
  with the ordinary insight barrier; it must not open a dependent round.
- **Hysteresis is permitted but must be tiny** — enough to stop a piece
  oscillating between decisions on identical inputs within one turn, not enough
  to prevent a rout.

### The rout should be legible
The player must be able to watch it happen and understand why: a visible
`P_loss` climb, each departure narrated with its grievance, and an audit that
reconstructs the chain ("Aldric left after you spent Maren; three more followed
within two moves"). A fast collapse the player cannot reconstruct is the
difference between a lesson and a bug report.

## 4. Interaction with the other accepted decisions

| Decision | Interaction |
|---|---|
| ADR 0002 (free re-plan) | Refusal costs nothing, so desertion is the only *irreversible* consequence in the game. It carries the entire stake. |
| ADR 0008 + ADR 0013 | `P_capture(i)` and `P_loss` are the piece's *own* depth-`D_i` estimates — a novice may desert from an imagined threat, or fail to leave a genuinely lost position. Insight therefore reaches the board through desertion even though it never changes a commanded move. |
| ADR 0014 (override) | Forcing a move is the fastest route into a cascade: it drives `T_i` down, which drives `λ_i` down, which is exactly what makes pieces leave. |
| ADR 0009 (capture is trauma) | `pain_i` grows with `B_i`, so a piece spent repeatedly becomes progressively more likely to walk. Repeated sacrifice is priced automatically. |
| ADR 0003 (King exempt) | The King never deserts; the army can dissolve around it. |
| D22 (morale) | `M_i` no longer gates desertion as a trip-wire; it feeds `λ_i`. Morale still needs an update rule, but it is no longer load-bearing for reachability. |

## 4b. Dismissal is the cheaper exit (ADR 0021)

Desertion is not the only way out from under a bad commander, and it is the
expensive one. A piece that withdraws confidence and lets the King act pays
none of desertion's costs — no capture risk on the way out, no anticipated
standing cost, no affinity damage from the pieces that stayed — and the roster
survives intact.

So the model must price the two against each other:

```
desert    : escapes personal danger, pays witness + affinity cost, army likely loses
withdraw  : pays nothing physical, forfeits the victory it wanted
```

The brake on the cheap option is **glory**, so `w_ambition` and `w_prestige` are
what keep an ambitious piece serving a commander it dislikes. If dismissal ever
dominates desertion across every trait vector, no roster will rout and ADR 0011's
intended cascade quietly disappears — tracked as the *costless mutiny* detector.

## 5. Calibration targets (Milestone 3)

| Metric | Target |
|---|---|
| `tyrannical` leader campaigns ending in a rout | **high — a tyrant whose roster never routs is the bug** |
| `supportive` leader routs | rare |
| Median plies from first desertion to third | small (a rout should feel like a rout) |
| Desertions in a *winning* position | near zero — pieces should not leave when the team is fine |
| Desertions by high-`λ` pieces before low-`λ` pieces | should not happen; the loyal leave last |
| Player-visible cause attributable for every desertion | 100% |

## 6. Degeneracy detectors (extend `docs/testing_strategy.md` §4)

12. **No rout:** `tyrannical` campaigns rout in < 50% of cases — the consequence
    layer is inert.
13. **Instant rout:** the whole roster leaves in the first match under a neutral
    leader — `λ` is mis-scaled.
14. **Suicide desertion:** desertions occur in materially winning positions.
15. **Order violation:** loyalty correlates positively with desertion order
    (the loyal should leave last, if at all).

## 7. Open

- ~~**D32:** whose evaluation supplies `P_loss`?~~ **Closed by ADR 0013:** the
  piece's own. A novice may panic in a drawn position or fail to leave a lost
  one, and both are correct behavior.
- **D33:** Can a deserter be re-recruited in a later match, and at what cost?
- **D34:** Does the player see the desertion calculation, or only the outcome?
  Legibility of *cause* is required (§3); exposing the arithmetic is optional and
  probably belongs to the tactical-blueprint/exec-lab skins only.
