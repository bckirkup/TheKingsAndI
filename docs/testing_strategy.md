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
- Utility value for a fixed `(piece, move, board)` triple.
- Verdict for each rung of the ladder at its boundary values.
- Full 40-ply match event-log fingerprint per scripted leader style.
- Campaign debrief archetype classification for 4 hand-built 10-match campaigns.

## 3. Sensitivity probes (anti-dead-wiring)

One probe per config key, each changing **exactly one** parameter:

| Key | Probe assertion |
|---|---|
| `w_risk` | ×10 → refusal count strictly increases |
| `w_peer` | `0` vs default → protective refusals disappear |
| `κ_fire` | ×10 → post-firing avg trust drop strictly larger |
| `τ_refuse` | more permissive → refusal count strictly decreases |
| `d_max` | 16 vs 4 → match fingerprint differs |
| `classShiftVelocity` | `0` → `C` matrix unchanged after witnessed sacrifice |
| trait weights (each) | vary one → fingerprint differs |

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
