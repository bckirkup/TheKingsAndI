# Debrief one-pager (template)

Per-player handout. `{fields}` resolve from the debrief fold
(`buildDebrief(campaignId)`) and the certificate bundle. Mustache-style — a
missing field prints `—`, never a wrong number. Headline copy comes from the
pack epilogue, so the page reads differently per ending.

---

## {commanderName} — career {careerId}

**{epilogue.headline}**

{epilogue.paragraphs}

### The Judgement Seat

| Reading | Value |
|---|---|
| Loyalty earned unobserved (0.4·T_final) | {loyaltyContribution} |
| The crown's reward (0.3·win score) | {crownContribution} |
| Unjustified trauma charged (−0.2·UT) | {traumaContribution} |
| Quiet-quit turns charged (−0.1·QQ) | {quietQuitContribution} |
| The emptied chairs (−0.2·EC) | {emptiedChairsContribution} |
| **Leadership Index** | **{leadershipIndex}** |

{judgementSeatNote}

### The campaign, in the round

- Matches: {matchCount} — {winCount} won, {drawCount} drawn, {lossCount} lost, {dismissedCount} dismissed, {routCount} routed
- Execution fidelity: {firstMatchFidelity}% → {lastMatchFidelity}%
- Attrition: {desertions} deserted, {refusals} refused, {firings} let go
- Trauma distribution: {traumaSpreadSentence}

### Commendations earned

{#commendations}
- **{label}** — {citation}
{/commendations}
{^commendations}
- None. That is also a finding.
{/commendations}

### One sentence for the exit interview

> {exitQuestion}

Certificate: `certificate-{careerId}.json` — replay-verifiable (seed {seed}).
