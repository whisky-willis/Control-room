#!/usr/bin/env tsx
/**
 * Control Room Agent Scanner
 * Scans directories for AI agent configs and writes src/data/agents.json
 *
 * Detects:
 * - Claude sub-agents: .claude/agents/*.md
 * - Claude main config: CLAUDE.md
 * - OpenAI assistant configs: openai-assistants.json / assistant_config.json
 * - LangChain: *.agent.yaml / langchain_config.yaml
 * - Generic: any .md with "agent:" frontmatter
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'
import matter from 'gray-matter'
import { calculateCost } from '../src/lib/model-pricing'
import { extractResponsibilities, extractSkills } from '../src/lib/extract-responsibilities'
import { getAvatarColor, slugify as _slugify } from '../src/lib/avatar-utils'
import type {
  Agent,
  AgentsData,
  ControlRoomConfig,
  Workflow,
  AgentSourceType,
} from '../src/lib/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function loadConfig(root: string): ControlRoomConfig {
  const configPath = path.join(root, 'control-room.config.json')
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as ControlRoomConfig
  }
  return { scanPaths: ['.'], defaultModel: 'claude-sonnet-4-6' }
}

function makeAgent(
  id: string,
  name: string,
  role: string,
  description: string,
  model: string,
  sourceFile: string,
  sourceType: AgentSourceType,
  systemPrompt: string,
  tools: string[] = [],
): Agent {
  const responsibilities = extractResponsibilities(systemPrompt)
  const skills = extractSkills(systemPrompt, tools)
  return {
    id,
    name,
    role,
    description,
    avatarColor: getAvatarColor(id),
    model,
    sourceFile,
    sourceType,
    systemPrompt,
    responsibilities,
    skills,
    tools,
    compensation: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUSD: 0,
      period: 'all-time',
    },
    workflowIds: [],
  }
}

// ─── parsers ──────────────────────────────────────────────────────────────────

function parseClaudeSubAgent(filePath: string, defaultModel: string): Agent | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)
    const name = (data.name as string) || path.basename(filePath, '.md')
    const id = slugify(name)
    const description = (data.description as string) || content.split('\n').find((l) => l.trim()) || ''
    const model = (data.model as string) || defaultModel
    const tools: string[] = Array.isArray(data.tools) ? data.tools : []
    const role = (data.role as string) || inferRole(name, content)

    return makeAgent(id, name, role, description, model, filePath, 'claude-subagent', content, tools)
  } catch {
    return null
  }
}

function parseClaudeMain(filePath: string, defaultModel: string): Agent | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)
    const name = (data.name as string) || 'Main Assistant'
    const id = slugify(name)
    const description = (data.description as string) || 'Primary Claude assistant configuration'
    const model = (data.model as string) || defaultModel

    return makeAgent(id, name, 'Main Assistant', description, model, filePath, 'claude-main', content)
  } catch {
    return null
  }
}

function parseOpenAIConfig(filePath: string, defaultModel: string): Agent[] {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const items = Array.isArray(raw) ? raw : [raw]
    return items
      .map((item: Record<string, unknown>) => {
        const name = (item.name as string) || 'OpenAI Assistant'
        const id = slugify(name)
        const model = (item.model as string) || defaultModel
        const instructions = (item.instructions as string) || ''
        const tools: string[] = Array.isArray(item.tools)
          ? (item.tools as Array<{ type?: string; function?: { name?: string } }>).map(
              (t) => t?.function?.name || t?.type || ''
            ).filter(Boolean)
          : []
        return makeAgent(
          id, name, inferRole(name, instructions), (item.description as string) || instructions.slice(0, 120),
          model, filePath, 'openai', instructions, tools
        )
      })
      .filter(Boolean) as Agent[]
  } catch {
    return []
  }
}

function parseLangChainConfig(filePath: string, defaultModel: string): Agent | null {
  try {
    // Basic YAML parsing without a dep — handle simple key: value
    const raw = fs.readFileSync(filePath, 'utf8')
    const getName = (r: string) => r.match(/^name:\s*(.+)/m)?.[1]?.trim()
    const getDesc = (r: string) => r.match(/^description:\s*(.+)/m)?.[1]?.trim()
    const getMsg = (r: string) =>
      r.match(/system_message:\s*['"]([\s\S]*?)['"]/m)?.[1] ||
      r.match(/system_prompt:\s*['"]([\s\S]*?)['"]/m)?.[1] ||
      ''
    const getModel = (r: string) => r.match(/model(?:_name)?:\s*(.+)/m)?.[1]?.trim()

    const name = getName(raw) || path.basename(filePath, path.extname(filePath))
    const id = slugify(name)
    const description = getDesc(raw) || ''
    const model = getModel(raw) || defaultModel
    const systemMsg = getMsg(raw)

    return makeAgent(id, name, inferRole(name, systemMsg), description, model, filePath, 'langchain', systemMsg)
  } catch {
    return null
  }
}

function inferRole(name: string, content: string): string {
  const lower = (name + ' ' + content).toLowerCase()
  if (lower.includes('research')) return 'Research Agent'
  if (lower.includes('writ') || lower.includes('content')) return 'Content Writer'
  if (lower.includes('review') || lower.includes('audit')) return 'Reviewer'
  if (lower.includes('code') || lower.includes('engineer') || lower.includes('develop')) return 'Code Agent'
  if (lower.includes('test') || lower.includes('qa')) return 'QA Agent'
  if (lower.includes('deploy') || lower.includes('devops')) return 'DevOps Agent'
  if (lower.includes('data') || lower.includes('analys')) return 'Data Analyst'
  if (lower.includes('design')) return 'Design Agent'
  if (lower.includes('plan') || lower.includes('orchestrat') || lower.includes('coordinat')) return 'Orchestrator'
  if (lower.includes('search') || lower.includes('retriev')) return 'Search Agent'
  return 'AI Agent'
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const root = process.cwd()
  const config = loadConfig(root)
  const defaultModel = config.defaultModel || 'claude-sonnet-4-6'
  const agentsMap = new Map<string, Agent>()

  for (const scanPath of config.scanPaths) {
    const base = path.resolve(root, scanPath)

    // 1. Claude sub-agents (.claude/agents/*.md)
    const claudeAgentFiles = await glob('**/.claude/agents/*.md', {
      cwd: base,
      absolute: true,
      ignore: ['**/node_modules/**'],
    })
    for (const f of claudeAgentFiles) {
      const agent = parseClaudeSubAgent(f, defaultModel)
      if (agent && !agentsMap.has(agent.id)) agentsMap.set(agent.id, agent)
    }

    // 2. CLAUDE.md (main assistant config)
    const claudeMainFiles = await glob('**/CLAUDE.md', {
      cwd: base,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.claude/agents/**'],
    })
    for (const f of claudeMainFiles) {
      const agent = parseClaudeMain(f, defaultModel)
      if (agent && !agentsMap.has(agent.id)) agentsMap.set(agent.id, agent)
    }

    // 3. OpenAI configs
    const openaiFiles = await glob('**/openai-assistants.json', {
      cwd: base,
      absolute: true,
      ignore: ['**/node_modules/**'],
    })
    for (const f of openaiFiles) {
      for (const agent of parseOpenAIConfig(f, defaultModel)) {
        if (!agentsMap.has(agent.id)) agentsMap.set(agent.id, agent)
      }
    }

    // 4. LangChain configs
    const langchainFiles = await glob('**/*.agent.{yaml,yml}', {
      cwd: base,
      absolute: true,
      ignore: ['**/node_modules/**'],
    })
    for (const f of langchainFiles) {
      const agent = parseLangChainConfig(f, defaultModel)
      if (agent && !agentsMap.has(agent.id)) agentsMap.set(agent.id, agent)
    }

    // 5. Generic: .md with "agent:" frontmatter key
    const genericFiles = await glob('**/*.md', {
      cwd: base,
      absolute: true,
      ignore: ['**/node_modules/**', '**/CLAUDE.md', '**/.claude/agents/**', '**/README.md'],
    })
    for (const f of genericFiles) {
      try {
        const raw = fs.readFileSync(f, 'utf8')
        const { data, content } = matter(raw)
        if (!data.agent) continue
        const name = (data.name as string) || path.basename(f, '.md')
        const id = slugify(name)
        if (agentsMap.has(id)) continue
        const model = (data.model as string) || defaultModel
        const description = (data.description as string) || ''
        const agent = makeAgent(id, name, inferRole(name, content), description, model, f, 'generic', content)
        agentsMap.set(id, agent)
      } catch {
        // skip
      }
    }
  }

  // Apply manual overrides from config
  if (config.agents) {
    for (const [id, override] of Object.entries(config.agents)) {
      const existing = agentsMap.get(id)
      if (existing) {
        agentsMap.set(id, {
          ...existing,
          ...override,
          compensation: { ...existing.compensation, ...(override.compensation ?? {}) },
        })
      }
    }
  }

  // Build workflows and annotate agents with workflowIds
  const workflows: Workflow[] = config.workflows || []
  const agentList = Array.from(agentsMap.values())

  for (const workflow of workflows) {
    for (const agentId of workflow.agents) {
      const agent = agentsMap.get(agentId)
      if (agent && !agent.workflowIds.includes(workflow.id)) {
        agent.workflowIds.push(workflow.id)
      }
    }
  }

  // Recalculate costs for agents that have token counts
  for (const agent of agentList) {
    if (agent.compensation.totalTokens > 0 && agent.compensation.estimatedCostUSD === 0) {
      agent.compensation.estimatedCostUSD = calculateCost(
        agent.compensation.inputTokens,
        agent.compensation.outputTokens,
        agent.model,
      )
    }
  }

  // If no agents found, write sample data so the UI has something to show
  const finalAgents = agentList.length > 0 ? agentList : generateSampleAgents(defaultModel)
  const finalWorkflows = workflows.length > 0 ? workflows : generateSampleWorkflows()

  const output: AgentsData = {
    generatedAt: new Date().toISOString(),
    agents: finalAgents,
    workflows: finalWorkflows,
  }

  const outPath = path.join(root, 'src/data/agents.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

  console.log(`✅ Control Room scanner complete`)
  console.log(`   Agents found: ${finalAgents.length}`)
  console.log(`   Workflows:    ${finalWorkflows.length}`)
  console.log(`   Output:       ${outPath}`)
}

