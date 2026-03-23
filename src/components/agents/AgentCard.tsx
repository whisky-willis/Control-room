import Link from 'next/link'
import type { Agent } from '@/lib/types'
import { getInitials } from '@/lib/avatar-utils'
import { formatNumber, formatCost } from '@/lib/utils'
import { Zap, DollarSign } from 'lucide-react'

interface AgentCardProps {
  agent: Agent
}

const sourceTypeBadge: Record<string, { label: string; className: string }> = {
  'claude-subagent': { label: 'Claude', className: 'bg-violet-100 text-violet-700' },
  'claude-main': { label: 'Claude Main', className: 'bg-violet-100 text-violet-700' },
  openai: { label: 'OpenAI', className: 'bg-green-100 text-green-700' },
  langchain: { label: 'LangChain', className: 'bg-orange-100 text-orange-700' },
  generic: { label: 'Generic', className: 'bg-gray-100 text-gray-600' },
}

export function AgentCard({ agent }: AgentCardProps) {
  const badge = sourceTypeBadge[agent.sourceType] || sourceTypeBadge.generic

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="bg-white rounded-xl border border-border p-5 hover:border-brand-300 hover:shadow-sm transition-all group flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl text-white text-base font-bold shrink-0"
          style={{ backgroundColor: agent.avatarColor || '#6366f1' }}
        >
          {getInitials(agent.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-foreground group-hover:text-brand-600 transition-colors truncate text-sm">
              {agent.name}
            </h3>
            {agent.compensation.isActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Active session" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 flex-1 mb-3">
        {agent.description || 'No description available.'}
      </p>

      {/* Skills */}
      {agent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.skills.slice(0, 3).map((s) => (
            <span key={s} className="px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded text-[10px] font-medium">
              {s}
            </span>
          ))}
          {agent.skills.length > 3 && (
            <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-[10px]">
              +{agent.skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Compensation */}
      <div className="flex items-center gap-3 pt-3 border-t border-border text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" /> {formatNumber(agent.compensation.totalTokens)}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> {formatCost(agent.compensation.estimatedCostUSD)}
        </span>
        <span className="ml-auto text-[10px] font-mono opacity-60">{agent.model.split('-').slice(0, 2).join('-')}</span>
      </div>
    </Link>
  )
}
