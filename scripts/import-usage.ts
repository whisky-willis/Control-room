#!/usr/bin/env tsx
/**
 * Control Room Usage Importer
 * Imports Anthropic or OpenAI API usage logs and updates agents.json token/cost data.
 *
 * Usage:
 *   npx tsx scripts/import-usage.ts --file usage.csv [--format anthropic|openai]
 *   npx tsx scripts/import-usage.ts --file usage.json
 *
 * Anthropic CSV format (from console.anthropic.com):
 *   date,workspace_id,api_key_id,model,input_tokens,output_tokens,cost_usd
 *
 * OpenAI JSON format (from platform.openai.com usage export):
 *   [{ "date": "2025-03", "model": "gpt-4o", "n_context_tokens_total": 1000, "n_generated_tokens_total": 200 }]
 */

import fs from 'fs'
import path from 'path'
import { calculateCost } from '../src/lib/model-pricing'
import type { AgentsData, ControlRoomConfig } from '../src/lib/types'

interface UsageRow {
  model: string
  inputTokens: number
  outputTokens: number
  costUSD: number
  date?: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const file = args[args.indexOf('--file') + 1]
  const format = args[args.indexOf('--format') + 1] as 'anthropic' | 'openai' | undefined
  const agentId = args[args.indexOf('--agent') + 1]
  return { file, format, agentId }
}

function detectFormat(filePath: string, hint?: string): 'anthropic-csv' | 'openai-json' | 'generic-csv' {
  if (hint === 'anthropic') return 'anthropic-csv'
  if (hint === 'openai') return 'openai-json'
  if (filePath.endsWith('.json')) return 'openai-json'
  return 'anthropic-csv'
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim() ?? '']))
  })
}

function parseAnthropicCSV(content: string): UsageRow[] {
  const rows = parseCSV(content)
  return rows.map((r) => ({
    model: r.model || 'claude-sonnet-4-6',
    inputTokens: parseInt(r.input_tokens || r.input_token_count || '0', 10),
    outputTokens: parseInt(r.output_tokens || r.output_token_count || '0', 10),
    costUSD: parseFloat(r.cost_usd || r.cost || '0'),
    date: r.date,
  }))
}

function parseOpenAIJSON(content: string): UsageRow[] {
  const data = JSON.parse(content)
  const items = Array.isArray(data) ? data : data.data || []
  return items.map((item: Record<string, unknown>) => {
    const inputTokens = (item.n_context_tokens_total as number) || (item.prompt_tokens as number) || 0
    const outputTokens = (item.n_generated_tokens_total as number) || (item.completion_tokens as number) || 0
    const model = (item.model as string) || 'gpt-4o'
    return {
      model,
      inputTokens,
      outputTokens,
      costUSD: calculateCost(inputTokens, outputTokens, model),
      date: item.date as string,
    }
  })
}

function loadConfig(root: string): ControlRoomConfig {
  const configPath = path.join(root, 'control-room.config.json')
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as ControlRoomConfig
  }
  return { scanPaths: ['.'], defaultModel: 'claude-sonnet-4-6' }
}

function main() {
  const { file, format, agentId } = parseArgs()

  if (!file) {
    console.error('Usage: npx tsx scripts/import-usage.ts --file <path> [--agent <agent-id>] [--format anthropic|openai]')
    process.exit(1)
  }

  const root = process.cwd()
  const filePath = path.resolve(root, file)

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const fmt = detectFormat(filePath, format)

  let rows: UsageRow[]
  if (fmt === 'openai-json') {
    rows = parseOpenAIJSON(content)
  } else {
    rows = parseAnthropicCSV(content)
  }

  const agentsPath = path.join(root, 'src/data/agents.json')
  if (!fs.existsSync(agentsPath)) {
    console.error('agents.json not found. Run `npm run scan` first.')
    process.exit(1)
  }

  const agentsData: AgentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf8'))
  const config = loadConfig(root)

  // Aggregate all rows
  const totalInput = rows.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = rows.reduce((s, r) => s + r.outputTokens, 0)
  const totalCost = rows.reduce((s, r) => s + r.costUSD, 0)
  const totalTokens = totalInput + totalOutput

  // If --agent specified, apply to that agent only
  if (agentId) {
    const agent = agentsData.agents.find((a) => a.id === agentId)
    if (!agent) {
      console.error(`Agent "${agentId}" not found in agents.json`)
      process.exit(1)
    }
    agent.compensation = {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      totalTokens,
      estimatedCostUSD: Math.round(totalCost * 10000) / 10000,
      period: rows[0]?.date || 'all-time',
    }
    console.log(`✅ Updated compensation for agent: ${agentId}`)
  } else {
    // Distribute evenly across all agents (or apply to the model-matched agents)
    const agentCount = agentsData.agents.length || 1
    for (const agent of agentsData.agents) {
      // Find rows matching this agent's model
      const matchingRows = rows.filter(
        (r) => r.model === agent.model || r.model.startsWith(agent.model.split('-').slice(0, 3).join('-'))
      )
      if (matchingRows.length > 0) {
        const inp = matchingRows.reduce((s, r) => s + r.inputTokens, 0)
        const out = matchingRows.reduce((s, r) => s + r.outputTokens, 0)
        const cost = matchingRows.reduce((s, r) => s + r.costUSD, 0)
        agent.compensation = {
          inputTokens: inp,
          outputTokens: out,
          totalTokens: inp + out,
          estimatedCostUSD: Math.round(cost * 10000) / 10000,
          period: matchingRows[0]?.date || 'all-time',
        }
      } else {
        // Distribute evenly as fallback
        agent.compensation = {
          inputTokens: Math.round(totalInput / agentCount),
          outputTokens: Math.round(totalOutput / agentCount),
          totalTokens: Math.round(totalTokens / agentCount),
          estimatedCostUSD: Math.round((totalCost / agentCount) * 10000) / 10000,
          period: rows[0]?.date || 'all-time',
        }
      }
      // Also apply overrides from config
      const override = config.agents?.[agent.id]?.compensation
      if (override) Object.assign(agent.compensation, override)
    }
    console.log(`✅ Updated compensation for all ${agentsData.agents.length} agents`)
  }

  fs.writeFileSync(agentsPath, JSON.stringify(agentsData, null, 2))
  console.log(`   Total tokens: ${(totalTokens / 1000).toFixed(1)}K`)
  console.log(`   Total cost:   $${totalCost.toFixed(4)}`)
  console.log(`   Output:       ${agentsPath}`)
}

main()
