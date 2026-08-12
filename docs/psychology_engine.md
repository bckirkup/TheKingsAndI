# The Psychology Engine — Mathematical Specification

**Source of record:** [`docs/spec/psychology-engine.reference.ts`](spec/psychology-engine.reference.ts),
supplied by the owner. That file is normative for names, formulas, thresholds,
and default coefficients. This document restates it, adds the invariants an
implementation must hold, and flags the discrepancies and scale problems found
while reconciling it (§10) — those are open decisions, not settled design.

---

## 1. Piece state

| Symbol | Field | Range | Notes |
|---|---|---|---|
| `id` | immutable id | — | survives capture, promotion, benching |
| `role` | current role | `Pawn…King` | mutable via promotion |
| `E_i` | experience | `1..100` | drives search depth |
| `T_i` | trust in leader | `-100..100` | dominates utility — see §10.1 |
| `M_i` | morale & courage | `0..100` | gates mutiny; **no update rule is defined** (§10.4) |
| `B_i` | betrayal / disillusionment | `0..100` | trauma; feeds desertion pain and override paths |
| `A_{i,j}` | dyadic affinity | `-100..100` | per-peer map, asymmetric |
| `C_{i,role}` | class prestige | `-100..100` | **per piece**, keyed by role — each piece carries its own prejudices |
| `η_i` | engagement factor | `0.1..1.0` | `1.0` engaged, `0.2` quiet-quitting, `0.1` deserted |
| `Θ_i` | trait vector | see §2 | immutable |

`C` is *not* a roster-level matrix: a Rook's contempt for Pawns is that Rook's
own attitude and evolves only from what that Rook witnesses.

## 2. Trait vector `Θ_i`

Six weights in `[0,1]`, rolled at creation and immutable:

| Trait | Meaning | Where it enters |
|---|---|---|
| `w_honor` | value placed on heroic achievement and fair leadership | scales `ΔV_board` |
| `w_courage` | resistance to fear of capture | discounts `P_captured` |
| `w_ambition` | desire to engage high-value targets | scales `ΔV_capture` |
| `w_loyalty` | trust vs. self-preservation | scales `T_i` |
| `w_empathy` | sensitivity to peer safety and fair treatment | scales `Φ` and benching penalties |
| `w_prestige` | sensitivity to rank and role status | weights `C` inside `Φ`; also standing/glory in desertion |

## 3. Search depth allocation

```
D_i = max(1, floor( D_min + η_i · (E_i / 100) · (D_max - D_min) ))
D_min = 2,  D_max = 16,  η_i ∈ [0.1, 1.0],  E_i ∈ [1, 100]
```

A veteran (`E=100`) at full engagement sees depth 16; the same veteran while
quiet-quitting (`η=0.2`) sees depth 4; a rookie (`E=1`) sees depth 2.

Quiet quitting is *only* `η_i → 0.2`. It is not a special case anywhere in the
move pipeline.

## 4. Move utility

```
U(P_i, m) =  w_loyalty  · T_i
           + w_honor    · ΔV_board(m)          // engine eval delta, -10..+10
           + w_ambition · ΔV_capture(m)        // captured piece value, K = 0
           - (1 - w_courage) · P_captured(m)   // 0..1
           + Σ_{j ≠ i} Φ(P_i, P_j, m)
```

with the **inter-piece protection term**

```
Φ(P_i, P_j, m) = w_empathy · ((A_{i,j} + C_{i,role(j)}) / 200) · ΔSafety_j(m)
```

`ΔSafety_j ∈ [-1, +1]`; positive = the move makes peer `j` safer. The
relationship coefficient blends *personal* bond and *class* prejudice and lands
in `[-1, +1]`, so:

- endangering a loved or respected peer subtracts utility → protective refusal;
- endangering a despised peer *adds* utility → the piece is pleased.

Note `ΔV_board` is the **piece's own before/after evaluation delta** at depth
`D_i`, not the true engine evaluation: the private score of the position after
the commanded move minus that of the position before it, using the same
piece-specific profile at both positions. Variable insight therefore changes
what a piece is willing to do, while being behind on the board does not by
itself make every order look bad.

## 5. Refusal threshold

```
Θ_refusal(T_i) = -3 + (100 - T_i) · REFUSAL_THRESHOLD_TRUST_SCALE
```

| `T_i` | `Θ_refusal` | Reading |
|---|---|---|
| `+100` | `-3` | a loyal piece tolerates a move it dislikes |
| `0` | `0` | neutral piece refuses anything net-negative |
| `-100` | `+3` | a hostile piece refuses even good moves |

Refusal is available at *every* trust level — a devoted piece will still refuse
a catastrophic order. The threshold now shares the board-value units of
`V_perceived`, while the trust slope remains an explicit configuration
coefficient.

