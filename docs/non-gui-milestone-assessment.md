# Remaining non-GUI milestone work

Verified against `main` @ `6b34215` (PR #51 merged), with §1.5 amended for PR #52. Supersedes the
assessment written against `33e4735`; every item from that pass was re-checked for *reachability* —
whether a live path actually calls it — rather than trusting plan checkboxes, exports, or the existence
of tests.

Excluded: React components, screens, styling, layout, animation. Included: anything a GUI merely
displays where the underlying model, fold, or data is itself missing.

Landed since the last pass: ADR 0035 (three-channel credence, D49), ADR 0036 (separate engine audit
stream, D50), ADR 0037 + implementation (private evaluation profiles), ADR 0038 (justified refusal
authority), desertion-conformance fixes, and the collective/standing desertion stake. `pnpm lint` and
`pnpm typecheck` pass on main.

---

## 0. What changed since `33e4735`

| Old item | Now |
|---|---|
| 1.1 empty `evalProfileFor` | **Resolved in live code** — profiles are real and applied on both match paths |
| 1.2 supportive collapse | **Changed shape** — the committed collapse numbers are now stale; a smoke shows near-universal *refusal* instead |
| 2.5 passports unsigned | **Partially** — digest-protected, still unsigned and unwired |
| 2.6 stale status text | **Partially** — some plan text corrected, nightly workflow and CI dialogue claim still stale |
| 3.4 content packs | **Partially** — dialogue is now versioned data with a coverage validator; the generic pack model is not |
| D49 / D50 | **Decided, not implemented** — ADRs 0035/0036 accepted; live state, persistence and recruitment are unchanged |

Everything else below is unchanged from the previous pass.

---

## 1. Blocking the calibration work, in priority order

### 1.1 Private per-piece scoring — RESOLVED
`evalProfileFor()` now builds a quantized, non-empty profile from role, traits, trauma, engagement,
geometry and attention (`src/orchestration/privateEvaluation.ts:212-270`), with attention pruning and
line salience at `:202-210` and bounded private distortion applied at `:273-345`.

It is reachable from the live insight path, not tests only: profiles are built and attached to per-piece
requests (`src/orchestration/insight.ts:193-253`), resolved through the deterministic barrier
(`:255-285`), and applied to the shared insights (`:294-335`), with private per-piece board deltas
feeding desertion (`:360-396`). Both entry points use it — `MatchSession.submitPlayerIntent()`
(`src/orchestration/matchSession.ts:218-255`) and `runHeadlessMatch()`
(`src/orchestration/headlessMatch.ts:144-183`).

Note the shape differs from what the previous audit assumed: the broker deliberately leaves the shared
score untouched (`src/engine/broker.ts:44-53`, `:99-102`) and all distortion is orchestration-owned. The
profile-aware broker API remains only as transport (`:169-183`).

**The consequence for calibration is the mirror of last time:** divergence is now live, so the coefficient
work is unblocked — *and* every number in the committed calibration report predates it.

### 1.2 Supportive-leader behaviour is now unmeasured, not merely bad
The committed report still records supportive desertion 100% / rout 100%
(`docs/calibration/milestone-3-engine-wired.md:200-210`), but nothing in tree re-measures supportive
behaviour after private evaluation and the desertion changes in #49/#50/#51.

A single 20-match fake-engine smoke (`pnpm sim --matches=20 --leader=supportive --engine=fake`) reports a
very different regime: desertion 0%, rout 0%, refusal **99.6%**, refused-good-move 90.0%, win score 50.0,
with the `trust-monotonic` and `no-dilemma` detectors firing. That is one short fake-engine campaign, not
calibration — treat it as a signal, not a result. The signal is that the failure mode may have moved from
collapse to near-universal refusal, which the existing detectors do flag (`sim/degeneracy.ts:261-280`,
`:304`).

**Action:** a broad supportive/tyrannical campaign has to be re-run before anything is concluded about
either regime. The old collapse finding should not be carried forward as current.

### 1.3 No coefficient set has been selected — STILL TRUE
`ENGINE_CONFIG` still holds the original defaults (`src/psychology/config.ts:5-85`), and the report still
records that nothing shipped as a new default (`docs/calibration/milestone-3-engine-wired.md:218-220`).
PR #49 states explicitly that no coefficients or desertion utility terms changed; #50 and #51 add
mechanics and tests, not a calibration campaign.

New knobs have arrived since the last pass and are unswept: `REFUSAL_AUTHORITY_LOSS_SCALE`,
`REFUSAL_THRESHOLD_TRUST_SCALE`, `DESERTION_COLLECTIVE_STAKE`, `DESERTION_STANDING_STAKE`,
`DECLINED_SACRIFICE_MIN_INCOMING_AFFINITY`, `PRIVATE_EVAL_DISTORTION_BOUND_CP`,
`PRIVATE_EVAL_TRAUMA_DRIFT`. Milestone 3.4/3.5 remain open, and are now larger than they were.

### 1.4 The calibration report has no plots — STILL TRUE
The plan requires "the plots that justified it" (`docs/development_plan.md:119`). The report has tables
and measurements only; no plot artifacts exist under `docs/calibration/`.

### 1.5 Detector suite is narrower than the ADRs require — PARTIALLY CLOSED
Live before #52: tyrannical no-rout and supportive-rout, refusal / refused-good-move / override, trust
monotonicity, supportive no-dilemma, early saturation (`sim/degeneracy.ts:248-317`).

Added by PR #52: `metric-collinearity` (`:126`), `unmeasurable-learning` (`:171`) and a **weak**
`flattering-counterfactual` (`:197`), plus a `trait-leakage` scanner over shipped dialogue/audit/
certificate strings (`src/narrative/traitLeakage.ts`, `pnpm trait-leakage:check`).

The counterfactual detector is a seed-matched *forward* comparison against supplied oracle campaigns, not
ADR 0030's replay of the player's own positions — it does not close that requirement, which stays blocked
on 2.1 and 3.1. `metric-collinearity` fires on both the tyrannical and supportive 20-match fake-engine
smokes, so the transcript metric set currently carries duplicated signal.

Still absent: dominating-strategy, commendation-leakage, unwinnable-award — all three need commendations
(3.3) to exist first (`docs/testing_strategy.md:282-297`, `docs/adr/0030-the-transcript.md:89-100`,
`docs/adr/0031-commendations.md:71-80`).

### 1.6 Scarcity calibration is unavailable — STILL TRUE
5.8n (pool size × curriculum length) needs a world model that does not exist. Persistence is still
single-player (`src/persistence/db.ts:12-31`, `src/persistence/types.ts:40-85`); the requirement stands at
`docs/development_plan.md:153-158`, `:183-190`.

### 1.7 NEW — the private-evaluation knobs ship without the required coverage
`PRIVATE_EVAL_TRAUMA_DRIFT` and `PRIVATE_EVAL_DISTORTION_BOUND_CP` are live
(`src/psychology/config.ts:5-85`, consumed at `src/orchestration/privateEvaluation.ts:212-345`) but no
golden-plus-sensitivity pair was found for the trauma-drift branch. AGENTS.md rule 6 makes that a review
failure, so it belongs on the list rather than in the calibration backlog.

---

## 2. Claims in the repo that outrun the code

### 2.1 Replay determinism is not verified end-to-end — STILL TRUE
`replayMatch()` / `replayDigest()` (`src/psychology/replay.ts:116-141`) are deterministic and tested, but
**no production code constructs a `ReplayManifest`.** `recordMatch()` builds a `MatchRecord`
(`src/persistence/repository.ts:186-220`) with no manifest or intents field
(`src/persistence/types.ts:100-114`), and the app persists exactly that (`src/app/App.tsx:107-126`).
Reachability: **tests only**. M2.6 remains a proven psychology fold, not proven live-match replay.

### 2.2 The certificate is digest-verified, not replay-verified — STILL TRUE
Generation is live (`src/persistence/repository.ts:292-317`, `src/persistence/certificate.ts:14-43`), but
`verifyCertificateDigest()` still checks a content digest only (`:46-54`). No import/verify CLI, no replay
of the attached seed and event log, no comparison of replayed events. With 2.1, the certificate proves the
bundle wasn't edited — not that the play happened as recorded.

### 2.3 The live app still plays on the fake engine — STILL TRUE
`createFakeEnginePort('ui-fake/depth-fixed')` — `src/app/MatchScreen.tsx:3`, `:37-45`. The headless path
can inject a real engine; the interactive path was still not switched. This now matters more than it did:
private evaluation is live, so the interactive experience is the one place the divergence model runs
against a fake engine's leaves.

### 2.4 Reputation transfer is a self-labelled stub — STILL TRUE, now also off-architecture
`applyReputationTransfer()` still averages scalar credence (`src/orchestration/campaignPolicy.ts:54-70`,
averaging at `:62-67`) on the **live recruitment path**. Credence is still two-channel scalar
(`src/psychology/types.ts:31-35`, `:45-58`) and identity records still carry no commander history
(`src/persistence/types.ts:40-48`). ADR 0035 is now accepted, so this is no longer "incompatible with what
D49 recommends" — it is incompatible with a decided architecture.

### 2.5 Passports are export/import shapes with no flow and no signatures — PARTIALLY CLOSED
Export now carries a `contentDigest` and import verifies digest and version
(`src/persistence/passport.ts:10-35`). Still missing: key identity, signature, trust model, and any live
import/export flow. The plan's requirement is "signed export/import"
(`docs/development_plan.md:159`); accurate description today is *digest-protected but unsigned and
unwired*. Reachability: **tests only**.

### 2.6 Stale status text — PARTIALLY CLOSED
Still stale:
- `docs/development_plan.md:56-61` still lists shared-search/private-scoring broker work as outstanding M1 work; it exists.
- `docs/development_plan.md:79-90` still describes the older scalar/two-channel psychology and replay deliverables.
- `docs/development_plan.md:169-173` calls the single-player spine implemented; 2.1, 2.2, 2.3, 2.4 are partial.
- `.github/workflows/nightly.yml:12-15`, `:118-124` still repeat ">251 s per match", which `docs/calibration/milestone-3-engine-wired.md:190-193` explicitly withdraws.
- CI still runs lint/typecheck/coverage/fake smoke with no `pnpm dialogue:check` (`.github/workflows/ci.yml:40-60`), so the M6.3 "in CI" claim is still wrong.

Corrected since last pass: `docs/development_plan.md:187-190` now records keyed credence as resolved by
ADR 0035 while flagging that identity/passport implementation remains.

Newly misleading: `AGENTS.md:7-12` and `:71-77` report D49/D50 as resolved. True at the decision level,
but a reader will take it as implemented — see §4.

---

## 3. Absent entirely

### 3.1 Counterfactual reruns (5.8p / ADR 0030) — STILL TRUE
`sim/leaders.ts:154-200` is forward simulation with different policies, which answers "how would a
tactician's campaign have gone", not "what would a tactician have done *here*". PR #52's
`flattering-counterfactual` detector consumes exactly that forward comparison and is labelled as the weak
form for the same reason. `cold_winner` and `rebuilder` still do not exist; `redeemer` is not the same
policy. Blocked by a replayable recorded position/intent representation (2.1) and, independently, by D50
implementation.

### 3.2 Cohort / world model (5.8g, 5.8j, 5.8k, 5.8h, 5.8e, 5.8d) — STILL TRUE
No participant identity, world/cohort table, shared roster pool, shared trauma pool, circulation or
facilitator records, or cohort fold. Dexie remains single-player local
(`src/persistence/db.ts:12-31`, `src/persistence/types.ts:40-114`); the intended entities are described in
`docs/data_model.md:168-228` and deferred at `docs/development_plan.md:175-190`. This is the seminar
product; everything facilitator-facing sits behind it.

### 3.3 Commendations (5.8r / ADR 0031) — STILL TRUE
Eight player awards and the facilitator set: **nowhere** in `src/`, `sim/`, or persistence
(`docs/development_plan.md:149-150`, `docs/adr/0031-commendations.md:24-80`). The transcript already
computes the raw ingredients, so the player set is a fold over existing data; the facilitator set needs
3.2 first. Worth reconsidering the "deferred" label given the stated goal of insights and rewards over a
trophy.

### 3.4 Content packs as data (7.1) — PARTIALLY CLOSED
Dialogue is now committed, versioned, situation-keyed data with a coverage validator
(`src/narrative/dialoguePack.json:1-20`, `src/narrative/authoredProvider.ts:1-5`,
`src/narrative/coverage.ts:29-49`). The generic `{themeTokens, nounMap, dialogue, epilogues}` pack model
and loader still do not exist (`docs/development_plan.md:202-209`).

### 3.5 Onboarding manuals (7.2), facilitator CSV/PDF export (7.4), all of M8 — STILL TRUE
Absent (`docs/development_plan.md:206-218`). M8 additionally gated on the Stockfish GPL question in
`LICENSING.md`.

---

## 4. Decisions closed on paper, open in code

**D49 — credence keyed by leader.** ADR 0035 accepted (`docs/adr/0035-three-channel-credence.md:3-8`),
specifying identity-seeded disposition, leader-keyed relationship accounts, and global damage (`:27-42`);
the ADR itself scopes the implementation as remaining (`:79-99`). Live code is unchanged: scalar
two-channel credence (`src/psychology/types.ts:31-58`), minimal identity records
(`src/persistence/types.ts:40-48`), scalar reputation averaging
(`src/orchestration/campaignPolicy.ts:54-70`). Closing it still touches storage, never-served-before
behaviour, save migration, reputation transfer, and passports.

**D50 — persistence of true evaluation.** ADR 0036 accepted
(`docs/adr/0036-separate-engine-audit-stream.md:1-8`), requiring true evaluations outside the psychology
event log (`:37-83`). Live code still computes them ephemerally
(`src/orchestration/insight.ts:446-493`, `src/engine/broker.ts:24-30`), with no audit table or field
(`src/persistence/db.ts:12-31`, `src/persistence/types.ts:100-114`). It continues to gate 2.2 and 3.1 —
and now also means the audit score behind justified refusal (ADR 0038) leaves no record.

ADR 0038 itself is live on both paths (`src/orchestration/headlessMatch.ts:180-190`,
`src/orchestration/matchSession.ts:331-358`, `src/orchestration/psychologyHooks.ts:156-176`,
`src/psychology/config.ts:41-44`) with knob coverage at `tests/psychology.invariants.test.ts:84-125`.

---

## 5. Suggested sequence

1. **Re-measure before tuning.** A broad supportive/tyrannical campaign under the private-evaluation
   model, replacing the numbers in `milestone-3-engine-wired.md`. The refusal-dominated smoke in 1.2 is
   the first thing to confirm or refute. (1.2)
2. **Switch the app to a real engine** (2.3) — cheap, and it is now the only path still running divergence
   against fake leaves.
3. **Re-derive coefficients**, including the seven knobs added since the last calibration, and close 1.7's
   missing golden/sensitivity pair while sweeping. (1.3, 1.4, 1.7)
4. **Emit a `ReplayManifest` from the live and headless paths** (2.1) — still cheap, still unblocks 2.2
   and 3.1.
5. **Implement D50's audit stream**, then close the certificate to replay verification (2.2).
6. **Implement D49's three channels** — the largest remaining refactor, and the thing 2.4, passports, and
   recruitment are all waiting on.
7. **Counterfactual reruns** (3.1) on top of 4 and 5.
8. **Cohort/world model** (3.2), then facilitator audit and peer norming.
9. **Commendations** (3.3): player set can precede 8; facilitator set cannot.
10. Content packs, manuals, exports, M8.
