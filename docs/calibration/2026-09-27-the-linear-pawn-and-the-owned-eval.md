# The linear pawn and the owned eval — appraisal is already per-piece; the engine owes character, not strength

**Date:** 2026-09-27
**Follows:** `2026-09-26-the-weights-inside-the-repo.md` (the licensing
survey: the `.pnn` question is a weights question, not an engine question;
Arasan is clean, self-training is in-repo, Lozza stays the browser story).
The owner's prompts this session: is a neural net the real requirement, is
re-implementing one in Python the right shape, and — a new concept — whether
the pieces might need *distinct AIs* ("pawns might just be linear thinkers").
**Nothing here changes a default, wires an adapter, or ships anything; there
are no new measurements — every claim is a code citation or a cited prior
result.**

## Owner statements this session (design inputs, not measurements)

- Engine *strength* is not the criterion: "Stockfish, the strongest I tried,
  wasn't really giving me what we wanted." The product should be
  "lightweight, portable, trusted" — not the world's best chess engine, and
  not a cost argument.
- The Caissa objection is operational, not technical: distributing a
  compiled binary to seminar machines means per-platform builds, code
  signing, and AV friction — and no native binary runs in a browser at all.
- Distinct minds per piece is on the table as a first-class concept.

## What the engine actually owes

The evidence record already rules on this: the engine supplies *triggers*;
the psychology supplies the *character*. The 09-21/09-22 notes show collapse
is a leader-policy property the engine merely fires (Stockfish's kind-room
collapse reproduced under Caissa on one seed and not the other — same policy,
different eval run). The 09-20 note shows the fake engine leaves `τ_abil`
dead while Lozza-4 fires degeneracy detectors Stockfish-16 does not. So
"the strongest engine wasn't what we wanted" is consistent with the record:
a stronger ceiling does not buy a different verdict stream, a different
*shape* of evaluation might. What `EnginePort` owes is therefore:

1. determinism (fixed depth, seeded-safe, no wall clock — ADR 0034),
2. depth-addressability (`D_i` per piece — ADR 0005/0013),
3. a MultiPV ladder (the attention/line machinery consumes it),
4. a distribution story the seminar can actually run.

Strength above "plausibly better than the seminar players" is a floor, not
a target — and every real candidate clears it.

## Per-piece minds are already the architecture — the seam is `evalProfile`

