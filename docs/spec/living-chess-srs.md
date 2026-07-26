<!--
  VERBATIM TRANSCRIPTION of the source design document supplied by the owner
  (2026-07-26), preserved as the requirements source of record.

  Two mechanical changes were made:
    1. Base64-embedded images (all of which were rendered LaTeX formulas) were
       stripped; each inline occurrence is marked `⟦imageN⟧` where the formula
       appeared in the original.
    2. Nothing else. Typos, escapes, and ASCII diagrams are unchanged.

  The mathematics has been reconstructed from surrounding prose in
  ../psychology_engine.md — that file, not this one, is what implementation
  should follow. Where the two disagree, raise it as a question rather than
  guessing which is authoritative.
-->

# **Living Chess: The Sentience of the Square**

## **Software Requirements Specification & Technical Architecture**

## **1\. Executive Summary & Vision**

**Living Chess** is a tactical leadership and strategy game built on the foundation of traditional chess. Unlike standard chess where pieces are mindless automata, pieces in *Living Chess* possess:

1. **Persistent Identities & Memory:** Pieces survive beyond individual matches, retaining memories of player decisions, past victories, captures, and betrayals.  
2. **Orthogonal Motivations:** Player utility (`⟦image1⟧`) is in direct tension with Piece utility (`⟦image2⟧`).  
3. **Inter-Piece Affinity & Class Prestige:** Pieces form dynamic relationships with one another. They hold generic class biases (e.g., Rooks trusting other Rooks while viewing Pawns with default contempt) and specific 1-on-1 personal bonds formed through shared combat and witnessed sacrifices.  
4. **Variable Board Insight:** Experienced pieces access deeper search engine evaluations, granting them accurate strategic foresight, while novice pieces act on flawed, short-sighted heuristics.  
5. **Agency & Refusal:** Highly dissatisfied, terrified, untrusting, or protective pieces can misinform the player, advise alternate moves, commit quiet quitting (malicious compliance), or mutiny (refusing a command or deserting the board).  
6. **Narrator Broadcasts, Single-Match Audits & Multi-Game Campaign Debriefs:** A contextual sports announcer / herald sets match tension before move 1, single-match debriefs analyze tactical decisions, and multi-game campaign debriefs serve as leadership development training aids tracking longitudinal team culture and trust evolution.

## **2\. Strategic Positioning & Market Design**

                     High Systemic Autonomy  
                             │  
                             │   \* Living Chess  
                             │   \* Close Combat (Market Garden)  
                             │   \* Dwarf Fortress  
      \* Majesty              │   \* RimWorld  
      (Indirect Control)     │   \* Crusader Kings III  
                             │  
Low Player ──────────────────┼────────────────── High Player  
Direct Agency                │                   Direct Agency  
                             │   \* Traditional Chess  
                             │   \* Fire Emblem  
                             │  
                             │  
                     Low Systemic Autonomy

### **2.1 Comparative Game Analysis & Design Lessons**

| Reference Game | Core Agent Mechanic | Lesson for Living Chess |
| :---- | :---- | :---- |
| **Close Combat: A Bridge Too Far (Market Garden)** | Units experience real-time psychological stress, suppression, panic, and refusal to advance under fire. | Direct autocratic orders fail when unit self-preservation overrides command authority; fear and morale dictate actual execution. |
| **Majesty: The Fantasy Kingdom Sim** | Flag bounties; heroes act on personal priorities (greed, fear). | Players cannot force actions directly without considering unit motivation; incentives must align with piece personality. |
| **Crusader Kings III** | Vassal opinion, personality traits (Greedy, Ambitious, Craven), Stress threshold. | Complex personalities can be reduced to 3–4 core traits that weight mathematical utility functions. |
| **RimWorld** | Mood meters, mental breaks (pyromania, catatonia, desertion) under extreme distress. | Traumatic events (e.g., witnessing sacrifices) accumulate into "Psychic Stress" or "Betrayal Score," triggering mutiny. |
| **King of Dragon Pass** | Council of advisors with conflicting agendas and partial wisdom. | The UI must display piece advice cleanly without overwhelming the chess board. |

### **2.2 Leadership & Organizational Psychology Model**

Drawing from team dynamics in high-stakes academic, government, and corporate environments, *Living Chess* models the failure modes of **Directive Leadership**:

