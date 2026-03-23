/**
 * Parses Claude Code's local session logs from ~/.claude/projects/
 * to extract real token usage, subagent activity, and live session status.
 *
 * No API key or org account required — reads files Claude Code already writes.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

export interface SubagentUsage {
  agentType: string
  description: string
  inputTokens: number
  outputTokens: number
}

export interface SessionUsage {
  sessionId: string
  lastActiveAt: string
  isActive: boolean
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  subagents: SubagentUsage[]
}

export interface ClaudeLogsResult {
  sessions: SessionUsage[]
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  lastActiveAt: string | undefined
  isActive: boolean
  /** Token totals keyed by subagent type (e.g. "Explore", "Code Agent") */
  byAgentType: Record<string, { inputTokens: number; outputTokens: number; count: number }>
}

interface JsonlEvent {
  message?: {
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

interface SubagentMeta {
  agentType?: string
  description?: string
}

function parseJsonlTokens(filePath: string) {
  const result = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 }
  if (!fs.existsSync(filePath)) return result

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return result
  }

  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as JsonlEvent
      const u = event.message?.usage
      if (u) {
        result.input += u.input_tokens ?? 0
        result.output += u.output_tokens ?? 0
        result.cacheCreate += u.cache_creation_input_tokens ?? 0
        result.cacheRead += u.cache_read_input_tokens ?? 0
      }
    } catch {
      // skip malformed lines
    }
  }
  return result
}

export function parseClaudeLogs(projectRoot: string): ClaudeLogsResult | null {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects')
  if (!fs.existsSync(claudeProjectsDir)) return null

  // Claude Code encodes the project path: /home/user/Foo → -home-user-Foo
  const encodedPath = projectRoot.replace(/\//g, '-')
  let projectDir = path.join(claudeProjectsDir, encodedPath)

  if (!fs.existsSync(projectDir)) {
    // Strip leading dash
    projectDir = path.join(claudeProjectsDir, encodedPath.replace(/^-/, ''))
  }

  if (!fs.existsSync(projectDir)) {
    // Fuzzy: find dir that ends with the project folder name
    const projectName = path.basename(projectRoot)
    const dirs = fs.readdirSync(claudeProjectsDir)
    const match = dirs.find((d) => d === `-home-${process.env.USER}-${projectName}` || d.endsWith('-' + projectName))
    if (!match) return null
    projectDir = path.join(claudeProjectsDir, match)
  }

  const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes
  const now = Date.now()

  const result: ClaudeLogsResult = {
    sessions: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheTokens: 0,
    lastActiveAt: undefined,
    isActive: false,
    byAgentType: {},
  }

  let jsonlFiles: string[]
  try {
    jsonlFiles = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'))
  } catch {
    return null
  }

  for (const file of jsonlFiles) {
    const filePath = path.join(projectDir, file)
    let stat: fs.Stats
    try {
      stat = fs.statSync(filePath)
    } catch {
      continue
    }

    const lastActiveAt = stat.mtime.toISOString()
    const isActive = now - stat.mtimeMs < ACTIVE_THRESHOLD_MS
    if (isActive) result.isActive = true
    if (!result.lastActiveAt || lastActiveAt > result.lastActiveAt) {
      result.lastActiveAt = lastActiveAt
    }

    const sessionId = path.basename(file, '.jsonl')
    const tokens = parseJsonlTokens(filePath)

    const session: SessionUsage = {
      sessionId,
      lastActiveAt,
      isActive,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cacheTokens: tokens.cacheCreate + tokens.cacheRead,
      subagents: [],
    }

    // Parse subagent metadata + tokens
    const subagentsDir = path.join(projectDir, sessionId, 'subagents')
    if (fs.existsSync(subagentsDir)) {
      let metaFiles: string[]
      try {
        metaFiles = fs.readdirSync(subagentsDir).filter((f) => f.endsWith('.meta.json'))
      } catch {
        metaFiles = []
      }

      for (const metaFile of metaFiles) {
        try {
          const meta = JSON.parse(
            fs.readFileSync(path.join(subagentsDir, metaFile), 'utf8')
          ) as SubagentMeta
          const agentType = meta.agentType ?? 'unknown'
          const description = meta.description ?? ''

          const subJsonl = path.join(subagentsDir, metaFile.replace('.meta.json', '.jsonl'))
          const subTokens = parseJsonlTokens(subJsonl)

          if (!result.byAgentType[agentType]) {
            result.byAgentType[agentType] = { inputTokens: 0, outputTokens: 0, count: 0 }
          }
          result.byAgentType[agentType].inputTokens += subTokens.input
          result.byAgentType[agentType].outputTokens += subTokens.output
          result.byAgentType[agentType].count++

          session.subagents.push({ agentType, description, inputTokens: subTokens.input, outputTokens: subTokens.output })
        } catch {
          // skip unreadable meta
        }
      }
    }

    result.sessions.push(session)
    result.totalInputTokens += tokens.input
    result.totalOutputTokens += tokens.output
    result.totalCacheTokens += tokens.cacheCreate + tokens.cacheRead
  }

  // Newest sessions first
  result.sessions.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))

  return result
}
