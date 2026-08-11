# Trust as credence — the trust fall, formalized

_Owner intent:_

> **"He was wrong" and "he was disloyal" are often ambiguous in a more
> fundamental sense; in the minds of people themselves. The unwillingness to
> substitute judgement — doubt, a lack of faith, an unwillingness to do the
> trust fall — as disloyalty (or a lack of loyalty).**

Accepted resolution of D19 (option D). Governed by ADR 0015. Nothing here is
implemented.

---

## 1. The reframe

ADR 0013 established that a piece reasons only from its own depth-`D_i` view.
That immediately raises a question the reference spec does not answer: what is
the *epistemic* role of the order itself?

A command is not only an instruction. It is **evidence about the position** — the
leader looked, and concluded this was right. Whether a piece incorporates that
evidence is not a mood; it is the whole of what trust means operationally.

So trust is not a term added to utility. Trust is the **weight a piece places on
its leader's judgment relative to its own**:

```
V_perceived(P_i, m) = (1 − τ_i) · V_own(m, D_i)  +  τ_i · V_leader_implied(m)

τ_i = credence(T_i, w_loyalty_i, B_i, …) ∈ [0, 1]
```

- `V_own(m, D_i)` — the piece's own evaluation at its own depth (ADR 0013).
- `V_leader_implied(m)` — the value the piece *infers* the leader must see,
  given that the leader chose this move. Not the true evaluation; an inference.
- `τ_i` — credence. At `τ = 0` a piece acts purely on what it can personally
  verify. At `τ = 1` it adopts a judgment it cannot verify at all.

**That is the trust fall.** You cannot see the person behind you. Falling is the
decision to act on their assurance instead of your own senses.

## 2. Why this dissolves D19 rather than answering it

D19 asked how to scale `w_loyalty · T_i` against a `±10` board axis. Under this
model the question stops applying:

| Problem | Resolution |
|---|---|
| Trust is a `±100` term drowning a `±10` axis | `τ` is dimensionless and bounded `[0,1]`; there is no scale contest |
| Trust decides verdicts, so move-specific terms are inert | trust decides **what the piece perceives the move to be** — it is more decisive, not less, and every board term stays live inside `V_own` |
| The audit cannot honestly attribute anything | attribution becomes exact: divergence between `V_own` and `V_perceived` *is* the amount of faith extended |
| Peer protection and class prejudice are decorative | they operate on `V_own` and on `τ`, both of which now matter |

Trust does not compete with tactics. It **gates access** to them.

## 3. The ambiguity is now structural

The owner's point was that a person cannot cleanly separate their own doubt from
disloyalty. Under this model, neither can the simulation — because it is one
parameter viewed from two sides:

- **From the piece:** "I could not see what he saw. I was not being disloyal; I
  was being careful."
- **From the leader:** "He would not act on my word. That is what disloyalty is."

Both are accurate descriptions of a low `τ`. This is not a modeling defect to be
cleaned up — it is the phenomenon.

**Consequence for the audit (revises ADR 0013):** the audit must *stop* trying to
adjudicate "wrong vs. disloyal." It should report the thing that actually
happened — *he would not take it on faith* — and show the two evaluations side by
side without a verdict. Anything more decisive would be a claim the model does
not support and people do not make honestly about themselves.

## 4. What this mechanizes

### The competence trap, exactly
An untrusted commander's army plays at the average of sixteen shallow views
instead of his one deep one. His skill is real, measurable, and **cannot reach
the board**. The loss is not a penalty applied for bad leadership; it is the
direct arithmetic consequence of judgment that no one will import.

### The dangerous piece is the competent skeptic
High `E_i`, low `τ`. Individually reasonable — its own view is genuinely good —
and quietly catastrophic in aggregate, because it substitutes decent local
judgment for excellent global judgment and is *right often enough* to feel
justified. Nothing about this piece looks like insubordination.

### Faith is most valuable where it is least verifiable
A novice piece has the least ability to check and therefore the most to gain from
high `τ`. A trusted novice plays above its level; a distrusted novice plays at
its own. Developing a piece and earning its trust become substitutes for one
another — which is a real leadership trade-off, not a game mechanic.

### Refusal acquires an honest meaning
Refusal is no longer "my mood score fell below a threshold." It is: *I cannot
make this make sense, and I will not take it on faith.* Both halves are
necessary — a piece refuses only when the move looks bad **and** credence is
insufficient to bridge the gap.

## 5. Where refusal now comes from

```
gap(m)  = V_leader_implied(m) − V_own(m, D_i)     // how much faith this order asks for
refuse  ⟺  V_perceived(m) < Θ_refusal   ⟺   roughly:  τ_i · gap(m) too small to
                                                      redeem a bad-looking move
```

A high-`τ` piece can be ordered into something that looks awful to it. A low-`τ`
piece refuses moves that merely look mildly odd. The *same* order produces
different verdicts from different pieces — which is what makes the roster feel
like people rather than a threshold table.

## 6. Open questions this creates

- **D36: decided (ADR 0019; step shape superseded by ADR 0043).**
  `V_leader_implied` is the **ability** channel, `τ_abil`, accreting from
  vindicated and falsified orders through an asymmetric, state-dependent
  reducer — so a reputation for competence builds slowly and is hard to move
  late in a campaign.
  ADR 0016 supplies its raw material: what obedience has cost this piece, its
  class, and its friends.
- **D37–D39: decided (ADR 0019; shape superseded by ADR 0043).** `τ` splits
  into `τ_benev` (fast up on being heard, logistic cliff on betrayal, slow
  erosion under neglect) and `τ_abil` (curved, asymmetric accretion from
  vindicated and falsified orders). Benevolence snaps; ability creeps back up
  and falls more sharply.
- **D38: decided — yes, `τ` is domain-specific** (ADR 0019), and the two channels
  produce two refusals needing opposite responses: *"he's probably wrong"* (low
  ability, unfixable by kindness) and *"he thinks I'm expendable"* (low
  benevolence, unfixable by winning).
- **D40:** Does this replace `w_loyalty · T_i` in `U` entirely, or sit alongside
  a smaller residual loyalty term for the purely affective part of trust?
- **D95–D96: prior retained (ADR 0039, proposed; shape superseded by ADR
  0043).** The prior evidential weight remains `100 / (n₀ + n)` before the
  floor and curvature transform, where `n` is the per-piece observation count
  and `n₀ > 0` is retained on the relationship account. A world may raise `n₀`
  with a cohort-uniform training record that grants patience rather than trust.

## 7. Calibration targets

| Metric | Expectation |
|---|---|
| Correlation between player tactical strength and win rate at low mean `τ` | near zero — skill cannot reach the board |
| Same correlation at high mean `τ` | strong — this is what earning trust buys |
| Refusals attributable to `gap(m)` rather than to trust alone | the majority; otherwise we have rebuilt the mood filter |
| Novice pieces' effective play strength, high `τ` vs. low `τ` | materially different — faith substitutes for competence |
| Frequency of the competent-skeptic profile in collapsed campaigns | high; it should be recognizable in the debrief by name |