1. **The Directive Fallacy:** Authoritarian commanders treat team members as interchangeable resources. When self-interest, safety, or ethics are threatened, direct commands do not yield enthusiastic execution—they yield passive resistance, malicious compliance, or complete paralysis.  
2. **Departmental & Class Silos:** In organizations, elite units (e.g., Rooks/Queens or Senior Leadership) often discount the contributions of frontline operators (e.g., Pawns or junior staff). Real cultural transformation occurs when leadership facilitates cross-class protection and witnesses frontline sacrifice, breaking down elitist silos.  
3. **The "Firing" / Commodity Paradox:** Threatening to discard or "fire" uncooperative pieces disengages them completely. Furthermore, removing uncooperative pieces signals to the remaining roster that leadership views them as disposable commodities, causing systemic decay in baseline trust (`⟦image3⟧`) and inducing defensive self-preservation across all pieces.  
4. **Psychological Safety vs. Risk Transfer:** Sustainable team performance requires mutual investment. Asking a piece to take a strategic sacrifice requires prior build-up of trust, shared victory rewards, and demonstration of leader competence.

### **2.3 Product Positioning & Target Audience**

* **Primary Persona:** Strategy & Indie RPG Enthusiasts (*RimWorld*, *Crusader Kings*, *Close Combat*, *Inscryption* fans) who enjoy emergent narrative and non-traditional chess variants.  
* **Secondary Persona:** Leadership & Organizational Development (Corporate training, executive leadership labs, team dynamics simulations).  
* **Core Hook:** *"Can you lead a team to victory when sacrifice hurts, trust is earned, Rooks hold Pawns in contempt, and treating your team as disposable commodities leads to mutiny?"*

### **2.4 "Welcome to the World" Audience Onboarding Guides**

Depending on the distribution channel or player onboarding track, *Living Chess* presents tailored player manuals and operational guides:

#### **Track A: Indie RPG & Dark Strategy Player Manual**

> **WELCOME TO THE BOARD, COMMANDER.**

> You hold absolute command over the board—or so you believe. The sixteen souls under your order are not mindless wooden automata. They possess memory, fear, class arrogance, and individual bonds.

* **Rule 1: Sacrifice Has a Cost.** Pawns will not willingly throw themselves into the fires of war for a commander who treats them as cannon fodder.  
* **Rule 2: Respect Piece Egos.** High-ranking Rooks and Queens bring master-level strategic vision, but they look down on Pawns and expect you to protect their prestige.  
* **Rule 3: Mutiny is Real.** Push piece trust below critical levels, and your orders will be met with quiet quitting, outright refusal, or board desertion. Lead wisely, or watch your army collapse from within.

#### **Track B: Executive Leadership Lab Participant Manual**

> **PARTICIPANT GUIDE: SIMULATED TEAM DYNAMICS LAB**

> Welcome to *Living Chess*, an experiential simulation designed to examine human behavior, team dynamics, and leadership efficacy under strategic pressure.

* **The Fallacy of Direct Orders:** Traditional management assumes perfect execution upon directive output. In this simulation, team members possess orthogonal utility functions (`⟦image4⟧`).  
* **Building Psychological Safety:** Asking high-performing team members to take calculated organizational risks requires prior deposits in the trust bank (`⟦image5⟧`).  
* **The Cost of Restructuring:** "Firing" or benching uncooperative members signals to surviving staff that they are disposable commodities, causing broad systemic disengagement.

#### **Track C: Traditional Chess Enthusiasts & AI Analyst Guide**

> **OPERATIONAL GUIDE: THE ENGINE-AUGMENTED PSYCHOLOGICAL VARIANT**

> *Living Chess* layers agent psychology onto standard FEN chess rules.

* **Variable Compute Allocation:** Pieces act as independent Stockfish WASM evaluators. Veteran, high-morale pieces calculate move lines up to depth 16\. Distrusted or novice pieces evaluate at depth 2–4.  
* **Advisory Quality:** Pieces offer move advice during your turn. High-trust pieces recommend winning lines; disgruntled pieces may recommend flawed or self-serving moves.  
* **Objective Balance:** Winning requires balancing traditional tactical accuracy with team morale preservation.

#### **Track D: Behavioral Game Theory Experimental Field Guide**

> **EXPERIMENTAL PROTOCOL: MULTI-AGENT ORTHOGONAL UTILITY SIMULATION**

