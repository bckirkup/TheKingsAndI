# Testing & Balance Strategy

_Planning document. Applies the repo-wide `ci-test-design` skill (golden values
+ configuration sensitivity) to a stochastic, agent-driven game._

---

## 1. Test pyramid

| Layer | Scope | Runtime budget |
|---|---|---|
| Unit (Vitest) | reducers, utility function, verdict ladder, feature extraction | <10 s |
| Golden regression | fixed position + fixed roster + fixed seed → exact event log fingerprint | <30 s |
| Sensitivity probes | one config key changed → fingerprint must differ | <30 s |
| Replay determinism | 100 recorded matches replay byte-identically | <60 s |
| Migration | fixture DBs at each schema version load and upgrade | <10 s |
| Headless sim smoke (CI) | 20 matches × 2 leader styles, assert metric bounds | <3 min |
| Headless calibration (manual/nightly) | 1,000 matches, 20-match campaigns | minutes–hours |

## 2. Golden anchors

Every golden asserts a *quantity*, never "no crash":

```ts
// Deterministic fingerprint over the canonical event log.
const fp = fingerprint(runMatch({ roster: FIXTURE_ROSTER, seed: 42, leader: 'tyrannical' }));
expect(fp).toBe('9f31c2…');                 // exact
expect(metrics.refusals).toBe(7);           // exact count
expect(metrics.finalAvgTrust).toBeCloseTo(-23.4, 1);
```

Required goldens at Milestone 3:

- Threat map for 6 canonical positions (start, Sicilian midgame, back-rank
  mate-in-1, pin, fork, endgame K+P).
- `calculateMoveUtility` for a fixed `(piece, move, board)` triple.
- `calculateEngineSearchDepth`: `(E=100, η=1)→16`, `(E=100, η=0.2)→4`,
  `(E=1, η=1)→2`, `(E=1, η=0.1)→2`.
- `calculateRefusalThreshold`: `T=+100→-50`, `T=0→0`, `T=-100→+50`.
- Verdict at each boundary of the state machine, in evaluation order:
  `T=-75 & M=0` → `DESERTION_MUTINY`; `U` just under/over `Θ_refusal` →
  `MORAL_REFUSAL` / next rung; `T=0` → `QUIET_QUITTING`; `T=51` with
  `P_captured=0.51` → `HEROIC_EXECUTION`; `T=51` with a quiet move →
  `COMPLIANT_EXECUTION`.
- Clamping: affinity and prestige saturate at ±100 after repeated `+50` / `+20`
  sacrifice events.
- Full 40-ply match event-log fingerprint per scripted leader style.
- Campaign debrief archetype classification for 4 hand-built 10-match campaigns.

## 3. Sensitivity probes (anti-dead-wiring)

One probe per config key, each changing **exactly one** parameter:

Keys are the coefficients in `ENGINE_CONFIG` and `PieceTraits`
(`docs/spec/psychology-engine.reference.ts`):

| Key | Probe assertion |
|---|---|
| `w_courage` | `0` vs `1` → refusal count strictly decreases as courage rises |
| `w_empathy` | `0` vs default → protective refusals disappear |
| `w_loyalty` | vary → verdict distribution shifts (and see D19: today it dominates) |
| `w_honor`, `w_ambition` | vary one → fingerprint differs |
| `w_prestige` | vary → **currently no effect** — this probe is the D20 regression test |
| `MAX_SEARCH_DEPTH` | 16 vs 4 → match fingerprint differs |
| `MIN_SEARCH_DEPTH` | 2 vs 6 → rookie-piece depth and fingerprint differ |
| `DEFAULT_CLASS_SHIFT_HEROIC_SACRIFICE` | `0` → `classPrestige` unchanged after a witnessed sacrifice |
| `DEFAULT_AFFINITY_SHIFT_HEROIC_SACRIFICE` | `0` → `dyadicAffinity` unchanged |
| `DEFAULT_BENCHING_SELF_PENALTY` | ×10 → benched piece's trust drop strictly larger |
| `DEFAULT_BENCHING_PEER_BASE_PENALTY` | ×10 → peer trust drop strictly larger |
| `LEADERSHIP_WEIGHTS.{alpha,beta,gamma,delta}` | vary one → leadership index differs |
| `Θ_refusal` slope/intercept | more permissive → refusal count strictly decreases |

Rule: adding a knob without a probe fails review. A parsed-but-unwired knob is
the most likely silent bug in a system this parameter-heavy.

## 4. Balance metrics & acceptance bands

Emitted by `pnpm sim` as CSV/JSON; CI asserts loose bands, calibration tightens
them (initial hypotheses in `docs/development_plan.md` M3):

- refusal rate, **refused-good-move rate**, **override rate**, quiet-quit ply
  share, desertion incidence and cascade length
- divergence between each piece's evaluation and the true one (the "he was
  wrong" vs. "he was disloyal" split)
