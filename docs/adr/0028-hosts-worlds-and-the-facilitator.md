# ADR 0028 — Steam is identity and delivery, one host serves three audiences, and the facilitator is a leader too

- **Status:** accepted
- **Resolves:** **D80** (what Steam is technically for), **D81** (one local host
  for seminar, LAN, and friend groups), **D82** (the facilitator audit and the
  third-party host layer), **D83** (worlds are instanced and sovereign)
- **Refines:** ADR 0012 (distribution), ADR 0026 (community), ADR 0027 (cohort
  first)

## Context

> **"Steam as either a persistent world you enter (or choose not to) or a
> software delivery channel via a secure server that gives people confidence to
> install it on personal devices. But yes, 'LAN party' is a significant user
> mode. And I'm open to other people running seminars using the tooling, but
> they will need to put some real thought into it for students to get the full
> benefit — there's another layer of trust/defect/recruit."**

## Decision

### 1. Steam is a trust and delivery channel, and an identity provider (D80)
Steam cannot host the world; it can host the **binary and the identity**.

| Need | Steam gives us |
|---|---|
| Install confidence | people run an unknown executable from Steam that they would never run from a website |
| Update integrity | signed, automatic |
| Identity | **SteamID** — no accounts, no password resets, no PII we must hold |
| Passport storage | **Steam Cloud** — tier-1 exports (ADR 0026) sync for free |

So the consumer tier obtains most of a registry's value at near-zero
infrastructure cost, without contradicting ADR 0027's decision to ship the real
registry for cohorts first.

### 2. One local host serves the seminar, the LAN party, and the friend group (D81)
A facilitator-hosted cohort service and a friend hosting a weekend world are the
same binary with a different label: closed membership, local host, no moderation
problem, AI commanders filling the market (D74).

**Build the local world host once.** It ends the divergence between the
enterprise and consumer tracks and is the cheapest item in the plan relative to
what it delivers.

### 3. The facilitator is a leader, and the instrument already measures him (D82)
Third-party seminars are welcome, but a seminar run without thought delivers
little — and the system can say so, because everything is deterministic and
logged. A cohort run produces evidence of the **facilitator's** decisions:

- how he paired students,
- when he intervened and when he let a spiral run,
- whom he benched and whom he fed to the strongest player,
- whether burnout in the shared pool was distributed or concentrated.

**A facilitator receives the same audit a student does.** This is the honest
extension of the thesis to the person running the room, and it is a genuine
differentiator for the enterprise product rather than a compliance feature.

The layer of trust/defect/recruit above the game is therefore modelled the same
way it is inside the game: hosts recruit students, students judge hosts, and the
record is the record.

### 4. Worlds are instanced and sovereign; promotion is gated (D83)
Because trauma accumulates across every commander a piece has served (ADR 0026),
a careless or extractive host can damage the commons.

> Each cohort or LAN world is **its own world** by default. Promotion of piece
> passports into any wider shared world is **gated**.

A bad seminar then harms only its own cohort. And a good facilitator whose roster
earns its way into the wider world holds a real credential rather than a
marketing claim.

## Consequences

**Certification becomes a product surface**, not a legal one: the gate on
promotion is evidence from the facilitator audit, so "certified host" means
measured rather than trained.

**AGPL reality.** Third parties may fork and self-host the tooling; that is
intended. What does not travel is the shared world's acceptance of their
passports — the commons is protected by the gate, not by the licence.

**New degeneracy detector — unaccountable host.** The facilitator audit fails to
distinguish a well-run cohort from a badly-run one on any measure that survives
seed variation. Then D82 is theatre.

**New degeneracy detector — commons contamination.** A single hostile host's
cohort measurably degrades any world it did not host (D83).

**New degeneracy detector — identity lock-in.** Any mechanic that requires
SteamID and therefore cannot function for the seminar, LAN, or DRM-free build
(D80, and the GPL constraint of ADR 0020).

**Steam is not required for anything mechanical.** It is a convenience tier; the
DRM-free and facilitator builds must remain feature-complete.

## Alternatives considered
- **Steam as world host.** Not available in the shape needed, and it would make
  the seminar track dependent on a consumer storefront.
- **Separate LAN and seminar hosts.** Rejected: two implementations of the same
  service, diverging immediately.
- **One global world.** Rejected: it exposes the commons to every host, and
  trauma is irreversible by design.
- **Certifying facilitators by training alone.** Rejected: the system can measure
  the outcome, so certifying on unmeasured intent would contradict the thesis.
