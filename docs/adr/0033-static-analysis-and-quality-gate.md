# ADR 0033 — SonarQube Cloud is the quality gate; lint owns the invariants

- **Status:** accepted (2026-08-02)
- **Refines:** ADR 0032 (toolchain)
- **Related:** `docs/testing_strategy.md`, the `ci-test-design` skill

## Context
This codebase will be written mostly by AI agents, at a pace where a human
reviewer cannot read every line. The plan already has strong *behavioural*
guards (golden tests, sensitivity probes, replay determinism), but nothing that
notices a reducer quietly growing to cognitive complexity 40, a copy-pasted
verdict ladder, an unused config key, or a `psychology/` function that is no
longer pure. Those are precisely the defects that make later calibration work
unaffordable.

The owner's other repositories are already onboarded to SonarQube Cloud under the
`bckirkup` organization, so the marginal cost here is a project key and a token.

## Decision
1. **SonarQube Cloud** analyses every pull request and `main`, as project
   `bckirkup_TheKingsAndI` in organization `bckirkup`.
2. **CI-based analysis, not automatic analysis.** Automatic analysis cannot see
   test coverage; coverage is the number we actually care about on a project
   whose thesis is "every knob has a golden test and a sensitivity test". CI runs
   Vitest with `@vitest/coverage-v8` into `coverage/lcov.info` and the scanner
   consumes it.
3. **The gate is on new code**, not on the whole project: new code must pass the
   Sonar way (no new blocker/critical issues, no new security hotspots left
   unreviewed, coverage on new code held to the project standard). A greenfield
   repo can afford this from day one, and only a greenfield repo can.
4. **Sonar advises; ESLint adjudicates.** Every rule that encodes a *project
   invariant* — layer boundaries, the `Math.random` ban, the transcendental ban
   in `psychology/` (ADR 0032 §4), exhaustive switches — lives in ESLint, in this
   repo, versioned with the ADR that motivated it. Sonar cannot know about ADR
   0011 and must never be the only thing standing between us and a violation.
5. **Sonar findings are triaged, not obeyed.** Two known false-friend classes on
   this project, to be marked accepted with a comment naming this ADR rather than
   refactored:
   - **Duplication in test corpora.** Golden fixtures and sensitivity probes are
     deliberately repetitive; deduplicating them into a clever helper is how a
     golden test stops catching regressions.
   - **Cognitive complexity in the verdict ladder and the desertion comparison.**
     These are inherently branchy specs. They may be split when the split is
     honest, but never by hiding the arithmetic behind indirection that makes the
     spec unreadable against `docs/psychology_engine.md`.
   Everything else — dead stores, unused config keys, identical branches,
   accidental `any` escape hatches — is fixed, not accepted.
6. Analysis of `docs/` is out of scope; `sources` is `src` and `sim`.

## Consequences
- CI needs a `SONAR_TOKEN` repository secret. Until it exists the Sonar job is
  skipped rather than failing, so a fresh fork and a first-time contributor are
  never blocked by a credential they cannot have.
- Coverage becomes a published number from Milestone 0, before there is anything
  interesting to cover — deliberately, so the ratchet never has to be introduced
  later against an existing deficit.
- Agents get a second, independent reviewer that does not get tired. This is the
  actual motivation; the badge is not.
- A quality gate on new code means a large mechanical refactor (e.g. the ADR 0032
  §5 psychology port) will need an explicit, argued exemption rather than a
  silent one.

## Alternatives considered
- **Automatic analysis (zero-config).** Cheaper, but blind to coverage, which is
  most of the value here.
- **ESLint alone.** Free, and already required by §4 — but it has no notion of
  duplication, coverage, or new-code ratchets, and no memory across PRs.
- **A coverage service (Codecov et al.) plus ESLint.** Covers the coverage
  ratchet only; leaves complexity and duplication unwatched, and adds a second
  vendor for a subset of what Sonar already does here.
