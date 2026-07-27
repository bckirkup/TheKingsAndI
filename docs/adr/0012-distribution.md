# ADR 0012 — Distribution: lightest shell first, Steam as the commercial target

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D13)
- **Date:** 2026-07-26

## Context
WASM + IndexedDB runs in the browser today. A desktop shell buys Steam
distribution, larger memory limits, and offline trust, at the cost of build
complexity and code signing. The owner's priority is to validate the psychology
before investing in packaging, with Steam as the eventual commercial channel.

## Decision
1. **Validate in the lightest distribution.** The playable artifact through
   Milestones 4–6 is a plain web build: link-shareable, zero install, trivially
   playtestable by strangers.
2. **Steam via a desktop wrapper** (Tauri, not Electron) once the psychology is
   calibrated and the game is worth selling.
3. No backend, no accounts, no cloud saves in either target.

## Consequences
- Playtesting is a URL, which matters enormously for the ADR 0007 spiral: that
  design needs many players losing many first campaigns before launch.
- Tauri keeps the same web build and adds a native shell, so this is a packaging
  decision rather than an architecture fork — provided nothing depends on
  browser-only APIs beyond IndexedDB and Web Workers.
- Steam implies a paid product, which sharpens D16: the AGPL build and the
  commercial build must be the same code under different terms.
- Engine memory budget is set by the *web* target, not the desktop one, which
  reinforces the pooled-search reading of D9 — especially with D5's symmetric
  opponent psychology doubling engine work.
- Steam has its own obligations (achievements, cloud saves, refunds). Refunds
  interact badly with a design whose first campaign is meant to be lost — see
  the unfairness risk in `docs/risks_and_open_questions.md`.

## Alternatives considered
PWA-first with installability (marginal benefit over a plain web build for a
single-player game); Electron (bundle size and memory, for no gain over Tauri).
