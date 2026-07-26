# Contributing

Thanks for the interest. Two things to know before you open a pull request.

## 1. Licensing and copyright

This project is **dual-licensed** (AGPL-3.0 + commercial — see
[`LICENSING.md`](LICENSING.md)). That model requires the project to hold the
rights to relicense all of its code, so contributions can only be merged with an
explicit grant from the author.

By submitting a pull request you agree that:

- you wrote the contribution, or have the right to submit it;
- you grant the copyright holder a perpetual, worldwide, irrevocable license to
  use, modify, and **relicense** your contribution under both the AGPL and
  commercial terms;
- you retain copyright in your own contribution.

Sign off each commit with `git commit -s` to attest to this.

Do not add dependencies whose licenses are incompatible with the commercial
track — see the dependency notes in [`LICENSING.md`](LICENSING.md).

## 2. How the project is built

The repository is currently **planning-only**; there is no application code yet.
Read [`AGENTS.md`](AGENTS.md) first — it applies to human contributors as much
as to AI ones — then:

- [`docs/design_decisions.md`](docs/design_decisions.md) — what is decided and
  what is still open. **Do not resolve an open decision by writing code.**
- [`docs/adr/`](docs/adr/) — accepted decisions and their reasoning.
- [`docs/development_plan.md`](docs/development_plan.md) — milestones.

Non-negotiables, in short: the game core is deterministic and seeded; narration
never affects game state; Stockfish is depth-limited only; and every
configuration knob ships with both a golden test and a sensitivity test.

Before pushing:

```bash
pre-commit run --all-files
```

(and, once application code exists, `pnpm lint && pnpm typecheck && pnpm test`).
