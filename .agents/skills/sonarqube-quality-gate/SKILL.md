---
name: sonarqube-quality-gate
description: Work with the SonarQube Cloud analysis and quality gate for The Kings and I — reading issues, fixing or accepting them, and keeping coverage reporting wired. Use when a Sonar check fails on a PR, when triaging Sonar issues, or when changing coverage or CI analysis config.
---

# SonarQube Cloud Quality Gate (ADR 0033)

- Organization: `bckirkup` · Project key: `bckirkup_TheKingsAndI`
- **CI-based analysis**, not automatic analysis — automatic analysis cannot see
  coverage, and coverage is most of why we run this.
- Coverage comes from `pnpm test:coverage` → `coverage/lcov.info`, read via
  `sonar.javascript.lcov.reportPaths` in `sonar-project.properties`.
- Analysed sources: `src` and `sim`. `docs/` is out of scope.
- The gate applies to **new code**. Requires the `SONAR_TOKEN` repo secret; if it
  is absent the job skips rather than failing, so forks are never blocked.

## Inspecting issues without leaving the terminal

The `sonarqube` MCP server is available. Useful calls:

- `search_my_sonarqube_projects` — confirm the project key.
- issue search / project analysis tools — list issues for the project or a PR.
- `change_sonar_issue_status` — `accept`, `falsepositive`, or `reopen`.

Prefer this over the web UI; it is faster and scriptable.

## Triage policy — Sonar advises, ESLint adjudicates

Every rule encoding a *project invariant* (layer boundaries, the `Math.random`
ban, banned transcendentals in `psychology/`, exhaustive switches) lives in
ESLint in this repo, versioned next to the ADR that motivated it. Sonar does not
know about our ADRs and must never be the only guard.

**Fix, don't accept:** dead stores, unused config keys, identical branches,
accidental `any`, unhandled promises, security hotspots.

**Accept with a comment naming ADR 0033**, in exactly these two cases:

1. **Duplication inside golden fixtures / sensitivity probes.** The repetition is
   the point; deduplicating it into a helper is how a golden test stops catching
   regressions.
2. **Cognitive complexity in the verdict ladder and the desertion comparison.**
   These are branchy specs that must stay readable side-by-side with
   `docs/psychology_engine.md`. Split them only when the split is honest — never
   by hiding the arithmetic behind indirection.

Anything else you are tempted to accept: raise it in the PR instead.

## When the gate fails

1. Read the actual issues (MCP), don't guess from the summary.
2. Coverage-on-new-code failures are usually a missing sensitivity probe, not a
   missing unit test — check the `ci-test-design` skill before adding filler
   tests. Never add a test that asserts nothing in order to move coverage.
3. Never disable a rule repo-wide to clear a single finding.
4. Never modify a test to make a gate pass (AGENTS.md rule 7).
