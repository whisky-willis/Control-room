export type AgentSourceType =
  | 'claude-subagent'
  | 'claude-main'
  | 'openai'
  | 'langchain'
  | 'generic'

export interface AgentCompensation {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostUSD: number
  /** e.g. "2025-03" or "all-time" */
  period?: string
}

export interface Agent {
  id: string
  name: string
  role: string
  description: string
  /** hex color for avatar background, auto-generated if absent */
  avatarColor?: string
  model: string
  sourceFile: string
  sourceType: AgentSourceType
  systemPrompt: string
  responsibilities: string[]
  skills: string[]
  tools: string[]
  compensation: AgentCompensation
  /** IDs of workflows this agent participates in */
  workflowIds: string[]
}

export interface WorkflowEdge {
  from: string
  to: string
  label?: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  /** agent IDs in logical order */
  agents: string[]
  edges: WorkflowEdge[]
}

export interface AgentOverride {
  name?: string
  role?: string
  description?: string
  model?: string
  compensation?: Partial<AgentCompensation>
  skills?: string[]
  tools?: string[]
}

export interface ControlRoomConfig {
  /** Directories to scan for agents, relative to this config file */
  scanPaths: string[]
  /** Default model to assume when not specified in agent config */
  defaultModel: string
  /** Base path for GitHub Pages subdirectory hosting */
  basePath?: string
  /** Manual overrides keyed by agent id (slug) */
  agents?: Record<string, AgentOverride>
  /** Manually defined workflows — merged with any auto-detected ones */
  workflows?: Workflow[]
  /** Path to Anthropic/OpenAI usage CSV or JSON export file */
  usageLogPath?: string
}

export interface AgentsData {
  generatedAt: string
  agents: Agent[]
  workflows: Workflow[]
}
