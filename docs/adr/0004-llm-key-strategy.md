# ADR 0004 — LLM key strategy and hosting boundary

- **Status:** OPEN — decision required (design_decisions.md D12)
- **Date:** 2026-07-26

## Context
A hosted shared API key is the best UX but forces a backend, rate limiting, abuse
handling, and per-user cost — the first thing that breaks the zero-infrastructure
Phase 1 topology. BYO key keeps costs at zero but adds friction and exposes the
key in the client.

## Options
- A. BYO key stored locally
- B. Hosted proxy with our key
- C. Ship template-only; add narration as a later upgrade

## Recommendation
C → A → B in that order. Keep the provider adapter provider-agnostic so
Gemini Flash vs Claude Haiku is a one-file change.

## Consequences
Template quality becomes a first-class product requirement rather than a
fallback, and the LLM adapter must tolerate being absent entirely.
