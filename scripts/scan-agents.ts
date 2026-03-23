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
import { parseClaudeLogs } from './parse-claude-logs'
import type {
  Agent,
  AgentsData,
  ActivitySession,
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

async function fetchAnthropicUsage(agents: Agent[]): Promise<void> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY
  if (!adminKey) return

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - 30)
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

  interface UsageBucket { model?: string; input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
  interface UsageResponse { data: UsageBucket[]; has_more: boolean; next_page?: string }

  const byModel: Record<string, { inputTokens: number; outputTokens: number }> = {}

  let page: string | undefined
  do {
    const url = new URL('https://api.anthropic.com/v1/organizations/usage_report/messages')
    url.searchParams.set('starting_at', fmt(startDate))
    url.searchParams.set('ending_at', fmt(endDate))
    url.searchParams.set('bucket_width', '1d')
    url.searchParams.append('group_by[]', 'model')
    if (page) url.searchParams.set('page', page)

    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' },
    })
    if (!res.ok) {
      console.warn(`⚠️  Anthropic usage API returned ${res.status}: ${await res.text()}`)
      return
    }
    const body = await res.json() as UsageResponse
    for (const bucket of body.data) {
      const model = bucket.model ?? 'unknown'
      if (!byModel[model]) byModel[model] = { inputTokens: 0, outputTokens: 0 }
      byModel[model].inputTokens += (bucket.input_tokens ?? 0) + (bucket.cache_read_input_tokens ?? 0)
      byModel[model].outputTokens += bucket.output_tokens ?? 0
    }
    page = body.has_more ? body.next_page : undefined
  } while (page)

  const totalInput = Object.values(byModel).reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = Object.values(byModel).reduce((s, r) => s + r.outputTokens, 0)
  const agentCount = agents.length || 1

  for (const agent of agents) {
    const key = Object.keys(byModel).find(
      (m) => m === agent.model || m.startsWith(agent.model.split('-').slice(0, 3).join('-'))
    )
    const inp = key ? byModel[key].inputTokens : Math.round(totalInput / agentCount)
    const out = key ? byModel[key].outputTokens : Math.round(totalOutput / agentCount)
    agent.compensation = {
      inputTokens: inp,
      outputTokens: out,
      totalTokens: inp + out,
      estimatedCostUSD: Math.round(calculateCost(inp, out, agent.model) * 10000) / 10000,
      period: 'all-time',
    }
  }

  console.log(`   Anthropic API: fetched usage for ${Object.keys(byModel).length} model(s)`)
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? '']))
  })
}

function applyUsageLog(agents: Agent[], usageLogPath: string, root: string): void {
  const filePath = path.resolve(root, usageLogPath)
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  usageLogPath not found: ${filePath}`)
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const isJson = filePath.endsWith('.json')

  interface UsageRow { model: string; inputTokens: number; outputTokens: number; costUSD: number; date?: string }
  let rows: UsageRow[]

  if (isJson) {
    const data = JSON.parse(content)
    const items: Record<string, unknown>[] = Array.isArray(data) ? data : (data.data ?? [])
    rows = items.map((item) => {
      const inp = (item.n_context_tokens_total as number) || (item.prompt_tokens as number) || 0
      const out = (item.n_generated_tokens_total as number) || (item.completion_tokens as number) || 0
      const model = (item.model as string) || 'gpt-4o'
      return { model, inputTokens: inp, outputTokens: out, costUSD: calculateCost(inp, out, model), date: item.date as string }
    })
  } else {
    rows = parseCSV(content).map((r) => ({
      model: r.model || 'claude-sonnet-4-6',
      inputTokens: parseInt(r.input_tokens || r.input_token_count || '0', 10),
      outputTokens: parseInt(r.output_tokens || r.output_token_count || '0', 10),
      costUSD: parseFloat(r.cost_usd || r.cost || '0'),
      date: r.date,
    }))
  }

  const totalInput = rows.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = rows.reduce((s, r) => s + r.outputTokens, 0)
  const totalCost = rows.reduce((s, r) => s + r.costUSD, 0)
  const agentCount = agents.length || 1

  for (const agent of agents) {
    const matching = rows.filter(
      (r) => r.model === agent.model || r.model.startsWith(agent.model.split('-').slice(0, 3).join('-'))
    )
    const src = matching.length > 0 ? matching : null
    const inp = src ? src.reduce((s, r) => s + r.inputTokens, 0) : Math.round(totalInput / agentCount)
    const out = src ? src.reduce((s, r) => s + r.outputTokens, 0) : Math.round(totalOutput / agentCount)
    const cost = src ? src.reduce((s, r) => s + r.costUSD, 0) : totalCost / agentCount
    const date = (src ?? rows)[0]?.date
    agent.compensation = {
      inputTokens: inp,
      outputTokens: out,
      totalTokens: inp + out,
      estimatedCostUSD: Math.round(cost * 10000) / 10000,
      ...(date ? { period: date } : { period: 'all-time' }),
    }
  }

  console.log(`   Usage log:    ${usageLogPath} (${rows.length} rows)`)
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

// ─── code file parsers ────────────────────────────────────────────────────────

/**
 * Extracts a string value from a code block for a given key.
 * Handles Python kwargs (key="val"), JS object props (key: "val"),
 * and Python triple-quoted strings (key="""val""").
 */
function extractStringValue(text: string, key: string): string | undefined {
  const patterns = [
    // key="""...""" or key='''...''' (Python multiline - grab first non-empty line)
    new RegExp(`${key}\\s*=\\s*"""([\\s\\S]*?)"""`, 's'),
    new RegExp(`${key}\\s*=\\s*'''([\\s\\S]*?)'''`, 's'),
    // key="val" or key='val' or key=`val`
    new RegExp(`${key}\\s*=\\s*["'\`]([^"'\`\\n]{1,300})["'\`]`),
    // key: "val" or key: 'val' or key: \`val\` (JS object literal)
    new RegExp(`${key}\\s*:\\s*["'\`]([^"'\`\\n]{1,300})["'\`]`),
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) {
      // For multiline, return first non-empty line
      const val = m[1].trim()
      return val.split('\n').find((l) => l.trim()) || val
    }
  }
  return undefined
}

