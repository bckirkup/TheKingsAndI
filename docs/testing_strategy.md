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

- refusal rate, quiet-quit ply share, mutiny incidence
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
