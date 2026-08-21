# Chair contest and bench instrument: before/after

## Scope

This is the harness/pool measurement for ADR 0056. The before values are the
owner-provided measurements from the pre-change pool path. The after values are
from the authored `probe-trap.ts` shape: 20 matches, depth factor 2, fake
engine, black supportive, seed 0, with both leadership styles and all three
fielding policies.

## Before

| Leader / policy | Post-promotion selection | Unpromoted same-origin control |
|---|---:|---:|
| supportive / `rest_traumatised` | 0.09 | 0.67 |
| supportive / `veteran_first` | 0.26 | 0.77 |
| supportive / `strongest_available` | 0.40 | 0.87 |
| tyrannical / `strongest_available`, seed 7 | 0.20 | 0.65 |

These values are reproduced without re-derivation.

## After

The seed-0 probe produced the following season/window aggregates. The probe's
`abilityAtPromotion` field is intentionally not used as a gate: pieces absent
from a match result may print `undefined`, which does not affect the
selection-rate measurement.

| Leader / policy | Post-promotion selection | Unpromoted same-origin control |
|---|---:|---:|
| supportive / `rest_traumatised` | 0.570 | 0.499 |
| supportive / `veteran_first` | 1.000 | 0.774 |
| supportive / `strongest_available` | 1.000 | 0.746 |
| tyrannical / `rest_traumatised` | 0.889 | 0.557 |
| tyrannical / `veteran_first` | 1.000 | 0.552 |
| tyrannical / `strongest_available` | 1.000 | 0.580 |

The after measurements show that a crowned member remains selectable after
losing the attained chair, with the remaining spread reflecting ordinary
policy and availability differences rather than permanent loss of origin-role
eligibility.

## Window definition

Crowned opportunities count every match after promotion through the member's
retirement or death; matches after that point are counted as missed selections.
Control opportunities use the same window and likewise include controls after
their retirement. Both directions therefore deflate the rates, but the two
rates remain comparable to each other. These values must not be compared
directly with a measurement that removes post-retirement matches from its
window.