/**
 * Parses an Agent(...) block extracted from a code file.
 * Returns null if no recognisable name field is found.
 */
function parseCodeAgentBlock(block: string, filePath: string, defaultModel: string): Agent | null {
  const name = extractStringValue(block, 'name') || extractStringValue(block, 'role')
  if (!name) return null

  const id = slugify(name)
  const instructions =
    extractStringValue(block, 'instructions') ||
    extractStringValue(block, 'system_prompt') ||
    extractStringValue(block, 'goal') ||
    ''
  const description =
    extractStringValue(block, 'description') ||
    extractStringValue(block, 'backstory') ||
    instructions.slice(0, 120)
  const model = extractStringValue(block, 'model') || defaultModel
  const tools: string[] = []

  return makeAgent(id, name, inferRole(name, instructions), description, model, filePath, 'generic', instructions, tools)
}

/**
 * Scans a Python or JS/TS source file for Agent() / new Agent({}) instantiations
 * from common frameworks (OpenAI Agents SDK, CrewAI, custom).
 */
function parseCodeFile(filePath: string, defaultModel: string): Agent[] {
  const agents: Agent[] = []
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const ext = path.extname(filePath).toLowerCase()
    const isPython = ext === '.py'

    // Quick guard: skip files that don't reference Agent at all
    if (!raw.includes('Agent')) return agents

    // Keywords to locate agent instantiations
    const keywords = isPython ? ['Agent('] : ['new Agent({', 'Agent({']

    for (const keyword of keywords) {
      let searchFrom = 0
      while (true) {
        const idx = raw.indexOf(keyword, searchFrom)
        if (idx === -1) break

        // Extract up to 1000 chars starting from the keyword to capture all kwargs
        const block = raw.slice(idx, idx + 1000)
        const agent = parseCodeAgentBlock(block, filePath, defaultModel)
        if (agent && !agents.find((a) => a.id === agent.id)) {
          agents.push(agent)
        }
        searchFrom = idx + keyword.length
      }
    }
  } catch {
    // skip unreadable files
  }
  return agents
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

// ─── claude log integration ───────────────────────────────────────────────────

