# The Permissive-Engine Survey — Caissa Is the MultiPV Candidate

**Date:** 2026-09-21
**Follows:** `2026-09-21-the-ply-seven-tie-break.md`. That note left
"do we need Stockfish-class evaluation for the ability channel?" open. The
owner ruled that the permissive-engine survey runs before any MultiPV work on
Avalanche. The decision trail was: **"Sure, let's try Avalanche."** →
**"(c) Survey other permissive engines for MultiPV first"**. Nothing here
changes a default or starts a campaign.

## Settled inputs

- Stockfish is GPL-3.0 and remains excluded from the enterprise build.
- The harness contract is measured from `src/engine/uci.ts`,
  `src/engine/broker.ts`, `src/orchestration/insight.ts`, and
  `src/orchestration/privateEvaluation.ts`.
- The committed Stockfish and Lozza numbers remain in
  `2026-09-20-does-the-engine-matter.md`,
  `2026-09-21-lozza-at-depth-and-the-bistable-kind-room.md`, and
  `2026-09-21-the-ply-seven-tie-break.md`; they are not re-derived here.

## Harness contract

The current UCI transport is stdin/stdout over a child process. `UciEngine`
currently launches `node <script>` through `process.execPath`, so Lozza's
`.cjs` and Stockfish's WASM `.js` both fit. A native engine needs a spawn-mode
change (or a native-process wrapper).

A candidate must:

- accept `uci`, `setoption`, `isready`, `ucinewgame`, `position fen`, and
  `go depth N` over stdin;
- emit `info` lines carrying `depth`, `score cp` or `score mate`, `pv`, and
  `multipv`;
- produce MultiPV 8 at the production `D_max = 16`;
- supply the shared ladder consumed by `applyPrivateEvaluation` for each
  piece's attended-line distortion;
- supply the D-max MultiPV facts used for sacrifice and declined-sacrifice
  signals;
- clear carried state with `ucinewgame` before every search (ADR 0067);
- fail, rather than truncate, when one search exceeds the info-line ceiling
  (ADR 0068).

The broker exposes the D-max MultiPV lines for sacrifice and declined-sacrifice
facts. `insight.ts` applies the private evaluation per living piece, while
`privateEvaluation.ts` computes whether a line is attended and applies its
displacement. The UCI parser stores both the depth ladder and the
depth-by-MultiPV map.

## Avalanche 4.0.0

Repository: <https://github.com/SnowballSH/Avalanche>

Measured repository state:

- HEAD `8b6fa5102a98847b7e03d82a0cb266d3cc888a86`, dated
  `2026-08-08T18:28:59+00:00`, subject `Release 4.0.0`.
- Release `v4.0.0` was published on 2026-08-08.
- `LICENSE` is the MIT License; GitHub metadata also reported MIT.
- The repository was not archived at measurement time.
- The README reports v3.0.0 CCRL 40/15 **3384** and CCRL Blitz
  **3420**. CCI reports v4.0.0 STC **3190 ± 30**, LTC
  **3389 ± 29**, and VLTC **3443 ± 26**.
- Zig **0.16.0** was required by the README and installed under `~/zig`.
- `zig build --release=fast` completed in **62.17 s**.
- The native binary was 31,745,496 bytes. The separate source
  `nets/nezha.nnue` was 25,200,704 bytes and was embedded in the normal
  build.

Native UCI was measured successfully with `uci`, `isready`,
`position startpos`, and `go depth 8`. Output included `depth`, `score cp`,
and `pv`.

Avalanche 4.0.0 does **not** advertise MultiPV. Sending
`setoption name MultiPV value 8` was silently accepted, but the depth-8 run
produced zero `multipv` tokens and one PV per depth. The source also lacks a
usable `searchmoves` path for externally emulating MultiPV. No WASM or
`wasm32-freestanding` target is documented, and the source uses native
threading, POSIX, allocator, and memory-map facilities.

