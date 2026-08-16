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
              - P_loss(team | i stays)  · λ_i · S_collective · w_stay
U_desert(i) =            0
              - P_loss(team | i leaves) · λ_i · S_collective · attachment_i
              - standing_i · glory_i · S_standing
              - pain_i · attachment_i · w_exit · shadowFactor

desert  ⟺  U_desert(i) > U_stay(i) + hysteresis_i
```

| Term | Meaning |
|---|---|
| `P_capture(i)` | the piece's own deterministic static-exchange estimate of being taken soon, from its depth-`D_i` view |
| `pain_i` | how much being taken costs it — rises with accumulated `B_i` (ADR 0009) |
| `P_loss(team \| ·)` | probability the army loses, with and without it on the board |
| `λ_i` | **how much this piece cares that the team loses** |
| `S_collective` | team-loss stake, measured in the same pain units as `pain_i` (default `50`) |
| `standing_i` | audience bond at stake: the sum of remaining pieces' non-negative bonds toward `i`, normalized by the standard fifteen-peer roster scale; it falls as the audience leaves and is zero with no peers |
| `glory_i` | `(w_ambition_i + w_prestige_i) / 2`, the piece's stake in reputation |
| `S_standing` | anticipated standing-loss stake in pain units (default `100`) |
| `attachment_i` | residual stake after walking away, strictly in `(0, 1]`; it starts at the ceiling and is eroded by below-neutral alienation, resisted by loyalty |
| `w_stay` | attachment weight on the stay collective stake: `(1000 − k + trunc(k·attachment_i))/1000`, with `k = DESERTION_STAY_ATTACHMENT_PERMILLE` clamped to `0..1000`; `k = 1000` per D145, so `w_stay = attachment_i` |
| `w_exit` | own-future exit permanence weight: `DESERTION_EXIT_PERMANENCE_PERMILLE / 1000`, clamped to `0..1` |

Deserting sets the piece's personal future capture risk to zero after it leaves
raises `P_loss(team)`, but it now charges the piece an own-future exit cost
before the decision. The stay estimate combines the piece's own private board
read, social rumor, and the existing capture-stress term. A pawn may also carry
prospective promotion standing when the configured hope weight is non-zero.
The prospective term is leadership-conditional through an effective ability
credence, because believing that promotion will be earned is a belief about
the commander's competence, not warmth. The effective credence interpolates
from the configured floor to full credence:

```
effectiveCredence =
  floorPermille
  + (1_000 − floorPermille) · τ_abilPermille / 1_000

prospectiveStanding =
  prospectPermille · hopeWeight · effectiveCredence
  / (1_000 · 1_000 · 1_000 · (STANDARD_ROSTER_SIZE − 1))
```

The resulting standing term is then multiplied by the existing glory weight
and standing stake:

```
pLossBoard = 500 - trunc(500·s/(|s| + K))
pLossIfStay = blend(pLossBoard, rumor.pLossTeam) + captureStress
pLossIfLeave = pLossIfStay + pivotalityScale·ownForce/remainingNonKingForce
```

`s` is the absolute post-move private score in centipawns. `K`, the board/rumor
blend weight, and the pivotality scale are explicit calibration knobs. Force
weights are conventional material weights (pawn 1, knight/bishop 3, rook 5,
queen 9); Kings are excluded from the denominator. As the roster empties,
each survivor's share rises, so the final pieces are harder to justify leaving.

The impending-loss shadow is a fourth explicit term. The same attenuation
factor, driven by `P_lossIfStay`, scales both private capture pain and
anticipated standing cost.

Attachment weights **both** branches of the comparison (D145). With the same
factor on each side it cancels from the sign, and so does `λ_i`: what decides
factor on each side it cancels from the collective terms, and so does `λ_i`;
the exit permanence cost is the intentional own-future asymmetry. λ and
attachment still set the magnitude of the margin, and therefore how far a
piece is from quitting, but a piece with no capture risk and no standing to
lose no longer quits over the collective term alone. `DESERTION_STAY_ATTACHMENT_PERMILLE`
remains a knob (`1000` by default, `0` reproduces the pre-D145 one-sided form),
while `DESERTION_EXIT_PERMANENCE_PERMILLE` defaults to `750` and `0` remains the
free-exit control setting. Neither is a damping mechanism, and the cascade stays
undamped.

### 1.1 Discovered check cedes the turn

If the withdrawal cascade exposes the opposing King to an attack while the
deserting side still has the chess turn, the desertion cedes the remainder of
that turn. The exposed side receives the next move and must answer the
discovered check under normal chess rules. This is a cost of desertion, not a
desertion cap or cooldown; the cascade remains undamped. The event log records
the exposure, and the ordinary chess outcome path handles checkmate or
stalemate. The King is never captured by a withdrawal or by evaluation of a
kingless candidate.

## 2. `λ_i` is where trust does its work

```
λ_i = f(T_i, M_i, w_loyalty_i, Σ_j A_{i,j})
```

A piece that trusts its leader, has morale, is loyal by trait, or has friends
still on the board weights the team's defeat heavily and will absorb enormous
personal risk. A distrusting piece discounts the team's fate toward zero and
deserts on a much smaller personal danger.

The residual stake is endogenous rather than global. Attachment starts near its
ceiling and is eroded by alienation:

```
attachment_i =
  1 − (1 − floor) · alienation_i · (1 − w_loyalty_i)

alienation_i =
  mean(
    below_neutral_distrust_i,
    below_neutral_benevolence_i,
    trauma_i,
    mean_negative_affinity_i
  )
```

The existing `DESERTION_RESIDUAL_STAKE` knob is the attachment floor. The
neutral trust midpoint (`T_i = 0`) and neutral benevolence credence
(`tauBenev = 50`) contribute zero alienation. An untouched starting roster
therefore has zero in every alienation component and full attachment, even
before it has formed any bonds. Only trust below neutral, benevolence credence
below neutral, accumulated trauma, and negative affinity erode attachment;
loyalty resists that erosion. The value is quantized to permille and never
reaches zero.

This is the cleanest statement of the game's thesis anywhere in the design: **a
leader's trust budget is literally the coefficient on collective interest.**
The implementation keeps `λ_i` as a dimensionless commitment factor and gives
the team's defeat an explicit pain-scale stake, `S_collective`, so that trust
can outweigh private capture pain rather than being confined to a
probability-sized addend.
Desertion also charges the deserter for the standing it expects to lose in
front of its remaining comrades. This is the sum of each remaining observer's
non-negative affinity-plus-class-prestige bond toward the deserter, normalized
by the standard fifteen-peer roster scale, then weighted by the deserter's
ambition and prestige traits. Unlike a peer average, the audience stake falls
as comrades leave: the first deserter faces the full roster audience, while a
late-cascade piece with only one witness pays only one fifteenth as much. It is
exactly zero when no comrades remain, so it is an anticipated witness cost
rather than a damping floor.

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

- ~~**D32:** whose evaluation supplies `P_loss`?~~ **Closed by ADR 0013 and
  refined by ADR 0045:** the piece's own private score supplies the board read,
  blended with rumor. A novice may panic in a drawn position or fail to leave a
  lost one, and both are correct behavior.
- **D33:** Can a deserter be re-recruited in a later match, and at what cost?
- **D34:** Does the player see the desertion calculation, or only the outcome?
  Legibility of *cause* is required (§3); exposing the arithmetic is optional and
  probably belongs to the tactical-blueprint/exec-lab skins only.
