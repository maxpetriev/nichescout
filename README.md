# NicheScout

**AI-powered market research for solopreneurs** — find trending niches, validate ideas, and get a full GTM strategy in minutes.

NicheScout is a macOS desktop app that sends autonomous AI agents into X (Twitter) and Reddit to scrape real conversations, then synthesises the signal into a structured research report: hypothesis, ICP profile, and go-to-market strategy.

---

## Screenshots

> _Home screen — enter your research prompt_

![Home](docs/screenshots/home.png)

> _Live research feed — watch agents plan, search, and collect in real time_

![Running](docs/screenshots/running.png)

> _Results — hypothesis, ICP profile, GTM strategy, supporting evidence_

![Results](docs/screenshots/results.png)

---

## How it works

Research runs in three phases, each powered by a different Claude model:

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1 · Plan         claude-opus-4-7                     │
│  Reads your prompt, designs a targeted search strategy      │
│  Outputs: list of X queries + Reddit subreddits to hit      │
├─────────────────────────────────────────────────────────────┤
│  Phase 2 · Collect      claude-sonnet-4-6  (6× cheaper)     │
│  Executes every search via a real Chrome browser            │
│  Bypasses bot detection with a persistent Chrome profile    │
│  Collects raw posts from X and Reddit                       │
├─────────────────────────────────────────────────────────────┤
│  Phase 3 · Synthesise   claude-opus-4-7                     │
│  Reads all collected posts                                  │
│  Produces a structured JSON report via tool-calling         │
└─────────────────────────────────────────────────────────────┘
```

The result is a structured report with:

| Section | What you get |
|---|---|
| **Hypothesis** | One-sentence thesis + confidence rating (low / medium / high) |
| **ICP Profile** | Who they are, pain points, channels, budget, exact vocabulary |
| **GTM Strategy** | Positioning, top channel, launch move, 2-week validation test, timeline |
| **Supporting Trends** | Recurring themes pulled from the data |
| **Evidence** | Hand-picked posts with explanations of why each matters |

---

## Tech stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 33 |
| UI | React 19 + Tailwind CSS v4 |
| Build | electron-vite + Vite 5 |
| AI | Anthropic SDK (`claude-opus-4-7` + `claude-sonnet-4-6`) |
| Browser automation | Playwright (persistent Chrome profile) |
| Credential storage | Electron `safeStorage` (macOS Keychain) |
| Language | TypeScript (strict) |

---

## Setup

### Prerequisites

- macOS (uses Keychain for credential encryption)
- Node.js 20+
- Google Chrome installed (`playwright` uses `channel: 'chrome'`)
- Anthropic API key

### Install

```bash
git clone https://github.com/maxpetriev/nichescout.git
cd nichescout
npm install
```

### Configure

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

### Run the desktop app

```bash
npm run dev
```

On first launch, the app opens the **Settings** screen. Enter your X (Twitter) credentials and save — they're encrypted in your macOS Keychain and never leave your machine.

> **Note:** on first run, a Chrome window will open so you can complete the X login manually. After that, the session is cached in `.chrome-profile/` and login is automatic.

---

## CLI mode

You can also run research headlessly from the terminal:

```bash
npm run cli "what's going on in AI agent infra right now"
# or target both platforms:
npm run cli "productivity tools for remote teams" both
```

Output is saved to `traces/` (raw log) and `digests/` (markdown report).

---

## Project structure

```
electron/
  main/index.ts        # Electron main process — IPC, credentials, agent runner
  preload/index.ts     # Context bridge — exposes window.api to renderer

lib/
  agent.ts             # All agent logic — three-phase loop, browser tools
  types.ts             # Shared types (AgentEvent, ResearchResult)

src/renderer/src/
  App.tsx              # View state machine (home → running → results → settings)
  views/
    Home.tsx           # Prompt input + platform toggles
    Running.tsx        # Live activity feed + phase indicator
    Results.tsx        # Hypothesis, ICP, GTM, evidence cards
    Settings.tsx       # Credential management

run.ts                 # CLI entrypoint
```

---

## Architecture notes

**Bot detection bypass** — X aggressively blocks Playwright's default fingerprint. The agent uses a persistent Chrome profile (`chromium.launchPersistentContext`), disables `AutomationControlled` flags, and masks `navigator.webdriver`. Once logged in manually the first time, the session cookie is reused forever.

**Cost optimisation** — Phase 2 (the expensive, repetitive search loop) runs on `claude-sonnet-4-6` which is ~6× cheaper than Opus. Only planning and synthesis — where reasoning quality matters — use `claude-opus-4-7`.

**Streaming events** — The agent emits typed `AgentEvent` objects as it runs. In Electron mode these flow over IPC (`webContents.send`) to the React renderer, driving the live activity feed.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `X_USERNAME` | No | Loaded from saved credentials at runtime |
| `X_PASSWORD` | No | Loaded from saved credentials at runtime |

---

## License

MIT
