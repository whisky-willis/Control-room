# Control Room

**Workday for AI Agents** — an open-source dashboard to manage, monitor, and visualize your AI agent workforce.

![Control Room Dashboard](https://via.placeholder.com/1200x600/6366f1/ffffff?text=Control+Room+Dashboard)

## Features

- **Agent Directory** — Browse all your AI agents in a Workday-style grid with profiles
- **Agent Profiles** — Each agent has a profile page showing their role, responsibilities, skills, tools, and compensation
- **Compensation Tracking** — Token usage and estimated cost per agent (input/output breakdown)
- **Workflow Graph** — Interactive visualization of how agents interact with each other using React Flow
- **Auto-Discovery** — Scans your project for Claude agents (`.claude/agents/*.md`), OpenAI assistants, LangChain configs, and more
- **API Log Import** — Import Anthropic or OpenAI usage CSV/JSON exports to populate real cost data
- **GitHub Pages Deploy** — One-click deploy to a free static site via GitHub Actions

## Quickstart

```bash
# 1. Clone the repository
git clone https://github.com/whisky-willis/Control-room.git
cd Control-room

# 2. Install dependencies
npm install

# 3. Scan your project for agents (generates src/data/agents.json)
npm run scan

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Edit `control-room.config.json` in the root of your project:

```json
{
  "scanPaths": ["."],
  "defaultModel": "claude-sonnet-4-6",
  "agents": {
    "my-agent-id": {
      "role": "Custom Role Override",
      "compensation": {
        "inputTokens": 500000,
        "outputTokens": 150000
      }
    }
  },
  "workflows": [
    {
      "id": "my-pipeline",
      "name": "My Pipeline",
      "description": "Description of what this workflow does",
      "agents": ["agent-one", "agent-two"],
      "edges": [
        { "from": "agent-one", "to": "agent-two", "label": "passes output" }
      ]
    }
  ]
}
```

## Importing API Usage Logs

### Anthropic Console
1. Go to [console.anthropic.com](https://console.anthropic.com) → Usage → Export CSV
2. Run: `npm run import-usage -- --file usage.csv`

### OpenAI Platform
1. Go to [platform.openai.com](https://platform.openai.com) → Usage → Export
2. Run: `npm run import-usage -- --file usage.json --format openai`

### Target a specific agent
```bash
npm run import-usage -- --file usage.csv --agent my-agent-id
```

## Supported Agent Formats

| Format | Detection |
|--------|-----------|
| Claude sub-agents | `.claude/agents/*.md` with frontmatter |
| Claude main config | `CLAUDE.md` |
| OpenAI assistants | `openai-assistants.json` |
| LangChain agents | `*.agent.yaml` or `*.agent.yml` |
| Generic | Any `.md` with `agent: true` frontmatter |

### Claude Agent Format

```markdown
---
name: My Agent
description: What this agent does
model: claude-sonnet-4-6
tools:
  - web_search
  - read_file
---

You are an expert at...

## Responsibilities
- Task one
- Task two
```

## Deploy to GitHub Pages

1. Push your repo to GitHub
2. Go to **Settings → Pages** and set source to **GitHub Actions**
3. Push to `main` — the workflow builds and deploys automatically

Your dashboard will be live at `https://<username>.github.io/<repo-name>/`

## Tech Stack

- [Next.js 14](https://nextjs.org) with App Router (static export)
- [TypeScript](https://typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [React Flow](https://reactflow.dev) for workflow graphs
- [Recharts](https://recharts.org) for token usage charts
- [gray-matter](https://github.com/jonschlinkert/gray-matter) for frontmatter parsing

## License

MIT
