# Control Room

**Workday for AI Agents** — open-source dashboard to manage, monitor, and visualize your AI agent workforce.

## Quickstart

Navigate to any project that contains AI agents and run:

```bash
cd my-project-with-agents
npx github:whisky-willis/Control-room
```

That's it. Control Room will:
1. Scan your directory for agents
2. Start a local dashboard at `http://localhost:3000`
3. Open your browser automatically

No config file needed. No setup. It just works.

### Getting the latest version

`npx` caches GitHub packages locally. If you've run Control Room before and want to pick up updates, clear the cache first:

```bash
rm -rf ~/.npm/_npx
npx github:whisky-willis/Control-room
```

---

## What it detects

| Format | Detected by |
|--------|-------------|
| Claude sub-agents | `.claude/agents/*.md` |
| Claude main config | `CLAUDE.md` |
| OpenAI assistants | `openai-assistants.json` |
| LangChain agents | `*.agent.yaml` / `*.agent.yml` |
| Generic agents | Any `.md` with `agent: true` frontmatter |

---

## What you get

### Dashboard
Overview with total agents, token usage, estimated cost, and active workflows.

### Agent Directory
Workday-style grid of all your agents — role, skills, model, and cost at a glance.

### Agent Profiles
Full profile per agent:
- **Core Responsibilities** — extracted from the system prompt
- **Compensation** — token usage breakdown (input/output) and estimated USD cost
- **Skills & Tools** — detected capabilities
- **Workflows** — which pipelines this agent participates in

### Workflow Graph
Interactive canvas showing how your agents connect and pass data to each other.

---

## Optional config

If you want to customize anything, add a `control-room.config.json` to your project root:

```json
{
  "scanPaths": ["."],
  "defaultModel": "claude-sonnet-4-6",
  "agents": {
    "my-agent": {
      "role": "Custom Role",
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
      "description": "What this workflow does",
      "agents": ["agent-one", "agent-two"],
      "edges": [
        { "from": "agent-one", "to": "agent-two", "label": "passes output" }
      ]
    }
  ]
}
```

Control Room will pick this up automatically on the next run.

---

## Import API usage logs

Populate real token/cost data from your API provider:

```bash
# Anthropic Console → Usage → Export CSV
npx github:whisky-willis/Control-room import --file usage.csv

# OpenAI Platform → Usage → Export
npx github:whisky-willis/Control-room import --file usage.json --format openai
```

---

## Deploy your own dashboard to GitHub Pages

To get a permanent shareable URL for your agent dashboard:

1. Fork this repo
2. Go to **Settings → Pages → Source: GitHub Actions**
3. Add your agents repo as a second checkout in `.github/workflows/deploy.yml`
4. Push to `main` — auto-deploys to `https://<you>.github.io/Control-room/`

---

## Agent file format (Claude)

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

---

## Tech stack

- [Next.js 14](https://nextjs.org) · TypeScript · Tailwind CSS
- [React Flow](https://reactflow.dev) for workflow graphs
- [Recharts](https://recharts.org) for token usage charts

## License

MIT
