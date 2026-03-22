import Link from 'next/link'
import type { Agent } from '@/lib/types'
import { getInitials } from '@/lib/avatar-utils'
import { formatCost } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

interface RecentAgentsListProps {
  agents: Agent[]
}

export function RecentAgentsList({ agents }: RecentAgentsListProps) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Agent Roster</h3>
        <Link href="/agents" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {agents.slice(0, 6).map((agent) => (
          <Link key={agent.id} href={`/agents/${agent.id}`} className="flex items-center gap-3 group">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: agent.avatarColor || '#6366f1' }}
            >
              {getInitials(agent.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground group-hover:text-brand-600 transition-colors truncate">
                {agent.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
            </div>
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              {formatCost(agent.compensation.estimatedCostUSD)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