> This simulation examines multi-agent decision-making in non-zero-sum environments with asymmetric information distribution.

* **Principal-Agent Friction:** The human player acts as Principal seeking global utility (`⟦image1⟧`); pieces act as Agents maximizing local utility functions (`⟦image6⟧`).  
* **Class Prestige Matrices:** Inter-agent trust is governed by dyadic matrices (`⟦image7⟧`) and role class bias matrices (`⟦image8⟧`), dynamically updated via witnessed sacrifice events.

### **2.5 Visual Themes & Graphical Styles**

┌─────────────────────────────────────────────────────────────────────────┐  
│                     DYNAMIC GRAPHICAL THEME SYSTEM                      │  
├──────────────────┬──────────────────────┬───────────────────────────────┤  
│ Theme Name       │ Target Audience      │ Visual Aesthetic              │  
├──────────────────┼──────────────────────┼───────────────────────────────┤  
│ Dark Fantasy     │ Indie / RPG Gamers   │ Gothic woodcut, grim portraits│  
│ Executive Lab    │ Corporate / EdTech   │ Glassmorphism, telemetry UI   │  
│ Tournament Classic│ Chess Purists        │ Minimalist Staunton \+ rings   │  
│ Tactical Blueprint│ Academics / Theorists│ Scientific grid, vector nodes │  
└──────────────────┴──────────────────────┴───────────────────────────────┘

1. **Dark Fantasy / Woodcut (Default Indie Theme):** High-contrast gothic woodcut textures, parchment board, expressive piece portraits showing fear, rage, or loyalty, and speech bubbles with grim dialog.  
2. **Executive Command Center (Corporate / EdTech Theme):** Dark-mode glassmorphic interface, clean slate board grid, subtle neon accents, and dashboard telemetry overlays showing real-time *Engagement Factors* (`⟦image9⟧`) and *Trust Indices*.  
3. **Tournament Minimalist (Chess Purist Theme):** Standard clean Staunton piece set with subtle aura rings around pieces indicating morale and trust level, plus non-intrusive engine evaluation depth overlays.  
4. **Tactical Blueprint (Game Theory / Academic Theme):** Monochromatic blueprint grid, vector topology lines, and mathematical breakdown panels displaying real-time personal utility calculations (`⟦image6⟧`).

### **2.6 Narrator Broadcasts, Match Audits & Campaign Debrief Model**

1. **Pre-Game Narrator / Sports Announcer:** Analyzes roster history, highlights lingering grudges or high-trust dynamics from previous matches, and sets the stakes before move 1\.  
2. **Single-Match Post-Game Leadership Briefing:** Triggers immediately following match completion, evaluating tactical leadership style and key pivotal turning points.  
3. **Multi-Match Campaign Leadership Debrief & Training Aid:** Triggers after completing a multi-game tournament or training campaign (5–20 matches). Conducts a longitudinal analysis of organizational culture drift, team retention, cross-class synergy growth, and generates an executive leadership development action plan.

## **3\. Topographic Architecture & Scaling Strategy**

To minimize infrastructure overhead during initial deployment while enabling virality and long-term multiplayer ecosystems, *Living Chess* adopts a **Modular Hybrid Topology**.

┌──────────────────────────────────────────────────────────┐  
│                   CLIENT (WebAssembly / Electron)         │  
│  ┌─────────────────┐ ┌──────────────┐ ┌────────────────┐ │  
│  │ UI & Board Render│ │ Local State  │ │ WASM Stockfish │ │  
│  │ (Chessground/    │ │ Engine       │ │ (Multi-thread  │ │  
│  │  React UI)      │ │              │ │  Evaluator)    │ │  
│  └────────┬────────┘ └──────┬───────┘ └───────┬────────┘ │  
└───────────┼─────────────────┼─────────────────┼──────────┘  
            │                 │                 │  
            ▼                 ▼                 ▼  
┌──────────────────────────────────────────────────────────┐  
│            INTERMEDIATE AGENT LAYER (Local/Cloud)        │  
│  \- Psychological Evaluator (Utility Matrix calculation)   │  
│  \- Trait & Sentiment Resolver                            │  
│  \- Narrator, Single-Match & Campaign Debrief Orchestrator│  
│  \- LLM Prompt Orchestrator (Gemini 2.5 Flash API)        │  
└─────────────────────────────┬────────────────────────────┘  
                              │  
                              ▼  
