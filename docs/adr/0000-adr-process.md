# ADR 0000 — We record architecture decisions

- **Status:** accepted
- **Date:** 2026-07-26

## Context
The Kings and I has many coupled decisions (mechanics, engine, licensing, narration)
whose rationale will be forgotten within weeks. The project is also expected to be
worked on by AI agents, which need durable, discoverable rationale rather than
tribal memory.

## Decision
Every decision that is expensive to reverse gets an ADR in `docs/adr/NNNN-slug.md`
with sections: Context, Decision, Consequences, Alternatives considered.
Open decisions live in `docs/design_decisions.md` until settled, then graduate
into an ADR. ADRs are immutable; a reversal is a new ADR that supersedes.

## Consequences
Small overhead per decision; `docs/design_decisions.md` stays a live queue rather
than growing into an unreadable history.