Conclusion: Avalanche is a working native UCI engine, but it is not a
candidate for the current shared-search contract.

## Permissive-engine survey

Licenses below were read from repository license files, not inferred only from
GitHub metadata. MultiPV is marked verified only when a search or source
contract demonstrated it; a grep hit alone is not treated as runtime proof.

| engine | license evidence | MultiPV (how verified) | activity | rating | lang/build | WASM | NNUE |
|---|---|---|---|---|---|---|---|
| Caissa | MIT `LICENSE` | **Verified**: 8 lines per depth, `multipv` output | HEAD `58ee6dc`, 2026-09-20; v2.0.1 | README CCRL 40/15 3628; Blitz 3745 | C++20; Make/CMake; GCC/Clang | No target documented | External `.pnn`, embedded by Make |
| Arasan | Permissive MIT-style `LICENSE` | Source-confirmed in README and `src/options.h`; not built here | HEAD `4c1103b`, 2026-09-20 | No specific CCRL figure found | C++17; GNU Make | No target documented | External runtime `.nnue` |
| Zahak | MIT `LICENSE` | **Verified**: 64 depth-8 info lines with `multipv` | HEAD `72ff806`, 2022-04-01; tags 10.0, 10 | CCRL Blitz 6.x 2833; 40/40 2800 unstable | Go; Make | No target documented | External `.nn`; default 1,579,036 bytes |
| Akimbo | MIT `LICENSE` | No `MultiPV`/`multipv` implementation found | HEAD `f7dd767`, 2025-02-07; v1.0.0 | README CCRL 40/15 2474; Blitz 3583 | Rust/Cargo | No target documented | Embedded `net.bin`, 6,297,664 bytes |
| Blunder | MIT `LICENSE` | No MultiPV implementation found | HEAD `7144218`, 2024-05-17 | README Blitz 8.0.0 2674 | Go; release builds | No target documented | Handcrafted evaluation |
| Baislicka | MIT `LICENSE.txt` | No MultiPV; UCI parser only handles Hash | HEAD `2dae4e5`, 2024-03-04 | README approximately 2200 Blitz/40/15 | C; CMake | No target documented | No NNUE found |
| Shallow Blue | MIT `LICENSE` | No MultiPV implementation found | HEAD `a04fbd9`, 2019-01-16; v2.0.0 | No rating found | C++11; Make | No target documented | No NNUE found |
| Leorik | MIT `LICENSE` | Source references MultiPV; not built or exercised | HEAD `7c936b1`, 2026-05-15 | No rating collected | C#/.NET | No target documented | No network found |
| Renegade | MIT `LICENSE` | No MultiPV implementation found | HEAD `54bff3e`, 2026-08-10 | No specific rating collected | Rust/Cargo; Linux binaries | No target documented | External 34,460,864-byte net |

The survey also checked candidate repositories for current activity, releases,
Linux builds, and network files. A GitHub API request for archived status and
latest releases hit unauthenticated rate limiting (`HTTP Error 403: rate limit
exceeded`), so those fields are not claimed as independently measured for
every row.

The following candidates were dropped immediately after reading GPL license
files: **Clover, Ethereal, Halogen, Minic, Obsidian, Peacekeeper, Seer, and
Weiss**. They are technically interesting but fail the permissive-license
requirement.

Blunder built in 0.46 s, Baislicka in 1.09 s, and both confirmed the absence
of a MultiPV implementation. Shallow Blue's untouched build failed in 0.93 s
with this pre-existing source error:

```text
src/option.h:55:8: error: ‘string’ in namespace ‘std’ does not name a type
note: ‘std::string’ is defined in header ‘<string>’; did you forget to ‘#include <string>’?
```

## Caissa detail

The native AVX2 build was:

```text
cd ~/engines/caissa/src
/usr/bin/time -f 'BUILD_WALL_SECONDS=%e' make avx2
BUILD_WALL_SECONDS=25.66
```