┌──────────────────────────────────────────────────────────┐  
│              PERSISTENCE & CLOUD SYNC LAYER              │  
│  \- Local SQLite / IndexedDB (Offline-first play)        │  
│  \- Optional Firebase / Supabase Sync (Cloud Roster)     │  
└─────────────────────────────┬────────────────────────────┘

1. **Phase 1: Local Offline-First Engine (Standalone):** All state, engine calculations, and logic run client-side (IndexedDB \+ WebAssembly Stockfish). Zero central hosting costs per user.  
2. **Phase 2: Federated Roster Export/Import:** Players can export their unique piece set (cryptographically signed JSON schema) to challenge friends locally or via P2P.  
3. **Phase 3: Centralized Ladder & Cloud Sync (Scale Up):** Unified global matchmaking and anti-cheat servers introduced only when active user metrics justify hosting infrastructure.

## **4\. Game Mechanics & Mathematical Specification**

### **4.1 Piece Personality, Trait & Affinity Model**

Every piece `⟦image10⟧` possesses an immutable ID, a persistent history vector, dynamic behavioral parameters, and an inter-piece relationship network:

* `⟦image11⟧``⟦image12⟧` **(Experience Level):** Determines baseline Stockfish search depth allocation.  
* `⟦image13⟧` **(Trust in Leader/Player):** Affected by sacrifice history, win rate under this leader, firing history of peers, and strategic competence.  
* `⟦image14⟧` **(Morale):** Current emotional stability and engagement level.  
* `⟦image15⟧` **(Betrayal / Grief Score):** Accumulated trauma from watching allies die, being placed in dangerous positions, or seeing peers benched/discarded.  
* `⟦image16⟧` **(Dyadic Affinity Vector):** Piece `⟦image10⟧`'s specific trust/bond with individual piece `⟦image17⟧`.  
* `⟦image18⟧` **(Class Bias Matrix):** Generic baseline attitude toward piece roles (e.g., Rook's default `⟦image19⟧`).

#### **Primary Trait Vectors (`⟦image20⟧`)**

* `⟦image21⟧`**:** Resistance to fear when threatened with capture.  
* `⟦image22⟧`**:** Desire to capture high-value enemy pieces (`⟦image23⟧`).  
* `⟦image24⟧`**:** Weight placed on player trust vs. immediate self-preservation.  
* `⟦image25⟧`**:** Distress caused when neighboring friendly pieces are captured or discarded.  
* `⟦image26⟧`**:** Sensitivity to class rank; high values amplify contempt for lower-tier roles.

### **4.2 Search Engine & Insight Allocation Formula**

A piece's strategic vision is determined by its Experience `⟦image27⟧` modified by its current Engagement State (`⟦image28⟧`):

`⟦image29⟧`*Where `⟦image30⟧` (short-sighted tactical vision), `⟦image31⟧` (master-level depth), and `⟦image32⟧` represents engagement level (disengaged pieces throttle their engine compute time).*

### **4.3 Move Utility & Mutiny Threshold (Incorporating Peer Bonds)**

When the player selects a move `⟦image33⟧` for piece `⟦image10⟧`, the system calculates the piece's **Personal Utility** `⟦image6⟧`, factoring in both self-preservation and the safety of beloved or respected peers:

`⟦image34⟧`Where the **Inter-Piece Protection Term** `⟦image35⟧` is defined as:

* `⟦image36⟧``⟦image37⟧`: How move `⟦image33⟧` changes the capture probability of peer `⟦image17⟧`.  
* If move `⟦image33⟧` exposes a loved or respected peer `⟦image17⟧` (`⟦image38⟧`), `⟦image6⟧` drops significantly, triggering move refusal to protect the peer.  
* If move `⟦image33⟧` exposes a peer `⟦image10⟧` holds in contempt (`⟦image39⟧`), `⟦image10⟧` expresses indifference or satisfaction.

### **4.4 Spectrum of Disengagement & Mutiny**

Instead of binary pass/fail obedience, piece resistance follows a realistic spectrum of organizational feedback:

    High Trust (T\_i \> 50\)         ──►  Enthusiastic Execution (Shares full Stockfish insights, offers proactive advice)  
    Moderate Trust (0 \< T\_i \<= 50\) ──►  Compliant Execution (Performs move, standard dialogue)  
    Low Trust (-50 \< T\_i \<= 0\)    ──►  Quiet Quitting / Malicious Compliance (Obeys order, but throttles search depth η\_i \-\> 0.2)  
    Critical Trust (-80 \< T\_i \<= \-50) ──► Active Refusal (Rejects move, demands alternative plan)  
    Extreme Distress (T\_i \<= \-80, M\_i \= 0\) ──► Desertion / Mutiny (Leaves board or defects to enemy)

1. **Quiet Quitting / Malicious Compliance (`⟦image6⟧` marginally negative):** The piece executes the move, but reduces engagement factor `⟦image40⟧`. It withholds deeper strategic calculations from the player and generates cynical dialogue.  
2. **Protest / Refusal Stage (`⟦image41⟧`):** Piece refuses to move to the targeted square. The player loses their turn or must select a compliant piece.  
3. **Desertion Stage (`⟦image42⟧` and `⟦image43⟧`):** Piece steps off the board or defects to the opponent side ("Mutiny").

### **4.5 Dyadic Affinity, Class Bias & Witnessed Sacrifice Mechanics**

Relationships between pieces are dynamic and evolve during gameplay through witnessed tactical events:

┌─────────────────────────────────────────────────────────────────────────┐  
│                        WITNESSED EVENT ENGINE                           │  
│                                                                         │  
│  \[ Pawn Sacrifice Observed \]                                            │  
│  \- Pawn P\_p captured while protecting Rook P\_r or creating win vector. │  
│                                                                         │  
│  ┌───────────────────────────────────┐ ┌─────────────────────────────┐  │  
│  │ Individual Dyadic Shift           │ │ Generic Class Shift         │  │  
│  │ A\_{r,p} \+= \+50 (Gratitude/Bond)   │ │ C\_{Rook,Pawn} \+= \+15        │  │  
│  └───────────────────────────────────┘ │ (Class Perception Shift)    │  │  
│                                        └─────────────────────────────┘  │  
└─────────────────────────────────────────────────────────────────────────┘

### **4.6 The "Firing / Bench" Roster Penalty Mechanics**

When a player permanently benches or discards ("fires") a piece `⟦image44⟧` from their persistent roster:

1. **Individual Betrayal Impact:** The fired piece's trust drops to `⟦image45⟧`.  
2. **Systemic Roster Decay:** Every remaining piece `⟦image17⟧` on the player's active roster suffers a trust penalty proportional to their empathy and closeness to `⟦image44⟧`:

### **`⟦image46⟧`4.7 Single-Match Leadership Audit Metrics**

### **`⟦image47⟧`4.8 Campaign-Level Leadership Debrief & Longitudinal Training Aids**

When playing across a campaign of multiple matches (e.g., 5 to 20 matches), the engine tracks the **Longitudinal Team Culture Drift Vector** `⟦image48⟧`:

`⟦image49⟧`┌─────────────────────────────────────────────────────────────────────────┐  
│                    CAMPAIGN DEBRIEF ENGINE LOGIC                        │  
├─────────────────────────────────────────────────────────────────────────┤  
│  Input: Match Histories \#1..N, Roster Telemetry, Firing Logs            │  
│  Calculates:                                                            │  
│    \- Roster Retention Rate & Turnover Cost                              │  
│    \- Cultural Drift Vector (Class Contempt vs. Class Solidarity)        │  
│    \- Leadership Growth Trajectory (Autocratic \-\> Transformational)      │  
│  Generates:                                                             │  
│    \- Campaign Executive Report Card                                     │  
│    \- Actionable Leadership Development Coaching Recommendations         │  
└─────────────────────────────────────────────────────────────────────────┘

#### **Campaign Leadership Archetypes**

1. **Sustained Transformational Leader:** High overall win rate (`⟦image50⟧`) paired with positive longitudinal trust growth (`⟦image51⟧`), near-zero roster turnover, and complete breakdown of class contempt (`⟦image52⟧`).  
2. **High-Attrition Exploitative Leader:** Short-term match wins achieved at the cost of high roster turnover (`⟦image53⟧` pieces benched/fired), creating a climate of fear where surviving pieces operate under quiet quitting (`⟦image54⟧`).  
3. **Volatile Autocratic Leader:** Alternates between brilliant tactical wins and catastrophic mutinies caused by arbitrary sacrifices without prior trust-building.  
4. **Protective Servant Leader:** Maintains near 100% piece trust and zero turnover, but exhibits lower win rates due to hesitation when necessary tactical sacrifices are required.

## **5\. System Architecture & Technical Stack**

   ┌────────────────────────────────────────────────────────────┐  
   │                     PRESENTATION LAYER                     │  
   │  \- React 18 / TypeScript                                   │  
   │  \- Chessground (Board visualizer & drag-and-drop input)   │  
   │  \- Dynamic Theme Provider (Gothic / Corporate / Classic)   │  
   │  \- Sentiment Overlay (EMG badges, speech bubbles, aura)    │  
   │  \- Post-Game Debrief & Campaign Debrief Dashboard UI       │  
   └─────────────────────────────┬──────────────────────────────┘  
                                 │  
                                 ▼  
   ┌────────────────────────────────────────────────────────────┐  
   │                     APPLICATION LOGIC                      │  
   │  \- Chess.js (Rules, move generation, FEN validation)       │  
   │  \- Stockfish.wasm (Worker pool managing piece search)      │  
   │  \- Psychological Engine (Utility, Trust, & Affinity Matrix)│  
   │  \- Match & Campaign Telemetry Logger                       │  
   └─────────────────────────────┬──────────────────────────────┘  
                                 │  
                                 ▼  
   ┌────────────────────────────────────────────────────────────┐  
   │                   LLM DIALOGUE ORCHESTRATOR                │  
   │  \- Fast Path: Pre-baked template strings for common moves  │  
   │  \- Slow Path: Gemini 2.5 Flash / Claude Haiku API          │  
   │  \- Narrator, Match Audit & Campaign Debrief Generators     │  
   └────────────────────────────────────────────────────────────┘

### **5.1 Tech Stack Justification**

* **Frontend Framework:** React 18 \+ Tailwind CSS \+ TypeScript.  
* **Board Library:** chessground (Open-source, powers Lichess, highly performant UI).  
* **Chess Engine:** stockfish.wasm running inside web workers.  
* **Local Persistence:** dexie.js (IndexedDB wrapper) for storing piece rosters, game history, and loyalty/affinity matrices offline.  
* **LLM Integration:** Google Gemini 2.5 Flash API (high speed, structured JSON mode, cost-effective).

### **5.2 Dynamic Design Token System**

type ThemeStyle \= 'dark-fantasy' | 'corporate-lab' | 'tournament-classic' | 'tactical-blueprint';

interface VisualThemeTokens {  
  id: ThemeStyle;  
  boardBg: string;  
  pieceStyle: 'woodcut' | 'minimal-vector' | 'staunton' | 'schematic';  
  dialogueStyle: 'gothic-bubble' | 'telemetry-toast' | 'sidebar-feed' | 'blueprint-callout';  
  announcerPersona: 'war-herald' | 'lab-facilitator' | 'esports-broadcaster' | 'system-telemetry';  
  showAuraRings: boolean;  
  showRiskHeatmap: boolean;  
}

## **6\. LLM Integration & Agent Subsystem Design**

### **6.1 Hybrid Dialogue Pipeline**

\[ Match Start Event \]              \[ Player Action \]             \[ Campaign End Event \]  
          │                                │                              │  
          ▼                                ▼                              ▼  
\[ Narrator Announcer Engine \]    \[ Psychological Engine \]      \[ Campaign Debrief Engine \]  
 Generates pre-game intro         Calculates U(P\_i, m),          Summarizes longitudinal growth,  
 based on team history &          refusals, & piece chat.        cultural drift & generates  
 active theme (Gemini 2.5)                                       leadership coaching plan.

### **6.2 Structured LLM System Prompt Schema (Piece Dialogue)**

{  
  "system\_prompt": "You are a living chess piece in a strategy game. Adapt tone to active theme profile. Respond in 1-2 short sentences.",  
  "active\_theme": "dark-fantasy",  
  "piece\_profile": {  
    "role": "Rook",  
    "name": "Aethelgard",  
    "traits": \["Arrogant", "Proud", "Prestige-Focused"\],  
    "trust\_in\_player": 10,  
    "class\_bias\_towards\_pawns": 15,  
    "dyadic\_bonds": {  
      "Pawn\_B2": {"affinity": 65, "status": "Saved my rank in Game \#2"}  
    }  
  },  
  "current\_situation": {  
    "proposed\_move": "Ra4",  
    "witnessed\_event": "Pawn\_B2 sacrificed self to block enemy Bishop",  
    "verdict": "CLASS\_PERSPECTIVE\_SHIFT"  
  }  
}

### **6.3 Narrator / Sports Announcer Prompt Schema (Pre-Game)**

{  
  "system\_prompt": "You are the lead match commentator for Living Chess. Adapt your tone to the active theme. Provide a captivating 2-3 sentence pre-game breakdown highlighting team morale, key rivalries, and player history.",  
  "active\_theme": "tournament-classic",  
  "announcer\_persona": "esports-broadcaster",  
  "match\_context": {  
    "match\_number": 5,  
    "player\_rating": 1450,  
    "team\_trust\_avg": \-12,  
    "key\_roster\_facts": \[  
      "Rook Aethelgard is still angry about the pawn sacrifice in Match \#3",  
      "Pawn\_B2 has highest trust (+60) after being protected last game",  
      "Roster has experienced 1 benching/firing recently"  
    \]  
  }  
}

### **6.4 Single-Match Post-Game Debrief Prompt Schema**

{  
  "system\_prompt": "You are an executive leadership coach and game analyst. Analyze the provided match telemetry log and generate a structured 3-part debrief: 1\) Leadership Style Assessment, 2\) Key Relational Turning Point, 3\) Actionable Takeaway for the next match.",  
  "match\_telemetry": {  
    "match\_result": "VICTORY\_BY\_CHECKMATE",  
    "total\_turns": 32,  
    "quiet\_quitting\_turns": 4,  
    "refusal\_events": 1,  
    "sacrificed\_pieces": \["Pawn\_A2", "Pawn\_B2", "Knight\_G1"\],  
    "trust\_delta\_avg": \+18,  
    "class\_bias\_shift": "Rook\_Pawn\_Contempt\_Reduced\_By\_25"  
  }  
}

### **6.5 Campaign-Level Leadership Debrief & Training Aid Prompt Schema**

{  
  "system\_prompt": "You are an executive leadership consultant summarizing a 10-match leadership campaign simulation. Generate an executive training debrief detailing: 1\) Overall Leadership Archetype, 2\) Longitudinal Culture Drift Analysis, 3\) Team Retention & Turnover Impact, and 4\) Three Strategic Coaching Action Items for real-world application.",  
  "campaign\_telemetry": {  
    "total\_matches": 10,  
    "campaign\_wins": 7,  
    "campaign\_losses": 3,  
    "initial\_avg\_trust": \-5,  
    "final\_avg\_trust": \+42,  
    "roster\_turnover\_count": 1,  
    "mutiny\_count": 0,  
    "quiet\_quitting\_total\_turns": 14,  
    "class\_bias\_delta": {  
      "Rook\_Pawn\_Contempt": \-45,  
      "Knight\_Pawn\_Solidarity": \+30  
    },  
    "key\_milestones": \[  
      "Match \#2: Rook Aethelgard quiet quitted during critical defense line",  
      "Match \#4: Heroic Pawn B2 sacrifice shifted team culture",  
      "Match \#7: Player protected veteran Knight under heavy attack, solidifying trust"  
    \]  
  }  
}

#### **Sample Campaign Debrief Output:**

> **EXECUTIVE CAMPAIGN DEBRIEF: 10-MATCH LEADERSHIP SIMULATION**

* **Primary Leadership Archetype:** *Sustained Transformational Leader (Growth Trajectory).*  
* **Longitudinal Team Culture Drift:** Over the course of 10 matches, your team evolved from a fragmented, low-trust collective (`⟦image55⟧`) into a highly aligned unit (`⟦image56⟧`). The turning point occurred in Match \#4, where your willingness to acknowledge frontline Pawn contributions broke down historical class contempt in your senior Rooks (`⟦image57⟧`).  
* **Retention & Turnover Audit:** Roster retention stood at **90%** (1 replacement). Minimal quiet quitting was observed in the final 5 matches, unlocking consistent depth 14–16 Stockfish strategic foresight.  
* **Executive Coaching Takeaways for Real-World Application:**  
  1. *Silo Reduction:* Recognizing frontline achievements directly dissolves arrogance in senior individual contributors.  
  2. *Retention Benefits:* Avoiding arbitrary dismissals preserves historical organizational memory and keeps baseline trust high.  
  3. *Risk Equity:* When demanding high-risk execution, ensure team members understand the strategic vision rather than feeling exploited.

## **7\. Simulation & Self-Play Testing Harness**

To solve the balancing problem raised in the notes (preventing runaway winning feedback loops, pay-to-win dynamics, or early game deadlocks), the system includes a **Headless Automated Test Harness**.

┌──────────────────────────────────────────────────────────────┐  
│                  HEADLESS SIMULATION ENGINE                  │  
│                                                              │  
│  ┌────────────────────────┐      ┌────────────────────────┐  │  
│  │ AI Leader A            │      │ AI Leader B            │  │  
│  │ (Style: Tyrannical)    │      │ (Style: Supportive)    │  │  
│  └───────────┬────────────┘      └───────────┬────────────┘  │  
│              │                               │               │  
│              ▼                               ▼               │  
│  ┌────────────────────────────────────────────────────────┐  │  
│  │  1,000 Self-Play Matches (Chess.js \+ WASM Stockfish)   │  │  
│  └───────────────────────────┬────────────────────────────┘  │  
│                              │                               │  
│                              ▼                               │  
│  ┌────────────────────────────────────────────────────────┐  │  
│  │ Metrics Collected:                                     │  │  
│  │ \- Quiet Quitting Rate % vs. Leadership Style            │  │  
│  │ \- Longitudinal Culture Drift Vector across 20-game campaigns │  
│  │ \- Mutiny Rate % vs. Player Rating                      │  │  
│  │ \- Campaign Debrief Leadership Index Distribution       │  │  
│  └────────────────────────────────────────────────────────┘  │  
└──────────────────────────────────────────────────────────────┘

## **8\. Developer Implementation Roadmap & Task Hierarchy**

### **Phase 1: Core Engine & Identity Infrastructure**

* \[ \] Task 1.1: Implement PieceInstance data models, DyadicAffinityMatrix, and IndexedDB schema using Dexie.js.  
* \[ \] Task 1.2: Integrate chess.js and chessground into a clean React wrapper.  
* \[ \] Task 1.3: Instantiate multi-worker Stockfish WebAssembly integration with adjustable depth parameters (`⟦image58⟧`).

### **Phase 2: Psychological Engine & Trait Logic**

* \[ \] Task 2.1: Write the utility evaluation function `⟦image6⟧` combining board evaluation, personal risk, loyalty vectors, and inter-piece protection term `⟦image35⟧`.  
* \[ \] Task 2.2: Implement the Refusal, Quiet Quitting, and Mutiny state machines in the main move-validation pipeline.  
* \[ \] Task 2.3: Build Witnessed Sacrifice event listeners that update Dyadic Affinity `⟦image59⟧` and Class Bias `⟦image60⟧` dynamically.

### **Phase 3: Dialogue, Narrator, Debrief & Onboarding UX Interface**

* \[ \] Task 3.1: Build UI badges, morale gauges, relationship indicators, and class bias overlay for pieces on the board overlay.  
* \[ \] Task 3.2: Implement the Fast-Path deterministic template dialogue generator with relationship awareness.  
* \[ \] Task 3.3: Integrate Gemini 2.5 Flash API connectors for Piece Chat, Pre-Game Narrator Announcer, Single-Match Debrief, and Campaign Debrief.  
* \[ \] Task 3.4: Build the Visual Theme Switcher (dark-fantasy, corporate-lab, tournament-classic, tactical-blueprint) and dynamic token provider.  
* \[ \] Task 3.5: Build the "Welcome to the World" Onboarding Manual views for each persona track.  
* \[ \] Task 3.6: Implement the Single-Match Debrief and Campaign Debrief Modal UI with longitudinal team culture charts and leadership style badge.

### **Phase 4: Headless Simulation & Parameter Tuning**

* \[ \] Task 4.1: Construct the headless CLI simulation script (node sim/run\_sim.js \--matches=1000).  
* \[ \] Task 4.2: Calibrate `⟦image61⟧`, class bias shift velocity (`⟦image62⟧`), and campaign leadership scoring parameters to achieve rich emergent narrative shifts across games.
