# The forced move, and the convert — D191 re-taken after D192

**Date:** 2026-08-30
**Revision:** `de6b214` (post-D192 carry fix)
**Engine:** fake. **Seed:** 7. **Opponent:** `tyrannical` in every arm.
**Grace:** inert (`GRACE_RATE_PERMILLE = 0`), so these campaigns measure
retirement without mercy; `graceEvents = 0` in all 120 matches.

D191's magnitudes were taken before D192, on a roster whose earned experience
reset at every match boundary. This pass re-takes them on the fixed carry and
adds the arm that was missing: **pure `supportive`**, run as a style from match
1 rather than as the `redeemer`'s plot.

Commands:

```bash
pnpm sim --matches=40 --leader=redeemer   --opponent=tyrannical --seed=7 --engine=fake --out=redeemer-40.csv
pnpm sim --matches=40 --leader=supportive --opponent=tyrannical --seed=7 --engine=fake --out=supportive-40.csv
pnpm sim --matches=40 --leader=tyrannical --opponent=tyrannical --seed=7 --engine=fake --out=tyrannical-40.csv
```

## 1. The finding that withdraws the premise

D191 was raised on the reading that a warm commander is billed for his room's
unanimous refusal, and that kindness therefore pays a forced-move tax. On the
fixed carry, **pure `supportive` never takes the fallback at all**: zero
overrides of any kind across 40 matches, so zero forced moves and zero
benevolence charged.

| 40 matches, seed 7 | `supportive` | `tyrannical` | `redeemer` |
|---|---|---|---|
| win score (mean) | **82.50** | 53.75 | 32.50 |
| refusal rate | 0.063 | 0.139 | 0.761 |
| overrides | **0** | 2033 | 1468 |
| forced (implicit) | **0** | 1 | 1135 (77%) |
| benevolence charged to targets | 0 | 11 758 | 19 526 |
| …per override | — | 5.8 | 13.3 |
| desertions | **1** | 72 | 325 |
| retirements | 33 | 45 | 17 |
| careers fielded | 48 | 59 | — |
| mean survivors / match | 8.25 | 3.70 | 2.65 |
| quiet-quit rate | **0.209** | 0.033 | 0.151 |
| final mean ability / ceiling | 49.0 / 98 | 37.5 / 52 | 10.3 / 17 |

So the forced move is not a tax on warmth. It is what happens to a roster that
has already stopped rating its commander in *both* channels, and the only arm
that reaches that state is the convert.

## 2. What the redeemer actually shows: the conversion trap

`sim/leaders.ts` runs `redeemer` as `pure_tactician` for nine matches and
switches to `supportive` at match 10. The collapse lands exactly on the switch,
and the forced-move share goes to saturation with it:

| redeemer segment | refusal | overrides | forced | benev/override | desertions |
|---|---|---|---|---|---|
| matches 1–10 (cold) | 0.298 | 364 | 31 (9%) | 10.2 | 45 |
| matches 11–20 (warm) | 0.913 | 463 | **463 (100%)** | 17.0 | 100 |
| matches 21–40 (warm) | 0.917 | 641 | **641 (100%)** | 12.4 | 180 |

After the switch **every single override is a forced one**, because a warm
policy never chooses to insist — the only override a `supportive` commander can
generate is the one the harness makes for him under ADR 0014. The mechanism is
not that kindness raises refusal: `supportive` from match 1 holds refusal at
0.063 with `τ_benev` at ~95. It is that the convert arrives with a roster that
has neither channel — nine matches of cold command left it at mean ability 9 and
`τ_benev` near the floor — and then he stops insisting, which was the only thing
that had been moving it. Authority spent, affection never bought.

That is a sociology result, not a harness artifact, and it is worth keeping: a
leader who turns kind too late has nothing left to lead with. What *is* a
harness artifact is the ledger — 1 135 moves that nobody chose, recorded as
`OVERRIDE`, charged at 13.3 target benevolence each, and read back in a debrief
as insistence.

## 3. What the ledger cannot say

The model has one event for two different things that happened to a room:

* *he overrode me* — the commander had an unrefused alternative and used his
  authority against mine;
* *we all said no and it moved anyway* — nobody was singled out, and the
  position simply had to continue.

Both land as `OVERRIDE` with `implicit: true` distinguishing them only in the
metrics layer, never in what the pieces are told or what a debrief reads. The
re-take makes the case narrower than D191 first stated but not weaker: the
distinction matters for exactly one population — converts and collapsed rosters
— and that is the population the seminar is most likely to produce, because a
participant who is losing changes style.

## 4. The trajectory gate (D188) can now be read, and it fails the other way

D188's replacement gate asks that a cruel style may lead early and must not
widen its advantage with length. On the fixed carry the cruel style **never
leads**: `supportive` wins 80.00 / 72.50 / 82.50 at 10 / 20 / 40 matches against
`tyrannical`'s 40.00 / 52.50 / 53.75, while burning 1 desertion against 72 and
holding twice the roster. The owner's requirement — abusive leadership attains
the rewards it seeks in the mid run — is not met at any horizon here.

Two candidate reasons, neither measured yet: the tyrant's ability ceiling now
*falls* under the carry (D192), so cruelty degrades its own instrument; and
`supportive`'s room complies grudgingly rather than refusing — quiet-quit 0.209
against 0.033 — which the win score does not price. This is one seed and one
opponent, so it is a flag for a seeded sweep, not a verdict.

## 5. Limits

One campaign per condition, one seed, one opponent, the fake engine, and grace
inert. Nothing here selects a D191 closer or a D188 magnitude; it removes a
false premise (that warmth causes forced moves), locates the real one (the
convert), and records that the mid-run advantage of cruelty is currently absent
rather than merely small.
