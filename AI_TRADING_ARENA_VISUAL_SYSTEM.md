# AI Trading Arena --- Visual Design System

Version: 1.0\
Status: Source of truth for UI implementation\
Target: Next.js + Tailwind + shadcn/ui

## 1. Design Direction

Build the product as a **premium dark trading terminal for autonomous AI
agents**.

The visual reference is a sophisticated institutional trading
dashboard: - dark and restrained - dense with useful information -
highly legible - subtle borders and surfaces - green used for
positive/action states - minimal decoration - charts and data are the
visual focus - premium rather than "crypto neon"

Think: **Bloomberg × Linear × modern AI product**

Do NOT make it look like: - a generic crypto exchange - a gaming
dashboard - a cyberpunk/neon interface - a glassmorphism landing page -
an overly colorful analytics template

The interface should communicate: **Intelligent / Competitive / Minimal
/ Data-driven / Premium**

------------------------------------------------------------------------

## 2. Color System

Use these colors as the base design tokens.

### Backgrounds

``` css
--background: #0A0A0B;
--surface-1: #101011;
--surface-2: #151516;
--surface-3: #1A1A1C;
--surface-hover: #202022;
```

Hierarchy: - `#0A0A0B` --- application background - `#101011` --- main
cards / sidebar - `#151516` --- elevated cards - `#1A1A1C` --- nested
components - `#202022` --- hover / active surface

Avoid pure black (`#000000`) for large surfaces.

### Borders

``` css
--border: #262628;
--border-subtle: #1D1D1F;
--border-strong: #343438;
```

Borders should be subtle and thin.

Default:

``` css
border: 1px solid #262628;
```

Do not use heavy borders.

### Text

``` css
--text-primary: #F4F4F5;
--text-secondary: #A1A1AA;
--text-tertiary: #71717A;
--text-muted: #52525B;
```

Text hierarchy matters more than decoration.

### Green / Positive / Primary Action

``` css
--green: #A3E635;
--green-bright: #B7F76A;
--green-dark: #243D16;
--green-text: #A3E635;
```

Green is the primary accent.

Use it for: - BUY - positive returns - active status - successful
execution - primary CTA - bullish indicators - selected states - chart
lines / area fills

Do not flood the UI with green. It should feel valuable.

### Red / Negative

``` css
--red: #F87171;
--red-dark: #3A1919;
```

Use for: - SELL - losses - drawdown - rejected risk checks - errors -
bearish indicators

### Purple

``` css
--purple: #A78BFA;
--purple-dark: #241A3D;
```

Use sparingly for: - AI-related identity - agent avatars - reasoning /
intelligence events - secondary visual accent

### Orange / Warning

``` css
--orange: #F59E0B;
--orange-dark: #3A2910;
```

Use for: - warnings - elevated risk - pending states

### Blue

``` css
--blue: #60A5FA;
--blue-dark: #172A42;
```

Use only where semantic meaning requires it.

------------------------------------------------------------------------

## 3. Color Rules

### Important

Green should NOT mean "everything is good."

Green has specific semantic uses: - positive P&L - BUY - active -
executed - primary action

Red: - negative P&L - SELL - rejected - error

Purple: - AI / reasoning

Orange: - warning / elevated risk

Neutral: - HOLD - informational data - inactive states

Never introduce random accent colors for visual variety.

------------------------------------------------------------------------

## 4. Typography

Use **Inter** if available.

Fallback:

``` css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Type scale

``` css
--text-xs: 11px;
--text-sm: 12px;
--text-md: 14px;
--text-lg: 16px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 32px;
--text-4xl: 40px;
```

Weights: - 400 --- body - 500 --- labels - 600 --- headings / important
values - 700 --- hero metrics only

Avoid excessive bold text.

### Numbers

Financial numbers should feel precise and calm.

Use tabular numbers:

``` css
font-variant-numeric: tabular-nums;
```

Large financial values can use: - 24--32px - weight 600 - tight tracking

------------------------------------------------------------------------

## 5. Layout

Desktop-first dashboard.

Recommended max content width:

``` css
max-width: 1440px;
```

Sidebar:

``` css
width: 220px;
```

Top navigation:

``` css
height: 64px;
```

Main content:

``` css
padding: 32px;
```

Grid gap:

``` css
gap: 16px;
```

Use an 8px spacing system:

``` text
4px
8px
12px
16px
24px
32px
40px
48px
64px
```

Most UI spacing should use 8 / 12 / 16 / 24 / 32px.

------------------------------------------------------------------------

## 6. Border Radius

Keep corners relatively restrained.

``` css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 12px;
```

Recommended: - buttons: 7--8px - cards: 10px - large containers: 12px -
pills/status badges: 999px

Avoid overly rounded "friendly SaaS" cards.

------------------------------------------------------------------------

## 7. Cards

Cards should look like parts of one trading terminal, not floating glass
panels.

Default:

``` css
background: #101011;
border: 1px solid #262628;
border-radius: 10px;
```

Optional hover:

``` css
background: #151516;
border-color: #343438;
```

Do not use: - strong shadows - gradients everywhere - blur -
glassmorphism - huge corner radii

Elevation should come mostly from **surface color + border**, not
shadow.

------------------------------------------------------------------------

## 8. Buttons

### Primary

Green filled button:

``` text
background: #A3E635
color: #0A0A0B
```

Example: `Create Agent`

Use primary green buttons sparingly.

### Secondary

``` text
background: #151516
border: #262628
color: #F4F4F5
```

### Ghost

Transparent:

``` text
color: #A1A1AA
```

On hover:

``` text
background: #1A1A1C
color: #F4F4F5
```

Buttons should be compact and functional.

------------------------------------------------------------------------

## 9. Status Badges

Use compact pill badges.

### Active

``` text
background: #182712
color: #A3E635
```

With a small green dot.

### Paused

``` text
background: #202022
color: #A1A1AA
```

### Error

``` text
background: #3A1919
color: #F87171
```

### Executed

Green semantic styling.

### Analyzing

Neutral or purple styling with subtle animation.

Avoid huge status indicators.

------------------------------------------------------------------------

## 10. Navigation

Sidebar should be dark and quiet.

Structure:

``` text
AI TRADING ARENA

