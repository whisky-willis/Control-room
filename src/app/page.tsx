import { Users, DollarSign, GitBranch, Cpu, Zap } from 'lucide-react'
import { getAllAgents, getAllWorkflows, getDashboardStats, getGeneratedAt, getRecentActivity } from '@/lib/agent-loader'
import { StatCard } from '@/components/dashboard/StatCard'
import { CostOverviewChart } from '@/components/dashboard/CostOverviewChart'
import { RecentAgentsList } from '@/components/dashboard/RecentAgentsList'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { TopBar } from '@/components/layout/TopBar'
import { formatNumber, formatCost } from '@/lib/utils'

export default function DashboardPage() {
  const stats = getDashboardStats()
  const agents = getAllAgents()
  const workflows = getAllWorkflows()
  const generatedAt = getGeneratedAt()
  const recentActivity = getRecentActivity()

  const topAgent = agents.slice().sort((a, b) => b.compensation.totalTokens - a.compensation.totalTokens)[0]

  return (
    <>
      <TopBar breadcrumbs={[{ label: 'Dashboard' }]} />
      <div className="flex-1 p-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Control Room</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {agents.length === 0
              ? 'Run npm run scan to discover your agents'
              : `${stats.totalAgents} agents active · Last scanned ${new Date(generatedAt).toLocaleDateString()}`}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Agents"
            value={String(stats.totalAgents)}
            sub={`${stats.uniqueModels} model${stats.uniqueModels !== 1 ? 's' : ''}`}
            icon={Users}
            iconColor="bg-brand-500"
          />
          <StatCard
            label="Total Cost"
            value={formatCost(stats.totalCostUSD)}
            sub="all-time estimate"
            icon={DollarSign}
            iconColor="bg-emerald-500"
          />
          <StatCard
            label="Tokens Used"
            value={formatNumber(stats.totalTokens)}
            sub="across all agents"
            icon={Zap}
            iconColor="bg-amber-500"
          />
          <StatCard
            label="Workflows"
            value={String(stats.totalWorkflows)}
            sub="active pipelines"
            icon={GitBranch}
            iconColor="bg-violet-500"
          />
        </div>

        {/* Charts + list */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <CostOverviewChart agents={agents} />
          </div>
          <RecentAgentsList agents={agents} />
        </div>

        {/* Activity feed */}
        {recentActivity.length > 0 && <ActivityFeed sessions={recentActivity} />}

        {/* Top performer */}
        {topAgent && (
          <div className="bg-gradient-to-r from-brand-600 to-violet-600 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Highest Utilization</span>
            </div>
            <h3 className="text-lg font-bold">{topAgent.name}</h3>
            <p className="text-sm opacity-80 mt-0.5">{topAgent.role} · {topAgent.model}</p>
            <div className="flex items-center gap-6 mt-3 text-sm">
              <span><strong>{formatNumber(topAgent.compensation.totalTokens)}</strong> tokens</span>
              <span><strong>{formatCost(topAgent.compensation.estimatedCostUSD)}</strong> cost</span>
              <span><strong>{topAgent.responsibilities.length}</strong> responsibilities</span>
            </div>
          </div>
        )}

        {/* Workflow summary */}
        {workflows.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Active Workflows</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workflows.map((wf) => (
                <a
                  key={wf.id}
                  href={`/workflows#${wf.id}`}
                  className="bg-white rounded-xl border border-border p-4 hover:border-brand-300 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="w-4 h-4 text-brand-500" />
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-brand-600 transition-colors">
                      {wf.name}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{wf.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {wf.agents.length} agents · {wf.edges.length} connections
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