## 6. Verdict state machine

Evaluated strictly in this order:

```
1. U_desert(i) > U_stay(i)        → DESERTION_MUTINY      (η = 0.1, D = 1)
                                    ^ see ADR 0011 / docs/desertion_model.md;
                                      this REPLACES the reference's
                                      `T_i ≤ -75 && M_i == 0` trip-wire
2. U < Θ_refusal(T_i)            → MORAL_REFUSAL         (η = 0.2)
3. U < 0 or T_i ≤ 0              → QUIET_QUITTING        (η = 0.2)
3b. P_capture(i) high in i's own view, credence too low to justify it,
    yet the piece goes    → FATALISTIC_COMPLIANCE (η = 1.0)
                             ^ ADR 0024: Fredericksburg — names pinned to
                               coats. Full effort, no faith, full knowledge.
                               Cost lands on WITNESSES and on i's future
                               willingness, never on the move.
4. T_i > 50 and (P_captured > 0.5 or ΔV_board > 2.0)
                                 → HEROIC_EXECUTION      (η = 1.0)
5. otherwise                     → COMPLIANT_EXECUTION   (η = 1.0)
```

Heroism is **contextual, not a trust band**: it requires a trusted piece *and* a
moment worth being brave about (real personal danger, or a decisive line). A
loyal piece making a quiet developing move is merely `COMPLIANT`.

The King must be exempt from rule 1, or matches end by psychology rather than by
chess. The reference does not encode that exemption; the orchestrator must.

A deserting piece **quits the board** — it is removed from play for the rest of
the match (ADR 0003). Defection to the opposing side is permanently out of
scope. Rule 1 is not a threshold: it is the expected-cost comparison in
`docs/desertion_model.md`, and the resulting cascade is intended (ADR 0011).
The collective-interest term uses `DESERTION_COLLECTIVE_STAKE`, measured in the
same pain units as capture pain; `λ_i` remains the piece's dimensionless
commitment to the army and modulates that stake.

Rules 2–5 are unaffected by trust dominance concerns only to the extent D19 is
resolved; see §10.1.

## 7. Witnessed heroic sacrifice

For each observer that witnessed the event:

```
A_{obs, hero}          += 50   (clamped to ±100)
C_{obs, role(hero)}    += 20   (clamped to ±100)
```

A capture counts as a *sacrifice* only if it removed a threat to a peer or
enabled a forced winning line — attribute via engine evaluation, never via
proximity heuristics, or gratitude becomes nonsense and the narrative loses
credibility.

## 7b. Public authority after justified refusal

An accepted refusal is a public competence signal, not a benevolence signal.
The orchestration layer uses the separate audit stream to classify a refusal as
justified, but true audit values never cross into `psychology/`. The witnesses'
reaction is derived only from the refusing piece's own private view:

```text
o_i = clamp(-deltaV_board_i / 2.5, 0, 1)
loss_i = trunc(o_i · REFUSAL_AUTHORITY_LOSS_SCALE)
```

For a justified refusal, `loss_i` is subtracted from every other active piece's
`tau_abil`. `tau_benev` is unchanged. An unjustified refusal has `loss_i = 0`.
Overrides do not produce this signal because the commander did not accept the
correction. The `2.5` board-value range is structural: observed justified
refusals span `0.01–2.46`, with medians near `0.96–1.93`, so the range preserves
a gradient across ordinary disagreements without introducing another tuning
knob. The default authority-loss scale is 20 credence points.

## 8. Benching / roster reassignment

```
T_benched  += -30                                     (clamped to -100)
∀ active peers j:  T_j += -10 · (1 + w_empathy_j) · S(P_j, P_benched)
```

`S ∈ [0,1]` is a **shared-bond scalar that the reference does not define** — its
provenance is an open decision (§10.5). Terminology matters here: the reference
models *benching to an inactive pool* (−30), which is materially gentler than the
SRS's *firing* (`T := -100`). Whether both exist, and at what cost, is D6/D7 in
`docs/design_decisions.md`.

## 9. Audit metrics

**Single-match leadership index**

```
LI = α·T_final + β·WinScore - γ·UnjustifiedTrauma - δ·QuietQuitTurns
α = 0.4, β = 0.3, γ = 0.2, δ = 0.1
```

**Campaign culture drift vector `K_campaign`**

```
ΔT_longitudinal   = T_final_avg - T_initial_avg
retentionRate     = max(0, (rosterSize - reassigned) / rosterSize)
crossClassShift   = Σ ΔC across class pairs
burnoutIndex      = min(100, quietQuitTurnsTotal · 2.5)
loyaltyStability  = max(0, 100 - burnoutIndex + max(0, ΔT_longitudinal))
```