It produced `caissa-2.0.1-x64-avx2`, exactly 76,944,832 bytes
(76.9 MB). The Makefile targets are `bmi2`, `avx2`, `avx2-vnni`, `sse4`,
`sse2`, `avx512`, `avx512icl`, `legacy`, `neon`, `release`, and PGO
variants. The README recommends `bmi2` by default and documents AVX2,
SSE4/POPCNT, and SSE2-only legacy x86-64 variants.

The AVX2 binary was run from `~/`, where the `.pnn` was absent:

```text
info string Using embedded neural network
id name Caissa 2.0.1 AVX2
uciok
readyok
```

The depth-8 MultiPV test emitted **64 info lines**, eight at each depth from
1 through 8, and included `multipv 1` through `multipv 8`.

The Makefile downloads the network from:

<https://github.com/Witek902/Caissa-Nets/releases/download/eval-ml-8-152B-spsa/eval-ml-8-152B-spsa.pnn>

Caissa's source is MIT, but `Caissa-Nets` has no `LICENSE`, `COPYING`, or
`NOTICE` file. Its README only says it is a repository of Caissa neural nets.
Caissa claims 20.5+ billion self-generated positions and does not state Lc0
training-data terms. The network's redistribution license is therefore an
**open legal question for the owner before any enterprise shipment**; MIT
licensing of the engine does not by itself settle the `.pnn` terms.

## Conclusions

1. **Measured:** Caissa and Zahak are the only permissive candidates in this
   survey with runtime-verified MultiPV. Caissa is the Stockfish-class
   candidate by the published README ratings (CCRL 40/15 3628, Blitz 3745).
   Arasan is the unbuilt second candidate: its source and README expose
   MultiPV, but no run was performed here.
2. **Inferred:** Caissa can satisfy the harness contract with a native-spawn
   mode in `UciEngine` and a `caissa.ts` adapter. Its determinism ID should
   include engine/version/build target/network/hash/threads/D-max/MultiPV,
   cold policy, runaway policy, and ladder-rung policy.
3. **Open:** the Caissa network license must be clarified before shipment.
4. **Open, unmeasured:** whether Caissa reproduces the Stockfish kind-room
   collapse and the `τ_abil` trajectory on seeds 7, 29, and 41. That is the
   next stage, not a conclusion of this survey.

## Next stage (successor session prompt)

### Settled inputs (do not re-derive)

Everything above is settled, along with the Stockfish and Lozza numbers in
the three calibration notes cited in this note. Avalanche has no verified
MultiPV and is not part of the next run.

### Deliverable (exactly one)

Add native-spawn mode and a Caissa adapter, then run one local calibration
grid: Caissa-16 × `{supportive, tyrannical}` × seeds `{7, 29, 41}` ×
20 matches, with the `random` opponent used by the Stockfish grid. Produce
one calibration note.

### Non-goals

- Shipping Caissa.
- Implementing MultiPV for Avalanche.
- Changing the AWS image.
- Adding refused-move memory.

### Validation gate before PR

Run lint, typecheck, and fast tests, plus an adapter test mirroring the
Stockfish broker test.

### Report immediately if

- seeds 29/41 collapse (or fail to collapse) under Caissa — either way it is
  scope-changing, since it decides whether the collapse is Stockfish-specific;
- the info-line ceiling is hit;
- unsound-score escalation is triggered.

### Stop when

The calibration note is merged.

## Raw artifacts

These paths are non-durable session artifacts retained for provenance:

- `~/avalanche/uci-basic.log`
- `~/avalanche/uci-multipv8.log`
- `~/avalanche/zig-out/bin/Avalanche`
- `~/engines/caissa/uci-multipv8.log`
- `~/engines/caissa/portable-uci.log`
- `~/engines/caissa/src/caissa`
- `~/engines/caissa/src/caissa-2.0.1-x64-avx2`
- `~/engines/zahak/uci-multipv8.log`
- `~/engines/zahak/bin/zahak`