The "distinct AI per piece" concept does not need new machinery: each piece
already interrogates the position through its own seat
(`InsightSeat { pieceId, depth, evalProfile }`, `src/engine/types.ts`),
where `depth` is `D_i` derived from `E_i`/`η_i`
(`src/psychology/depth.ts`) and `evalProfile` is a per-piece weight vector
(`evalProfileFor`, `src/orchestration/privateEvaluation.ts:235`). The
profile already carries role identity (`role:<Role>`) and trait-shaped
weights (`weight:ownSafety`, `weight:ownMobility`, `weight:ownClass`,
`weight:kingSafety`), scaled by `w_courage`/`w_honor`/`w_prestige` and bent
by trauma and engagement; `applyPrivateEvaluation`
(`privateEvaluation.ts:292`) then distorts the shared engine score into the
piece's private score. Engines deliberately ignore the profile — it is
transport identity and cache key only (`void evalProfile`,
`src/engine/fake.ts:238`, `src/engine/search.ts:25`; `cache.ts:85` notes
dropping `evalProfile_i` from the key is "the likeliest silent determinism
bug").

ADR 0016 bounds the concept: a piece is never wrong about *where* a piece
stands — divergence is interpretive, never perceptual. So a
"linear-thinking pawn" is a restricted **appraisal**, not a partial board:
the pawn sees the whole board and weighs less of it.

The literal version — N engines for N pieces — therefore collapses into the
shipped design: **one engine, N appraisals**.

## The ladder of per-piece implementations

| level | mechanism | cost | what it can express |
|---|---|---|---|
| 1 | Role-conditioned `evalProfileFor` — restrict or reweight the feature vector per role (a pawn with only `role:P`, structure, and own-safety terms *is* a linear thinker) | psychology-layer data change; deterministic today on fake/Lozza; journal-verifiable | role- and trait-shaped appraisal, already seeded |
| 2 | Per-seat strength dials — Zahak `skills_1..6` nets (a 1270–2074 Elo ladder) or Arasan `UCI_Elo` | adapter + per-seat engine routing; native-binary only, no browser | "a different mind, not a shorter lookahead" (09-26) — mechanically distinct competence |
| 3 | Owned net, role-conditioned by construction — the 09-26 self-train path, with role as an input feature or per-role heads | datagen fleet + GPU training + re-calibration grid; the only level where "weights per piece" is literal | appraisal trained on *this game's* distribution, per role |

Level 1 is the spike to run first: it is cheap, rides the existing
determinism contract, and its effect is measurable in journals (do two
roles refuse on different plies of the same seed). Level 3 is justified only
if level 1 proves inexpressive — and if it ever runs, the role conditioning
is free inside it, since the training distribution is ours.

**On the Python shape:** the net is not the engine. `EnginePort` demands
deterministic depth-limited *search* feeding a scorer; a Python evaluator
would still need a search core, and the browser target rules out a Python
runtime regardless (Pyodide is a heavy detour). If level 3 ever runs, its
shape is: train offline (PyTorch or Caissa's MIT CUDA trainer) → export →
eval inside a small deterministic search core in TypeScript/WASM — one
artifact shared by harness and browser, one `determinismId`.

## Distribution reality

- **Browser:** WASM/JS only, no exceptions — which makes the Lozza-WASM
  worker (ADR 0079 step 1) the correct next engine work regardless of the
  D46 ruling: the browser needs *a* real engine, and Lozza is MIT, already
  vendored and patched.
- **Seminar host (5.8j, LAN):** a native binary can live host-side, which
  mostly dissolves the porting question for the server leg — but the
  facilitator install burden (signing, AV, per-platform builds) still argues
  for keeping the shipping surface small. The player's browser match still
  needs the in-bundle engine; a host-side engine does not replace it while
  matches play client-side.
- **Licensing:** unchanged from 09-26 — code licenses are mostly clean
  (Lozza, Caissa, Zahak, Leorik, Arasan all MIT or equivalent); the *weights*
  are the exposure (Caissa's `.pnn`) or the solved case (Arasan's
  in-repo net).

## Open

- Whether the eval-character-over-strength criterion should amend D46's
  stated terms — an owner ruling, not a measurement.
- Whether role-conditioned appraisal deserves a D-number (a bounded
  `evalProfileFor` extension is a psychology change the register should
  see).
- The Caissa-Nets license reply; the Arasan cold-contract probe.
- Whether a level-1 spike changes refusal/verdict distributions on the
  standard seeds — the cheapest real test that per-piece appraisal matters.

## Suggested next stages

1. **Lozza-WASM engine worker** (ADR 0079 step-1 completion): an
   `EnginePort` adapter running Lozza in a Web Worker behind the existing
   barrier, so the browser match's `engineDeterminismId` is comparable to
   harness runs. Unblocked today, zero license risk.
2. **Level-1 appraisal spike:** a `evalProfileFor` variant that restricts a
   pawn's weights to the linear set; run the standard seeds under fake and
   Lozza-4 and read the journals — does the pawn refuse where the knight
   does not?
3. **Arasan adapter spike** (carried from 09-26): native-spawn adapter by
   the `caissa.ts` pattern, ADR 0067 cold probe, then the
   `{supportive, tyrannical} × {7, 29, 41}` grid.

## Raw artifacts

None — this session ran no harness and cloned no engine. Code claims cite
files at `main` commit `2eb5f33` (post-#229); measurement claims cite the
dated notes under `docs/calibration/` listed above.