- trust trajectory (mean, variance, per-class)
- class-bias drift (contempt → solidarity)
- roster turnover and its win-rate cost
- win rate vs. plain-chess control at matched engine strength
- archetype classification distribution across leader styles

**Degeneracy detectors** — CI should fail if any of these appear, because each
means the model has collapsed:

1. Mutiny rate ≈ 0 for the tyrannical leader (no consequences).
2. Mutiny rate > 80% for the supportive leader (noise dominates).
3. Refusal rate ≈ 0 or ≈ 1 across all styles (thresholds mis-scaled).
4. Trust monotonic for every piece regardless of play (dead wiring).
5. Class-bias variance ≈ 0 after 20 matches (relationship layer inert).
6. Supportive leader win rate ≥ plain chess (no tension between morale and
   tactics → the game has no dilemma).
7. Verdict is predictable from `T_i` alone (i.e. a classifier on trust reproduces
   >95% of verdicts) → the move terms are inert; this is the D19 detector.
8. **Absorbing state:** >5% of campaigns reach a state from which even the oracle
   `redeemer` policy cannot raise mean trust. (Note: campaign *collapse* is not a
   failure — collapse that survives a changed policy is. See ADR 0007.)
9. **Toothless spiral:** losing has no measurable effect on next-match trust.
10. **Skill nullification:** corr(player strength, campaign win rate) ≈ 0.
11. **Free redemption:** `redeemer` recovers as fast as it fell, or recovers
    without paying board cost.
12. **No rout:** `tyrannical` campaigns end in a desertion cascade in < 50% of
    cases — the consequence layer is inert (ADR 0011).
13. **Instant rout:** the whole roster leaves in the first match under a neutral
    leader — `λ` is mis-scaled.
14. **Suicide desertion:** desertions occur in materially winning positions.
15. **Order violation:** loyalty correlates *positively* with desertion order —
    the loyal must leave last, if at all.
16. **Toothless refusal:** the refused-good-move rate is ≈ 0. Under ADR 0002
    (free re-plan) and ADR 0008 (advice-only), denying the player good moves is
    the psychology's only mid-match lever; if pieces only ever refuse bad moves,
    distrust costs nothing — and it means the model collapsed back to
    omniscience despite ADR 0013.
17. **Omniscience leak:** a piece's decisions correlate with the `D_max`
    evaluation beyond what its own `D_i` view explains. Enforce structurally too
    — the true score must not be reachable from `psychology/` (ADR 0013).
18. **Credence inertness** (ADR 0015): tactical strength of
    the leader correlates with win rate *equally* at high and low mean `τ`. The
    whole claim of the model is that an untrusted commander's skill cannot reach
    the board; if it reaches anyway, `τ` is decorative. The paired check: a
    novice piece's effective play strength must differ materially between high
    and low `τ`, since faith is worth most where verification is weakest.
19. **Rumor inertness or runaway** (ADR 0016): mean absolute divergence between
    a piece's `P_loss` estimate and the roster mean either never moves (gossip
    does nothing) or collapses to zero within a ply (the roster is one mind).
    Panic must be able to outrun the position without becoming instantaneous.
20. **Perception-only divergence is too weak** (D45): dispersion of `V_own`
    across pieces evaluating identical positions, paired with the
    refused-good-move rate. This is the explicit trigger for reconsidering
    partial observability — the one detector whose failure justifies an
    expensive architectural branch rather than a re-tune.
21. **Attention is decorative** (ADR 0016): refusal rates are unchanged when
    lines the piece does not appear in are prioritized normally. If attention
    does not produce refusals of moves that are good for reasons the piece never
    examined, the belief model is a costless ornament.
22. **Illegible testimony** (ADR 0018): a trust loss the player cannot attribute
    to any action of theirs from the piece's own stated reason. Rationalization
    is permitted; an unattributable cause is the top refund risk in
    `docs/trust_dynamics.md`.
23. **Witness verdicts do not split** (ADR 0018): every desertion is read the
    same way by the whole roster. If "he was brave" and "he ran" never both
    occur for the same departure, witnesses are not using their own views.
24. **Trust farming** (ADR 0019): mean `τ_benev` rises under a policy that
    issues deliberately bad orders and warmly withdraws them. Being heard must
    only count when the withdrawal surrendered real value on the true-evaluation
    audit path — backing off a bad move is theater and must register as nothing.
25. **Channel collapse** (ADR 0019): `τ_benev` and `τ_abil` correlate above
    ~0.9 across a campaign, or the audit cannot tell a player which one he is
    failing. Two channels that always move together are one channel with extra
    bookkeeping, and the design's best lesson is gone.
26. **Override degeneracy:** either `tyrannical` and `supportive` policies
    override at indistinguishable rates (the price is not felt), or overriding
    is never worth it under any policy (a trap button). Both mean D35 is
    mis-tuned (ADR 0014).

