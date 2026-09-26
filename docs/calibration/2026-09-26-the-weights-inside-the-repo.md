# The Weights Inside the Repo — the .pnn problem has more exits than it looked like

**Date:** 2026-09-26
**Follows:** `2026-09-21-the-permissive-engine-survey.md` (PR #220), which left
one open legal item — Caissa's engine is MIT but its `.pnn` ships from
`Witek902/Caissa-Nets`, a repository with no license file — and
`2026-09-22-caissa-sixteen-and-the-half-concordant-collapse.md` (PR #222).
The owner's question this session: can the engine ship with self-generated
weights instead, or is there a better engine entirely, given how many new
engines exist. **Nothing here changes a default, wires an adapter, or ships
anything.**

## Settled inputs (not re-derived)

- `docs/engine_licensing.md` and ADR 0020: the permissive engine is needed only
  for the **enterprise** build; the open web build and a paid GPL-compliant
  Steam build keep Stockfish. Engine *strength* barely moves the model;
  *consistency* is the requirement.
- The harness contract from the survey: UCI over a spawned process, MultiPV 8
  at `D_max = 16`, `ucinewgame` before every search (ADR 0067), fail — never
  truncate — on the info-line ceiling (ADR 0068).
- Engine identity measurably moves outcomes: seed 29 collapses under both
  Stockfish-16 and Caissa-16; seed 41 does not collapse under Caissa. Any
  engine change is a re-baseline, and `determinismId` is what keeps that
  honest.

## Measured today (2026-09-26, all repositories re-cloned at HEAD)

### The license question turns out to be a repo-layout question

The survey's flag applied only to Caissa, because Caissa uniquely splits its
net into a second repository. Re-checking where each candidate's weights
actually live:

| engine | code license | where the net lives | net covered by repo license | MultiPV | strength evidence | notes |
|---|---|---|---|---|---|---|
| Caissa 2.0.1 (`58ee6dc`, 2026-09-20) | MIT | **separate repo** `Caissa-Nets` (`0605c98`, 2026-09-19) — re-verified today: 9 files, a one-line README and 8 `.pnn` nets, no LICENSE/COPYING/NOTICE | **no** | runtime-verified (survey) | README CCRL 40/15 3628 | see "retraining" below — the pipeline is in-repo |
| **Arasan** (`e3e6f43`, 2026-09-23) | permissive (MIT-equivalent text) | `network/arasanv8-20260906.nnue` **committed in-repo**; LICENSE text explicitly enumerates the `network` directory among covered contents | **yes, explicitly** | **runtime-verified today** (see below) | ~3400-class; active — net is dated 2026-09-06 | net loads as an external file via `NNUE file` option, not embedded |
| **Zahak** (`72ff806`, 2022-04-01) | MIT | `default.nn` + `skills/skills_1..6.nn` committed in-repo | yes | runtime-verified (survey) | CCRL Blitz ~2833 | dormant since 2022; skills nets are a **1270–2074 Elo ladder of six weaker trained nets**; `training.md` documents the whole recipe |
| **Leorik** (`7c936b1`, 2026-05-15) | MIT | `Leorik.Core/640HL-S-*.nnue` + six older nets under `Resources/`, committed in-repo | yes | source + v3.2 release notes; not run here (needs .NET 10 SDK) | README: CCRL Blitz **3496**, 40/15 **3400** | C#/.NET 10; also plays Chess960; nets trained on self-play with `bullet` |
| akimbo (`f7dd767`, 2025-02-07) | MIT | `resources/net.bin` committed in-repo | yes | **absent** in source | README ~3000 | contract-ineligible today |
| Lozza | MIT | none — handcrafted eval, no net exists | n/a | runtime-verified | ~2400-class | the only browser-native permissive engine; vendored + patched in `vendor/lozza/` |
| Stockfish | GPL-3.0 | in-repo, GPL | GPL | runtime-verified | strongest | open build + GPL-compliant Steam only |

Arasan MultiPV was exercised this session (avx2 build of `e3e6f43`, Fathom
submodule fetched): `setoption name MultiPV value 8` followed by `go depth 5`
emitted the full ladder — `info multipv 1..N depth D score cp X … pv …` lines,
one per PV per depth. Caveat recorded: the `multipv` token precedes `depth` in
Arasan's lines; the project's parser indexes tokens by name (`uci.ts`), so
ordering is not a problem. Arasan's MultiPV caps at 10 (≥8 required). It also
ships `UCI_LimitStrength` / `UCI_Elo` 1000–3450 — a built-in strength dial.

Also measured: `bullet` (`jw1912/bullet`, `23a8fdd`, MIT) — the shared NNUE
trainer of the permissive-engine scene (Leorik, akimbo, Viridithas and others
train with it). The training commons is permissive even where most engines
aren't.

### Retraining Caissa is feasible with in-repo MIT tools alone

The Caissa repository is not "engine minus net". Under the same MIT LICENSE it
ships the complete pipeline:

- `utils selfplay` — self-play datagen (packed binary games, random/opening-book
  starts, draw/win adjudication knobs, thread count);
- `utils prepareTrainingData` / `pgnToTrainingData` /
  `plainTextToTrainingData` — position packing;
- `utils trainCudaNetwork` — a from-scratch CUDA trainer (README documents it;
  `src/utils/CudaNetworkTrainer.cpp`, kernels under `src/utils/cudaTrainer/`);
  it writes the net itself via `PackedNeuralNetwork::SaveToFile` — a `.pnn`
  (`CudaNetworkTrainer.cpp:1258,1271`);
- `utils permuteNet`; the Makefile downloads and embeds a `.pnn` at build —
  any self-produced `.pnn` drops into the same path.

So "Caissa search + self-owned weights" needs no code outside the MIT repo —
only compute:

- **Datagen:** self-play at shallow fixed depth. Scale references from the
  upstreams' own numbers: Zahak reached ~2800 on **58M** positions; Leorik 3.0
  reached superhuman on **622M**; Caissa used 20.5B. This project needs
  `D_max = 16` consistency, not 3600 — the plausible band is 10^8–10^9
  positions, which is a CPU-fleet job of the same shape as the existing AWS
  Batch campaigns, not a research programme.
- **Training:** the trainer is CUDA-only (no CPU trainer in-repo): one GPU job
  per net generation.
- **Bootstrap nuance:** self-play labels are produced by whichever net the
  datagen build embeds. Running the shipped `.pnn` for datagen is ordinary
  use — MIT restricts *distribution*, not use, and the license problem with
  `Caissa-Nets` is about redistribution. If even the training lineage must be
  clean, labels can come from an in-repo-licensed net (Arasan or Zahak): the
  intermediate formats are plain PGN/FEN and engine-agnostic.

### What self-training buys beyond the license

A net trained on *this game's* positions. The harness plays games no human
plays — mass-refusal pawn storms, deserted ranks, mid-game king walks. Every
net above was trained on human or engine self-play distributions. Whether a
harness-distribution net changes the `τ_abil` channel's verdicts is measurable
on the project's own seeds — the same experiment the seed-41 divergence already
ran in miniature.

### The mood leg

- The pieces' defects do not live in the engine. Per ADR 0013/0017 the engine
  supplies an objective candidate ladder; parochial self-interest is produced
  downstream by private-evaluation distortion, attention, and the verdict
  ladder. Choosing a weak engine for "character" is the wrong lever; the
  engine owes determinism, the MultiPV ladder, and a floor above the seminar
  players — "the best pieces outplay the human" is a floor, not a ceiling, and
  every NNUE candidate clears it at production depth. Whether Lozza's low
  caps do is a harness question — Lozza-4 fires degeneracy detectors
  Stockfish-16 does not (the 09-20 note), which may be evidence *for* needing
  a stronger floor, not just permission to stay weak.
- Two candidates carry a second competence knob, more honest than depth-capping
  a 3600 search: Zahak's `skills_1..6` nets (1270–2074 Elo — a different *mind*,
  not a shorter lookahead) and Arasan's `UCI_Elo` (1000–3450). Either would let
  a tired second-rank pawn and the queen's seasoned knight differ mechanically
  in a way `D_i` alone cannot express.
- Browser deployment still belongs to Lozza: every NNUE candidate is a native
  binary today; Go→wasm (Zahak), .NET→wasm (Leorik), Emscripten (Caissa,
  Arasan) are all possible but each is a real porting project. If the
  enterprise build lands as the LAN-host seminar shape in the roadmap, the
  engine can live host-side and the porting question mostly dissolves.

## The options for D46

| path | legal state today | work required |
|---|---|---|
| Ask `Witek902` to add a license to Caissa-Nets | unlicensed nets, active author | one GitHub issue / email; zero code |
| **Arasan adapter** | clean — license text enumerates `network/` | small: native-spawn adapter mirrors `caissa.ts`; MultiPV runtime-verified today; cold-contract behaviour unmeasured |
| **Caissa + self-trained `.pnn`** | cleanest end state — fully owned stack | most work: datagen fleet + GPU training + re-calibration grid; but also the only path to a this-game-trained net |
| Zahak adapter | clean — nets in-repo | small; ~2800 ceiling, dormant-project risk |
| Leorik adapter | clean — nets in-repo | .NET 10 runtime dependency; MultiPV unverified at runtime here |
| Stay segmented | Stockfish open/Steam + Lozza permissive-browser | zero new work; weakest enterprise option |

## Open

- Whether `Witek902` responds — the issue is worth filing regardless; it costs
  nothing and resolves the strongest candidate outright.
- Arasan and Leorik under the cold-search contract: untested. `ucinewgame`
  presumably clears their transposition state, but that is assertion, not
  measurement — the ADR 0067 probe belongs in any adapter.
- Whether a self-trained net changes the collapse seeds — the first evidence
  that a net trained on this game's distribution matters at all.
- The D46 ruling itself, which per ADR 0020 belongs to harness measurement.

## Suggested next stages

1. **Legal probe (free):** open a Caissa-Nets issue asking for explicit net
   terms; record the reply (or its absence) in `docs/engine_licensing.md`.
2. **Arasan adapter spike:** native-spawn adapter by the `caissa.ts` pattern,
   cold-search probe, `MultiPV 8` at `D_max 16`, then the same
   `{supportive, tyrannical} × {7, 29, 41}` grid — same protocol as PR #222.
3. **Caissa datagen smoke:** build `utils` with CUDA, run `selfplay` on one
   host for a fixed wall-clock, measure positions/hour/core, project the cost
   of a 10^8-position dataset on the existing Batch fleet before committing
   to a training campaign.

## Raw artifacts

Non-durable session clones (SHAs cited above): `/tmp/caissa-nets-check`,
`/tmp/zahak`, `/tmp/arasan` (avx2 build + MultiPV logs under
`/tmp/arasan*`), `/tmp/leorik`, `/tmp/akimbo`, `/tmp/bullet`;
`~/engines/caissa` for the trainer/selfplay source reading.