// ─── sample data ──────────────────────────────────────────────────────────────

function generateSampleAgents(defaultModel: string): Agent[] {
  const samples: Array<Omit<Agent, 'avatarColor' | 'compensation' | 'workflowIds'>> = [
    {
      id: 'research-agent',
      name: 'Research Agent',
      role: 'Research Specialist',
      description: 'Conducts deep research on topics using web search and knowledge synthesis',
      model: defaultModel,
      sourceFile: '.claude/agents/researcher.md',
      sourceType: 'claude-subagent',
      systemPrompt: 'You are a research specialist. Your responsibilities include:\n- Search the web for relevant information\n- Synthesize findings from multiple sources\n- Produce accurate, well-cited research summaries\n- Identify gaps in knowledge and suggest follow-up questions',
      responsibilities: [
        'Search the web for relevant information',
        'Synthesize findings from multiple sources',
        'Produce accurate, well-cited research summaries',
        'Identify gaps in knowledge and suggest follow-up questions',
      ],
      skills: ['web search', 'research', 'analysis', 'summarization'],
      tools: ['web_search', 'read_file'],
    },
    {
      id: 'code-agent',
      name: 'Code Agent',
      role: 'Software Engineer',
      description: 'Writes, reviews, and debugs code across multiple languages and frameworks',
      model: defaultModel,
      sourceFile: '.claude/agents/coder.md',
      sourceType: 'claude-subagent',
      systemPrompt: 'You are an expert software engineer. Your responsibilities include:\n- Write clean, well-documented code\n- Review pull requests and suggest improvements\n- Debug complex issues across the stack\n- Implement features following best practices',
      responsibilities: [
        'Write clean, well-documented code',
        'Review pull requests and suggest improvements',
        'Debug complex issues across the stack',
        'Implement features following best practices',
      ],
      skills: ['TypeScript', 'Python', 'React', 'Node.js', 'SQL', 'testing', 'code review'],
      tools: ['read_file', 'write_file', 'bash', 'search'],
    },
    {
      id: 'writer-agent',
      name: 'Writer Agent',
      role: 'Content Writer',
      description: 'Creates compelling written content including docs, blog posts, and reports',
      model: 'claude-haiku-4-5-20251001',
      sourceFile: '.claude/agents/writer.md',
      sourceType: 'claude-subagent',
      systemPrompt: 'You are a skilled content writer. Your responsibilities include:\n- Write clear, engaging content for various audiences\n- Edit and improve existing documentation\n- Create blog posts, reports, and technical guides\n- Adapt tone and style to match brand guidelines',
      responsibilities: [
        'Write clear, engaging content for various audiences',
        'Edit and improve existing documentation',
        'Create blog posts, reports, and technical guides',
        'Adapt tone and style to match brand guidelines',
      ],
      skills: ['writing', 'editing', 'content'],
      tools: ['read_file', 'write_file'],
    },
    {
      id: 'orchestrator',
      name: 'Orchestrator',
      role: 'Workflow Orchestrator',
      description: 'Coordinates multi-agent workflows and delegates tasks to specialist agents',
      model: defaultModel,
      sourceFile: 'CLAUDE.md',
      sourceType: 'claude-main',
      systemPrompt: 'You are the primary orchestrator. Your responsibilities include:\n- Analyze incoming requests and break them into sub-tasks\n- Delegate sub-tasks to the appropriate specialist agents\n- Coordinate parallel and sequential agent workflows\n- Aggregate and refine results from multiple agents\n- Maintain context across long-running tasks',
      responsibilities: [
        'Analyze incoming requests and break them into sub-tasks',
        'Delegate sub-tasks to the appropriate specialist agents',
        'Coordinate parallel and sequential agent workflows',
        'Aggregate and refine results from multiple agents',
      ],
      skills: ['orchestration', 'planning', 'coordination'],
      tools: ['spawn_agent', 'read_file', 'write_file'],
    },
  ]

  return samples.map((s, i) => ({
    ...s,
    avatarColor: getAvatarColor(s.id),
    workflowIds: ['content-pipeline'],
    compensation: {
      inputTokens: (i + 1) * 125_000,
      outputTokens: (i + 1) * 42_000,
      totalTokens: (i + 1) * 167_000,
      estimatedCostUSD: calculateCost((i + 1) * 125_000, (i + 1) * 42_000, s.model),
      period: 'all-time',
    },
  }))
}

function generateSampleWorkflows(): Workflow[] {
  return [
    {
      id: 'content-pipeline',
      name: 'Content Creation Pipeline',
      description: 'Agents collaborate to research, draft, and refine written content',
      agents: ['orchestrator', 'research-agent', 'writer-agent', 'code-agent'],
      edges: [
        { from: 'orchestrator', to: 'research-agent', label: 'delegates research task' },
        { from: 'research-agent', to: 'orchestrator', label: 'returns research notes' },
        { from: 'orchestrator', to: 'writer-agent', label: 'passes brief + research' },
        { from: 'writer-agent', to: 'orchestrator', label: 'submits draft' },
      ],
    },
    {
      id: 'code-review-pipeline',
      name: 'Code Review Pipeline',
      description: 'Automated code review and improvement workflow',
      agents: ['orchestrator', 'code-agent', 'writer-agent'],
      edges: [
        { from: 'orchestrator', to: 'code-agent', label: 'sends code for review' },
        { from: 'code-agent', to: 'writer-agent', label: 'requests doc update' },
        { from: 'writer-agent', to: 'orchestrator', label: 'returns updated docs' },
      ],
    },
  ]
}

main().catch(console.error)