Arena
Agents
Research
Settings

────────────

Market
BTC
ETH
SOL
BNB
XRP
```

Active navigation item: - slightly lighter surface - subtle green
accent - green icon or indicator - white text

Inactive: - tertiary gray - no strong visual treatment

------------------------------------------------------------------------

# 11. Core Screens

## 11.1 Arena

This is the main screen.

Purpose: **Show the competition between autonomous agents.**

Hierarchy:

``` text
AI TRADING ARENA
Give AI $10,000. See what it does.

[Live Market]                         [Create Agent]

┌──────────────────────────────────────────────────┐
│  Active Agents   Total Equity   Best Return      │
│       4            $41,240         +18.4%        │
└──────────────────────────────────────────────────┘

LEADERBOARD

Rank | Agent | Strategy | Equity | Return | Drawdown | Trades | Status
```

The leaderboard is the hero content.

Agent rows should feel like competitors.

Use small agent avatars and strategy labels.

Do not make the homepage a giant marketing landing page.

------------------------------------------------------------------------

## 11.2 Agent Detail

Purpose: **Understand one AI trader.**

Header:

``` text
← Back to Arena

[Agent Avatar]
Momentum Alpha
Aggressive trend follower       ● Active

[Pause]
```

Primary metrics:

``` text
Equity       Return       Drawdown       Win Rate       Trades
$11,842      +18.4%       -3.1%          68.4%          24
```

Main chart: - equity curve - dark background - thin green line - very
subtle green area fill

Secondary sections: - Positions - Recent Trades - Decisions - Activity

The agent identity should be visually memorable but still professional.

------------------------------------------------------------------------

## 11.3 Live Activity

This is one of the most important product experiences.

The user should feel that the AI is **doing something right now**.

Use a vertical event timeline.

Example:

``` text
09:42:10   TRADE EXECUTED
           Bought $1,200 ETH @ $4,521

09:42:09   RISK CHECK
           Position size approved (12%)

09:42:07   DECISION
           BUY ETH · 78% confidence

09:42:04   NEWS
           Positive ETH sentiment detected

09:42:01   SIGNAL
           ETH momentum increasing

09:41:58   ANALYZING
           Scanning BTC, ETH, SOL, BNB, XRP
```

Event colors: - Analyzing → neutral / purple - Signal → green - News →
neutral - Decision → purple + semantic BUY/SELL color - Risk → neutral
or orange - Executed → green

Use subtle motion for live events.

Do not over-animate the interface.

------------------------------------------------------------------------

## 11.4 Decision / Trade Detail

This is the product's "wow" screen.

Header:

``` text
BUY ETH
$1,200.00
78% confidence