25. **Royal oracle.** `V_own_king` correlates with the true `D_max` evaluation
    above ~0.85, or players learn to read the King's testimony as tactical
    advice. His attention is global in *breadth* and still bounded in *depth*
    (ADR 0021); if breadth becomes truth he is an omniscience leak and a hint
    system (ADR 0013).
26. **Inert mandate.** The King's credence never moves, or moving it changes
    nothing measurable in roster behavior — the mandate must propagate through
    rumor and visibly weaken orders, or ADR 0021 bought a scalar nobody feels.

27. **Costless mutiny.** Dismissal rate is insensitive to `w_ambition` and
    `w_prestige`, or withdrawing confidence dominates desertion for every trait
    vector. Dismissal is the ending where nobody dies, so glory forfeited is the
    only brake on it (ADR 0021 §6.2); without a live brake no roster ever routs.
28. **Dismissal preempts nothing.** Under a tyrannical leader the King must
    relieve the player *before* the rout in most seeds — the mandate is the
    early-warning channel (ADR 0021 §6.4). If routs consistently arrive first,
    the King's breadth is not doing its job or his patience is mis-tuned.

29. **Scripted humiliation.** Successor performance after dismissal is
    insensitive to roster state, or the successor outperforms the player across
    substantially all seeds. Both mean the epilogue is an authored lesson rather
    than a simulated consequence (ADR 0022 §6) — a player who genuinely broke
    his roster must watch the successor fail too.
30. **Cheap recall.** Recall fires so often that dismissal carries no weight, or
    never fires at all, leaving ADR 0022 §7 as dead content. A recall occurring
    *within* a match is a hard failure, not a tuning issue — reinstatement is a
    start-of-next-match decision only.
31. **Tutorial coda.** The successor's move quality is at or above the player's.
    `D_king < D_player_effective` must hold strictly (ADR 0022 §4); if watching
    the King teaches tactics rather than leadership, the lesson is inverted.
32. **Columns collapse.** Board quality and execution fidelity correlate
    strongly in the debrief. They must move independently, or the central
    finding — *worse orders, better outcomes* — cannot be shown (ADR 0022 §5).

33. **Roster laundering.** A leader policy that burns and replaces pieces
    reaches a mean credence comparable to one that maintains a roster. Then
    reputation transfer (ADR 0023 §2) is too weak and the bench is an escape
    hatch from the entire subject of the game.
34. **Act one is the whole game.** Acts two and three do not measurably differ
    in starting credence or difficulty — the reputation carried between kings is
    decorative (ADR 0023 §2).
35. **Pack coverage.** Any situation key reachable by the simulation with no line
    in a shipped content pack, or an implicit rather than declared fallback
    (ADR 0023 §4).

36. **The saint's monopoly.** No cold, high-ability leader policy can reach a
    winning career. Then D60 has failed and the game is moralizing — the harness
    needs a `cold_winner` oracle alongside `pure_tactician` and `redeemer`.
37. **Invulnerable cold streak.** A cold winner survives a sustained losing run
    as well as a warm leader does. Then `τ_benev` is not acting as variance
    insurance and the channels have collapsed in practice, however their
    correlation looks (ADR 0024 §1).
38. **No McClellan.** Dismissal never occurs while roster mandate is high — the
    King's results channel is inert (ADR 0024 §3).
39. **Fatalism invisible.** `FATALISTIC_COMPLIANCE` never fires, or firing it
    changes nothing in witness state and future willingness. Its entire cost is
    borne outside the move; if that cost is unmeasurable the verdict is
    decorative (ADR 0024 §2).

40. **Inert opposition.** Enemy morale never affects the outcome, or no policy
    can win by cohesion attack alone against a stronger tactician (ADR 0025 §2).
41. **Telepathy.** Any enemy psychological state reaching the player except
    through observable behaviour — no gauges, no cross-side audit, no testimony
    from the other army.
42. **Difficulty by depth.** Harness difficulty that scales by raising engine
    depth rather than by improving the opposing leader policy (ADR 0025 §3).
43. **Asymmetry leak.** Any psychology feature that only works when the player
    is the leader being modelled. Symmetry is a standing requirement (D5).

## 5. Stochastic-system rules

- All randomness flows through one seeded PRNG passed explicitly; `Math.random`
  is lint-banned outside the PRNG module.
- Stockfish runs depth-limited only (no `movetime`), pinned version, fixed hash.
- Where behavior is inherently distributional, assert on N-trial statistics with
  a fixed seed sequence, and record N and the seeds in the test.

## 6. What we deliberately do NOT test

- LLM prose content (non-deterministic). We test the *contract*: schema
  validation, sanitization of user-supplied piece names, timeout, and silent
  fallback to templates. A snapshot suite over a recorded-response cassette is
  the only prose-level testing worth doing.
- Visual pixel diffs across four themes (high maintenance, low value at MVP).
  Test the token provider and accessibility encodings instead.
