# Licensing

**Decision (D16, ADR 0006): dual-license.**

*The King and I* is released under two sets of terms:

1. **GNU AGPL-3.0** — the open build. See [`LICENSE`](LICENSE). Anyone may use,
   modify, and redistribute under AGPL terms, including the network-use
   provision: if you run a modified version as a network service, you must offer
   its source to users of that service.
2. **Commercial license** — available separately for organizations that cannot
   accept AGPL terms (corporate training, white-label, or closed derivative
   works). Contact the copyright holder.

## Why both

The AGPL build keeps the project open and protects it from closed forks. The
commercial option preserves the leadership-training path, where corporate and
government buyers routinely refuse AGPL dependencies in their stack.

## What dual-licensing requires

Dual-licensing only works if **one party holds all copyright**. That has two
consequences, both of which must be respected from now on:

- **Contributions require an explicit grant.** Outside contributions cannot be
  merged until the contributor terms in [`CONTRIBUTING.md`](CONTRIBUTING.md) are
  in place and signed. This is much cheaper to establish now than to retrofit —
  retrofitting means tracking down every past contributor.
- **Dependency licenses must stay compatible with both tracks.** A GPL/AGPL-only
  dependency is fine for the open build but poisons the commercial one. Before
  adding any dependency, check that its license is permissive (MIT, BSD,
  Apache-2.0, ISC) or that a commercial license is obtainable.

### Known dependency to watch

**Stockfish is GPL-3.0.** Shipping it linked into a proprietary commercial build
is not permitted. Options, all of which should be settled before the commercial
track is real: keep Stockfish only in the AGPL build; isolate it behind a
process/worker boundary and ship it as a separate GPL component with source;
substitute a permissively licensed engine for the commercial build; or keep the
commercial offering itself AGPL-compliant and sell support and content instead.
This is the single largest practical constraint on D16 and should not be
discovered late.

## Trademark

The name *The King and I* is a well-known musical title. The software name is
not itself a claim to that mark, but a store listing will likely need a
distinguishing subtitle. Check before publishing (ADR 0010).