function applyClaudeLogs(agents: Agent[], root: string): ActivitySession[] {
  const logs = parseClaudeLogs(root)
  if (!logs) return []

  const totalIn = logs.totalInputTokens
  const totalOut = logs.totalOutputTokens

  if (totalIn === 0 && totalOut === 0) return []

  // Match subagent types to discovered agents by name/role keywords
  const matchedInputByAgent: Record<string, number> = {}
  const matchedOutputByAgent: Record<string, number> = {}

  for (const [agentType, usage] of Object.entries(logs.byAgentType)) {
    const lower = agentType.toLowerCase()
    const matched = agents.find((a) => {
      const n = a.name.toLowerCase()
      const r = a.role.toLowerCase()
      if (lower.includes('explore') || lower.includes('research')) return n.includes('research') || r.includes('research')
      if (lower.includes('code') || lower.includes('engineer')) return n.includes('code') || r.includes('code') || r.includes('engineer')
      if (lower.includes('write') || lower.includes('writer') || lower.includes('content')) return n.includes('writ') || r.includes('writ') || r.includes('content')
      if (lower.includes('plan')) return r.includes('plan') || r.includes('orchestrat')
      return false
    })
    if (matched) {
      matchedInputByAgent[matched.id] = (matchedInputByAgent[matched.id] ?? 0) + usage.inputTokens
      matchedOutputByAgent[matched.id] = (matchedOutputByAgent[matched.id] ?? 0) + usage.outputTokens
    }
  }

  const totalMatchedIn = Object.values(matchedInputByAgent).reduce((s, v) => s + v, 0)
  const totalMatchedOut = Object.values(matchedOutputByAgent).reduce((s, v) => s + v, 0)
  const remainderIn = Math.max(0, totalIn - totalMatchedIn)
  const remainderOut = Math.max(0, totalOut - totalMatchedOut)

  // Give remainder to the main/orchestrator agent, or distribute evenly if none
  const mainAgent = agents.find((a) => a.sourceType === 'claude-main') ?? agents[0]

  for (const agent of agents) {
    const inp = (matchedInputByAgent[agent.id] ?? 0) + (agent === mainAgent ? remainderIn : 0)
    const out = (matchedOutputByAgent[agent.id] ?? 0) + (agent === mainAgent ? remainderOut : 0)
    if (inp === 0 && out === 0) continue

    agent.compensation = {
      inputTokens: inp,
      outputTokens: out,
      totalTokens: inp + out,
      estimatedCostUSD: Math.round(calculateCost(inp, out, agent.model) * 10000) / 10000,
      cacheTokens: agent === mainAgent ? logs.totalCacheTokens : undefined,
      lastActiveAt: logs.lastActiveAt,
      isActive: logs.isActive,
      sessionCount: logs.sessions.length,
      period: 'all-time',
    }
  }

  console.log(`   Claude logs:  ${logs.sessions.length} session(s), ${totalIn + totalOut} tokens total`)
  if (logs.isActive) console.log(`   ⚡ Active session detected`)

  // Build activity feed (most recent 10 sessions)
  return logs.sessions.slice(0, 10).map((s) => ({
    sessionId: s.sessionId,
    lastActiveAt: s.lastActiveAt,
    isActive: s.isActive,
    totalTokens: s.inputTokens + s.outputTokens,
    cacheTokens: s.cacheTokens,
    agentTypesInvolved: Array.from(new Set(s.subagents.map((sub) => sub.agentType))),
  }))
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
    // dot:true is required so glob traverses hidden directories like .claude/
    const claudeAgentFiles = await glob('**/.claude/agents/*.md', {
      cwd: base,
      absolute: true,
      dot: true,
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

    // 5. Code files: Python / JS / TS with Agent() instantiations
    const codeFiles = await glob('**/*.{py,ts,tsx,js,mjs}', {
      cwd: base,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/.cache/**'],
    })
    for (const f of codeFiles) {
      for (const agent of parseCodeFile(f, defaultModel)) {
        if (!agentsMap.has(agent.id)) agentsMap.set(agent.id, agent)
      }
    }

    // 6. Generic: .md with "agent:" frontmatter key
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

  // Auto-import usage data: Claude logs → local file → Anthropic Admin API
  let recentActivity: ActivitySession[] = []
  const claudeLogData = applyClaudeLogs(finalAgents, root)
  if (claudeLogData.length > 0) {
    recentActivity = claudeLogData
  } else if (config.usageLogPath) {
    applyUsageLog(finalAgents, config.usageLogPath, root)
  } else {
    await fetchAnthropicUsage(finalAgents)
  }

  const finalWorkflows = workflows.length > 0 ? workflows : generateSampleWorkflows()

  const output: AgentsData = {
    generatedAt: new Date().toISOString(),
    agents: finalAgents,
    workflows: finalWorkflows,
    recentActivity,
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