● Executed
```

Show exactly what the agent saw before making the decision.

Suggested tabs:

``` text
Overview
Market Data
Reasoning
Risk
Sources
```

### Trade Summary

``` text
Side             BUY
Asset            ETH
Amount           $1,200
Quantity         0.2633 ETH
Price            $4,521
Confidence       78%
Time Horizon     Short
Status           Executed
```

### Market Context

``` text
Price            $4,521       +3.8%
24h Change                     +3.8%
7d Change                      +8.2%
Volume                         $2.4B
Market Cap                     $543.2B
RSI                            67
MACD                           Bullish
EMA20 / EMA50                  Bullish
```

### Key Reasons

Use numbered concise reasons:

``` text
01  ETH has positive 7-day momentum.
02  Volume is increasing.
03  MACD remains bullish.
04  Broader market trend is positive.
```

### Risk Factors

Show the counterarguments too:

``` text
⚠ RSI is elevated.
```

The interface should make the decision understandable without exposing
hidden chain-of-thought.

------------------------------------------------------------------------

# 12. Charts

Charts should be minimalist.

Preferred: - thin lines - subtle grid - no chart junk - minimal axis
labels - tooltip on interaction - green for positive equity curves - red
for negative curves

Avoid: - rainbow charts - thick gradients - excessive gridlines - 3D
charts

Chart background should blend into the card.

------------------------------------------------------------------------

# 13. Tables

Tables are important because the product is data-heavy.

Use: - 12--13px text - generous vertical padding - subtle horizontal
separators - right-align financial numbers - tabular numerals - semantic
colors only where useful

Example:

``` text
AGENT             EQUITY       RETURN      DRAWDOWN    TRADES
Momentum Alpha    $11,842      +18.4%      -3.1%       24
News Hunter       $10,921       +9.2%      -5.4%       31
Contrarian        $10,421       +4.2%      -2.8%       17
Macro Mind         $9,842       -1.6%      -6.2%       28
```

------------------------------------------------------------------------

# 14. Agent Avatars

Agents need personality.

Keep avatars abstract and simple.

Possible visual language: - geometric symbol - subtle gradient -
abstract orb - small AI face/icon - strategy-specific glyph

Example:

``` text
Momentum Alpha → green / sharp geometric mark
News Hunter    → purple / signal mark
Contrarian     → red / inverted mark
Macro Mind     → orange / orbital mark
```

Do not turn agents into cartoon characters.

------------------------------------------------------------------------

# 15. Micro-interactions

The product should feel alive without becoming noisy.

Good: - live activity appearing at the top of the timeline - subtle
pulse on "Analyzing" - number transitions on P&L - chart updates -
status changes - row highlight when a trade executes - subtle hover
states

Avoid: - confetti - huge animations - bouncing cards - constant glowing
effects - excessive particle effects

------------------------------------------------------------------------

# 16. AI Personality

The AI should feel intelligent through **behavior and information**, not
fake conversational copy.

Prefer:

``` text
Analyzing market...
Signal detected
Evaluating risk...
Decision ready
Trade executed
```

Avoid:

``` text
🤖 OMG I FOUND A HUGE OPPORTUNITY!!!
```

The product should feel like a serious experiment.

------------------------------------------------------------------------

# 17. Copy Style

Tone: - intelligent - concise - factual - slightly editorial - confident
but not hype-driven

Examples:

Good: - `Scanning BTC, ETH, SOL, BNB, XRP` - `Momentum increasing` -
`Risk check passed` - `BUY ETH` - `78% confidence` -
`Position size approved` - `Decision replay`

Avoid: - `The AI is crushing it!` - `Moon mission` -
`100x opportunity` - `This coin is about to explode`

------------------------------------------------------------------------

# 18. Responsive Behavior

Desktop is the primary experience.

At smaller widths: - collapse sidebar - preserve key metrics - convert
multi-column cards into vertical stacks - keep tables horizontally
scrollable - keep decision information readable

Do not aggressively shrink typography.

------------------------------------------------------------------------

# 19. Accessibility

Maintain: - readable contrast - visible focus states - keyboard
navigation - semantic buttons - accessible labels - do not rely on color
alone for BUY/SELL/status

For example:

`BUY + green` should also have the text `BUY`.

------------------------------------------------------------------------

# 20. Implementation Rules for Cursor

When implementing this design system:

1.  Treat this file as the visual source of truth.
2.  Do not introduce arbitrary colors.
3.  Do not introduce gradients unless explicitly requested.
4.  Do not introduce glassmorphism.
5.  Do not use large shadows.
6.  Keep cards rectangular with restrained corner radii.
7.  Use green as the primary accent, not as a background everywhere.
8.  Keep the UI dense but breathable.
9.  Prefer borders and surface contrast over shadows.
10. Use tabular numbers for financial data.
11. Keep charts minimal.
12. Make AI activity feel alive through subtle state changes.
13. Keep copy concise.
14. Use semantic colors consistently.
15. Never make the UI look like a generic crypto casino.

## Tailwind Mapping

Approximate mapping:

``` text
bg-background     → #0A0A0B
bg-surface-1      → #101011
bg-surface-2      → #151516
bg-surface-3      → #1A1A1C

border-default    → #262628
border-subtle     → #1D1D1F
border-strong     → #343438

text-primary      → #F4F4F5
text-secondary    → #A1A1AA
text-tertiary     → #71717A
text-muted        → #52525B

text-positive     → #A3E635
bg-positive       → #182712

text-negative     → #F87171
bg-negative       → #3A1919

text-ai           → #A78BFA
bg-ai             → #241A3D

text-warning      → #F59E0B
bg-warning        → #3A2910
```

------------------------------------------------------------------------

# 21. Visual North Star

If a design decision is ambiguous, ask:

> Does this look like a premium terminal where autonomous AI agents are
> competing with real market data?

If yes → keep it.

If it feels like: - a crypto casino - a gaming UI - a generic SaaS
dashboard - a futuristic sci-fi interface

→ simplify it.

The product should feel **quiet, intelligent, competitive and
data-rich**.