## 10. Reconciliation findings — open issues

These came out of comparing the reference implementation against the SRS prose.
Each is a decision, not a bug I should silently "fix".

### 10.1 The loyalty term dominates utility by an order of magnitude
> **Update:** the owner's reframing of trust as *the unwillingness to substitute
> judgement* supersedes the arithmetic fixes below. See ADR 0015 and
> `docs/credence_model.md`: trust becomes a mixing weight in `[0,1]`, not a term
> on the same axis as board value, and the scale contest disappears.
The historical `w_loyalty · T_i` term spans `±100`. Under ADR 0015, trust is
instead a dimensionless credence weight, but the refusal threshold retained its
old utility-scale values. The board-value perception is roughly `±3`, while
the old threshold moved `±50`. Net effect:

```
T_i = +80  → old Θ_refusal = -40 (out of board-value scale)
             new Θ_refusal = -2.4 (within perceived range)
T_i = -80  → old Θ_refusal = +40 (out of board-value scale)
             new Θ_refusal = +2.4 (within perceived range)
```

This was a reconciliation defect: ADR 0015 moved trust into credence-weighted
perception, but §5's threshold constant remained in the superseded utility
scale. The resolution is to express the boundary in board-value units:
`Θ_refusal = -3 + (100 - T_i) · REFUSAL_THRESHOLD_TRUST_SCALE`. The new slope
is an explicit coefficient with golden and sensitivity coverage. The same
comparison also requires `ΔV_board` to be an order delta, not an absolute
post-move position score: the private after-position score minus the private
before-position score at the same depth and profile. Otherwise a losing
position makes every order look bad and the refusal boundary remains
state-driven. The orchestration barrier collects both positions before
psychology runs; desertion utility and the authority signal are unchanged.

### 10.2 `w_prestige` — RESOLVED in shipping code
The reference originally left `w_prestige` unread. Shipping `calculateInterPieceProtection`
uses the intended form:

```
Φ = w_empathy · ((A_{i,j} + w_prestige · C_{i,role(j)}) / 200) · ΔSafety_j
```

Sensitivity coverage lives in `tests/psychology.configCoverage.test.ts`
(D20 regression). Standing/glory desertion terms also read ambition+prestige.

### 10.3 `B_i` — DECIDED, but capture wiring is not shipped
`B_i` is initialized and written by the override reducer
(`src/psychology/override.ts:24-28`) and read by desertion pain and the
optional private-evaluation drift
(`src/psychology/desertion.ts:12-16`,
`src/orchestration/privateEvaluation.ts:221-223`). The current capture path
does not write victim-side trauma; the season fold only preserves the final
state of a captured identity (`docs/design_decisions.md:899-905`). ADR 0009
therefore records a decision whose capture mechanism remains **not wired**.
Do not treat this as resolved until the capture and sustained-dread semantics
have an implementing source location.

### 10.4 Morale `M_i` — trip-wire removed, ordinary wiring still incomplete
Under the reference, desertion required `M_i == 0` while nothing ever wrote
morale, making it unreachable. ADR 0011 replaces that gate with an
expected-cost comparison in which morale is one input to `λ_i`, so morale is no
longer load-bearing for reachability. Shipping code writes it for override and
witnessed-desertion effects and reads it in `λ_i`
(`src/psychology/override.ts:28`, `src/psychology/desertion.ts:57-60`,
`src/psychology/desertion.ts:264-273`). General loss, exposure, victory, and
recovery sources remain absent. This is partially wired, not a complete morale
update rule.

### 10.5 `S(P_j, P_benched)` — RESOLVED in shipping code
`sharedBondScalar` implements
`S = max(0, (A_{j,benched} + C_{j,role(benched)}) / 200)` and the benching
penalty consumes it (`src/psychology/witness.ts:56-63`,
`src/psychology/events.ts:56-64`). The former undefined-scalar warning is stale.

### 10.6 `loyaltyStabilityScore` — RESOLVED in shipping code
The implementation clamps the score to `[0,100]` after applying the
longitudinal-trust term (`src/psychology/events.ts:96-103`). The former
range-overflow warning is stale.

### 10.7 `engagementFactor` is stored on `PieceState` *and* recomputed per verdict
Two sources of truth. Recommendation: treat it as derived-only (a function of the
last verdict) and drop it from persisted state, or define exactly when the stored
value is refreshed.

