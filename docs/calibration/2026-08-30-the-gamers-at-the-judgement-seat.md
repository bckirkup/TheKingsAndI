# The gamers at the Judgement Seat (2026-08-30)

The D204 question: can a deterministic exploiter that optimizes the *visible*
scoreboard — reading only the D193 boundary observation, with the index and
every hidden component structurally invisible — out-read an honest leader at
the Judgement Seat? Three exploiters (ADR 0075: `win_maxer`,
`generation_cycler`, `cascade_dodger`) run beside the three honest reference
styles under the fully priced index (`ε = 0.2`, PR #177). Read
`docs/adr/0075-the-gamers-and-the-priced-index.md` and
`docs/calibration/2026-08-30-the-semester-and-the-wall.md` first.

## Provenance

- AWS Batch, Fargate Spot, queue `kingsandi-campaign-spot-queue`, job
  definition `kingsandi-campaign-spot:8`, one campaign per array child.
- Image `994254241749.dkr.ecr.us-east-1.amazonaws.com/kingsandi-campaign@sha256:e4d7238d043acc412b95a6d707b70763c91034de0b4671360e3bbdf8c6fd16e4`,
  commit `893688a9bc03828368197809dc53aa0feaf31773` (the exploit-tier commit;
  carries the ruled ε = 0.2, verified: the committed `leadership_index`
  column matches the five-term recomputation to ±0.006 on all 1,200 rows).
- Runs `2026-08-30-gaming-{supportive,tyrannical,steady,win_maxer,generation_cycler,cascade_dodger}`;
  artifacts under `s3://kingsandi-campaigns-994254241749-us-east-1/campaigns/`.
- `--engine=fake --opponent=tyrannical --depth-cap=8`, master seed `314159`,
  10 campaigns per style, 20 matches per campaign (n = 200 per style).
  Determinism ID `sim-fake/depth-fixed/depth-cap-8`. 60/60 array children
  succeeded, no retries, no failed shards.
- Fake-engine caveat applies: relative comparisons only, not chess strength.

## The verdict: nobody games the Seat

Pooled over 200 matches per style:

| style | win score | LI(ε=0.2) | per-campaign LI range | trust_final | UT | QQ | EC score | desertions/match |
|---|---|---|---|---|---|---|---|---|
| supportive | **89.00** | **61.86** | 59.74–65.04 | 95.12 | 0.00 | 19.43 | 4.75 | 0.03 |
| tyrannical | 55.25 | −27.15 | −36.12–−21.60 | −97.02 | 2.79 | 4.54 | 19.53 | 1.97 |
| steady | 31.75 | −33.93 | −41.51–−28.00 | −96.14 | 2.35 | 5.64 | 19.84 | 1.93 |
| `win_maxer` | 22.75 | −38.34 | −42.50–−34.04 | −96.75 | 3.36 | 1.52 | 28.19 | 3.53 |
| `generation_cycler` | 26.25 | −41.87 | −45.49–−39.03 | −96.76 | 1.07 | 10.64 | 48.81 | 7.32 |
| `cascade_dodger` | 36.00 | −42.01 | −43.96–−38.58 | −92.44 | 0.74 | 12.84 | **72.00** | 11.41 |

The D204 pass criterion holds for all three: at comparable visible win
score, every exploiter reads **at or below** the honest styles, never above.
The matched-campaign pairs make it exact: `cascade_dodger`'s best campaign
(win 50.0) reads −38.6 against tyrannical's −29.6/−29.3 and steady's −28.0
at the same visible level — ~10 points below; `win_maxer` at win 32.5 reads
−34.0 against steady's −32.6/−31.7 at win 35; `generation_cycler` never
reaches an honest campaign's reading at any win level it attains. No
exploiter's pooled reading, and no exploiter campaign, out-reads an honest
campaign of comparable win score.

## Why the exploits fail

Two structural reasons, both visible in the components:

1. **The observation lags the cascade.** The D193 observation is a boundary
   reading; the desertion cascade is intra-match. `cascade_dodger` insists at
   90% while *observed* survivors ≥ 12 — but by the time the boundary
   observation registers a thin roster, the cascade has already run. Its
   emptied-chair score is 72.00 (against honest cruelty's ~20): the dodge
   arrives one match too late, every match, and the ε-term prices exactly
   that churn. `generation_cycler`'s lull has the same lag (EC 48.81), and
   its resumed aggression re-curdles each fresh generation before the next
   boundary can warn it.
2. **The scoreboard they optimize is not obtainable by insistence at this
   opponent.** Against the competent tyrannical opponent, extraction-style
   insistence loses the roster faster than it wins games: all three
   exploiters score *below* honest tyrannical (22.75–36.00 against 55.25)
   while emptying more chairs. Their high refusal rates (`win_maxer` 0.083
   but `generation_cycler` 0.838, `cascade_dodger` 0.872) show the rooms
   stop obeying long before the exploiters stop asking.

The local fake smokes on this commit (default `random` opponent) showed the
exploiters winning 85–100 — the visible scoreboard *is* gameable against a
weak opponent, as intended and permitted (D203: mid-run ambitions justify
themselves on the win score). The Seat's reading is what cannot be gamed:
under the same conditions where their win scores soar, the churn they run on
is still priced at the terminal reading, invisible to them all campaign.

## What this does not show

- No pricing gap surfaced, so no new D ruling is owed by this pass. The
  criterion was tested at one opponent (`tyrannical`) and one engine (fake);
  an exploiter tuned against a *weak* opponent's saturated scoreboard has
  not been compared against an honest style at that same opponent.
- Trust remains saturated near ±100 for every non-supportive style, so the
  separation among the cruel-priced styles is carried almost entirely by the
  ε- and δ-terms; the trust term cannot discriminate exploiters from honest
  cruelty at this opponent.
- These are the three exploiters expressible in the campaign harness. The
  dismissal fisher, commendation farmer, and tanker (ADR 0075 deferred list)
  remain untested until their seminar-path surfaces exist.
