# Licensing

**Decision (D16, ADR 0006): dual-license.**

*The Kings and I* is released under two sets of terms:

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

### Known dependency to watch — resolved in shape (ADR 0020)

**Stockfish is GPL-3.0**, so it cannot be linked into a proprietary commercial
build. Three facts make this bind later than it first appeared:

- **GPL forbids proprietary distribution, not selling.** A paid, GPL-compliant
  Steam build is legal; its costs are a written source offer and
  incompatibility with DRM wrappers.
- **AGPL-3.0 project + GPL-3.0 engine is compatible** via §13 of both licenses,
  so the open build is fine as-is.
- **Engine strength is nearly irrelevant to this design** (depth is capped,
  attention prunes, psychology reads relative evaluations), so a permissive
  engine is a real option rather than a crippling downgrade.

Therefore all engine access goes through `EnginePort` from Milestone 1 with a
conformance suite, Stockfish ships first as the calibration baseline, and the
permissive engine is needed only for the **enterprise** build — the last
audience. Verified permissive candidates (MIT): Lozza, Avalanche, Blunder,
Baislicka. Note that GitHub's license metadata fails to detect the MIT license
of Lozza and Blunder, so dependency scanners will flag them as unknown.
Full analysis and open items D46/D47 in
[`docs/engine_licensing.md`](docs/engine_licensing.md).

## Trademark

*The King and I* is a well-known musical title. The software name pluralizes it
to *The Kings and I* and carries the subtitle *Sacrifice and Command*, which
reduces the likelihood of confusion as to origin but is not itself a clearance.
Check before publishing (ADR 0010).