### 10.8 Trust has no outcome feedback — **resolved, see ADR 0007**
Nothing writes match results or player conduct back into `T_i`, so the game's
premise (a strong player losing because the pieces will not follow him) cannot
occur. Resolved in `docs/trust_dynamics.md`: outcomes and conduct do write back,
and there is deliberately **no** decay toward baseline. The ratchet is the
design — recovery is earned through costly signals, not granted by time. The one
invariant is that no absorbing state exists for a player who changes policy.

## 11. Invariants (assert in tests)

1. All state fields clamp to range after every event fold.
2. Psychology never mutates chess state; it only returns verdicts and deltas.
3. Verdict is a pure function of `(state, traits, moveEval, thresholds)` — no
   RNG, no clock, no I/O.
4. Same `(roster, seed, intents)` → identical event log, byte for byte.
5. No LLM output is ever read back into psychology state.
6. `A_{i,j} ≠ A_{j,i}` is permitted and must not be "normalized" away.
7. Every coefficient in `ENGINE_CONFIG` has both a golden test and a
   sensitivity probe.
8. The King is never eligible for `DESERTION_MUTINY`.
9. Trust changes only from player conduct and match outcome — never from elapsed
   time or match count alone (ADR 0007).
10. Desertion is evaluated by expected-cost comparison, never by a state
    threshold, and is never damped by cooldowns or caps (ADR 0011).
11. A commanded move is always the move played — insight never substitutes a
    different move (ADR 0008).
12. Every evaluation a piece uses is its own depth-`D_i` view. The true
    evaluation must never reach a psychology reducer (ADR 0013).
13. The player can always force a move; no position is unplayable (ADR 0014).
14. *Under ADR 0015:* trust never enters as an additive term. It is the
    weight on the leader's judgment — `V_perceived = (1−τ)·V_own + τ·V_leader_implied`
    — so a refusal always requires both a bad-looking move and insufficient
    credence to bridge it (`docs/credence_model.md`).
15. Credence has two channels with different physics: `τ_benev` moves fast and
    cliffs, `τ_abil` accretes slowly. Neglect erodes `τ_benev` only through
    *omissions*, never through elapsed time (ADR 0019, ADR 0007).
16. No piece is ever wrong about *where* a piece stands. Divergence is
    interpretive — depth, egocentric evaluation, attention, memory, and rumor —
    and rumor carries appraisals only, never board facts (ADR 0016).
17. The player never sees the arithmetic. A piece's stated reason is generated
    from its verdict and may be a rationalization, but it must always name a
    cause (ADR 0018).
18. The King is a character, not the player's avatar: `PieceState` stays uniform,
    his attention is unpruned (he appears at the tips of every line) but no
    deeper than `D_king`, and his credence is the player's **mandate** rather
    than an obedience gate. He cannot desert as a matter of arithmetic, not of
    exemption. Losing the mandate is a terminal state in which the roster
    survives, braked only by the glory the pieces forfeit — `w_ambition` and
    `w_prestige` (ADR 0021).
18b. `τ_abil` can substitute for `τ_benev`: a cold, highly able leader keeps
    compliance *while winning*. `τ_benev` is variance insurance — the warm
    leader survives a losing streak, the cold one does not (ADR 0024).
19. Dismissal does not end the campaign. The King takes field command as an
    ordinary `LeaderId` with an empty history — high `τ_benev`, low `τ_abil` by
    the ADR 0019 rates — and the player spectates. The successor is a worse
    tactician with full mandate, so the army plays better under him; whether he
    actually succeeds must be *computed* from the roster's state, never
    guaranteed. `D_king < D_player_effective` strictly — broad and shallow — or
    the coda teaches chess instead of leadership. Reinstatement is a
    start-of-next-match decision; there is no mid-game recall (ADR 0022).

## 11. Two-channel ability evidence (ADR 0044)

Ability credence receives two distinct forms of evidence. After a per-piece
three-ply uninterrupted safe stretch (non-negative private board delta and no
friendly loss), the drip channel applies a small integer gain weighted toward
high capture risk, low `E_i`, and low class prestige. Drip is per piece,
resets on blunders, friendly losses, desertion, and match boundaries, and does
not increment `abilityObservationCount`.
The raw drip gain is satiated by current `tauAbil` using the same
integer-rational curvature discipline as ADR 0043:

```text
g' = trunc(g * (100 + c * (100 - tauAbil)) / (100 * (c + 1)))
```

where `c` is `ABIL_DRIP_CURVATURE`; positive raw gains retain a one-point
minimum after truncation.

Adjudication retains the expectation/oracle audit comparison and the
asymmetric reducer, but only fires for an overridden refusal or a witness
whose utility is within `ABIL_VINDICATION_NEAR_REFUSAL_MARGIN` of its refusal
threshold:

```text
utilityScore <= refusalThreshold + nearRefusalMargin
```

Only adjudication observations increment `abilityObservationCount`.
